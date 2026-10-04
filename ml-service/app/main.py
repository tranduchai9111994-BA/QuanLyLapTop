"""FastAPI routes cho ML service (docs/06 SS4).

Đây là "cổng vào" duy nhất của ML service: nhận request từ backend (Node.js), gọi đúng hàm thuật
toán (retriever.py/classifier.py/text_classifier.py) rồi trả JSON. Trạng thái nằm trong RAM ở
`_state`; vì không dùng chung DB với backend nên catalog/scaler phải được đẩy sang qua `/catalog/sync`.
"""
from __future__ import annotations

from datetime import datetime, timezone

import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException

from app.models.explain import build_explanation
from app.data.features import MODEL_A_FEATURES, MODEL_B_FEATURES
from app.lifecycle.registry import registry
from app.models.retriever import build_ideal_vector, build_weights, fit_scaler, match_pct, recommend, similar_items
from app.schemas import CatalogSyncRequest, PredictSegmentRequest, RecommendRequest, SimilarRequest, TrainRequest
from app.models.segment_inference import infer_segment
from app.models.text_classifier import NeedTextModel

app = FastAPI(title="SmartLap ML service")

# Bộ nhớ làm việc của service (không phải database, mất khi tắt process nên backend phải gọi lại
# /catalog/sync mỗi lần khởi động, xem snapshotSync.ts):
#   catalog       : DataFrame laptop đang bán đã làm giàu đặc trưng (Mô hình B dùng)
#   scaler        : StandardScaler đã fit trên catalog này
#   index_built_at: thời điểm đồng bộ catalog gần nhất
#   text_model    : Mô hình C (TF-IDF+kNN) cho ô nhập câu tự do
_state: dict = {"catalog": None, "scaler": None, "index_built_at": None, "text_model": None}


@app.on_event("startup")
def on_startup() -> None:
    # Nạp Mô hình A mới nhất đã lưu trên đĩa (không huấn luyện lại lúc khởi động)
    registry.activate_latest()
    # Mô hình C nhẹ (132 câu) nên huấn luyện ngay lúc khởi động
    _state["text_model"] = NeedTextModel(n_neighbors=7).fit()


@app.get("/health")
def health() -> dict:
    """Kiểm tra service còn sống, phiên bản mô hình đang dùng và catalog đã đồng bộ chưa."""
    catalog = _state["catalog"]
    return {
        "status": "ok",
        "clfVersion": registry.version,
        "catalogSize": 0 if catalog is None else len(catalog),
        "indexBuiltAt": _state["index_built_at"],
    }


@app.post("/catalog/sync")
def catalog_sync(req: CatalogSyncRequest) -> dict:
    """Nhận TOÀN BỘ danh sách laptop từ backend, thay thế hoàn toàn catalog trong RAM rồi fit lại
    scaler. Không đồng bộ gia tăng: thay cả lần cho đơn giản, ít lỗi (quy mô ~1000 máy)."""
    df = pd.DataFrame(req.items)
    # Đổi "id" (tên backend gửi) -> "laptop_id" (tên nội bộ retriever.py), dùng làm index để tra nhanh
    df = df.rename(columns={"id": "laptop_id"}).set_index("laptop_id", drop=False)

    # sales_count thô phải đổi sang sales_score (0-100, log) ngay đây vì cần MAX của cả snapshot
    # (giống features.enrich_catalog), backend không tính trước được cho từng máy.
    if "discount_percent" not in df.columns:
        df["discount_percent"] = 0.0
    if "sales_count" in df.columns:
        log_sales = np.log1p(df["sales_count"].fillna(0).clip(lower=0))
        max_log = log_sales.max()
        df["sales_score"] = 100.0 * log_sales / max_log if max_log > 0 else 0.0
    else:
        df["sales_score"] = 0.0

    _state["catalog"] = df
    _state["scaler"] = fit_scaler(df)
    _state["index_built_at"] = datetime.now(timezone.utc).isoformat()
    return {"catalogSize": len(df), "indexBuiltAt": _state["index_built_at"]}


def _require_catalog() -> pd.DataFrame:
    """Báo lỗi 409 rõ ràng nếu endpoint cần catalog mà chưa gọi /catalog/sync."""
    if _state["catalog"] is None:
        raise HTTPException(status_code=409, detail="Catalog chua duoc dong bo (/catalog/sync)")
    return _state["catalog"]


@app.post("/predict-segment")  # cổng nhận từ backend (predictSegment, segment.service.ts)
def predict_segment(req: PredictSegmentRequest) -> dict:  # hàm B: req.items = bảng thông số backend gửi
    """Mô hình A: dự đoán PHÂN KHÚC (kèm xác suất từng nhãn) cho máy mới chưa có nhãn."""
    if registry.model is None:
        raise HTTPException(status_code=503, detail="Chưa có mô hình phân lớp được kích hoạt")
    X = pd.DataFrame(req.items)  # 1 máy = 1 hàng, 1 đặc trưng = 1 cột
    # Thiếu cột thì điền 0 (lưới an toàn, backend luôn gửi đủ 11 đặc trưng)
    for col in MODEL_A_FEATURES:
        if col not in X.columns:
            X[col] = 0
    proba = registry.model.predict_proba(X[MODEL_A_FEATURES])  # ★ mô hình: chuẩn hóa -> 7 láng giềng -> tỷ lệ phiếu 4 nhãn
    labels = registry.model.classes_  # tên 4 nhãn, cùng thứ tự các cột của proba

    # FR-09: lấy chính k láng giềng đã "bỏ phiếu" để nhân viên thấy lý do (vd "5/7 máy gần nhất là
    # Gaming"). `knn._y` là nhãn đã mã hóa của tập huấn luyện, đổi lại tên bằng `knn.classes_`.
    prep = registry.model.named_steps["prep"]
    knn = registry.model.named_steps["knn"]
    neigh_dist, neigh_idx = knn.kneighbors(prep.transform(X[MODEL_A_FEATURES]))  # 7 máy gần nhất: khoảng cách + vị trí
    train_labels = knn.classes_[knn._y]  # nhãn của từng máy trong tập huấn luyện

    results = []
    for row_i, row_proba in enumerate(proba):
        # Xác suất giảm dần, order[0] là nhãn cao nhất
        order = np.argsort(row_proba)[::-1]
        results.append({
            "label": labels[order[0]],
            "proba": float(row_proba[order[0]]),
            # Trả cả phân bố xác suất để frontend hiện mức độ chắc chắn (vd "89% Gaming, 11% Đồ họa")
            "distribution": {labels[i]: float(row_proba[i]) for i in order},
            "neighbors": [
                {"label": str(train_labels[j]), "distance": round(float(d), 4)}
                for j, d in zip(neigh_idx[row_i], neigh_dist[row_i])
            ],
        })
    return {"items": results, "modelVersion": registry.version}  # trả về cho backend (hàm A)


@app.post("/parse-need")
def parse_need_endpoint(payload: dict) -> dict:
    """{text: "con hoc ke toan, can may ben, re"} -> hồ sơ nhu cầu đầy đủ (Mô hình C).

    Đọc câu nói tự nhiên rồi tự suy ra nhóm nhu cầu, mức ưu tiên, ngân sách và ràng buộc.
    """
    text = (payload.get("text") or "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="Thieu noi dung cau mo ta nhu cau")
    model: NeedTextModel = _state.get("text_model")
    if model is None:
        model = NeedTextModel(n_neighbors=7).fit()
        _state["text_model"] = model
    return model.parse_need(text)


@app.post("/infer-segment")
def infer_segment_endpoint(payload: dict) -> dict:
    """{activities: [...]}. -> suy phân khúc từ hoạt động khi người dùng chọn 'Chưa rõ'."""
    catalog = _require_catalog()
    if registry.model is None:
        raise HTTPException(status_code=503, detail="Chua co mo hinh phan lop duoc kich hoat")
    activities = payload.get("activities", [])
    result = infer_segment(registry.model, catalog, activities)
    result["modelVersion"] = registry.version
    return result


@app.post("/recommend")
def recommend_endpoint(req: RecommendRequest) -> dict:
    """Mô hình B: từ hồ sơ nhu cầu + `candidateIds` (máy đã qua lọc cứng ở backend), trả TOP-N máy
    gần nhất kèm % phù hợp và giải thích. Được gọi khi người dùng bấm "Xem kết quả" ở Wizard.
    """
    catalog = _require_catalog()
    # Chỉ xếp hạng trong tập ứng viên đã được backend lọc cứng
    candidates = catalog.loc[catalog["laptop_id"].isin(req.candidateIds)]
    if candidates.empty:
        return {"ideal": {}, "weights": {}, "items": []}

    # Bước 1: dựng "máy trong mơ" từ mức ưu tiên (retriever.build_ideal_vector)
    ideal = build_ideal_vector(
        candidates, req.priorities.model_dump(), req.must, req.budget.model_dump(), req.segment
    )
    # Bước 2: trọng số từng đặc trưng theo ưu tiên + phân khúc (retriever.build_weights)
    weights = build_weights(
        req.priorities.model_dump(),
        req.segment,
        brand_weight=req.brandWeight,
        base_weights_override=req.baseWeightsOverride,
    )
    # Bước 3: kNN với metric một phía. Lọc MỀM phân khúc: phân khúc mong muốn chỉ là một đặc trưng
    # trong metric, không loại máy khác phân khúc (retriever.recommend)
    dist, idx = recommend(
        candidates, _state["scaler"], ideal, weights, req.topN, preferred_segment=req.segment
    )
    # Bước 4: đổi khoảng cách thành % dễ hiểu
    pct = match_pct(dist)

    picked = candidates.iloc[idx]
    items = []
    for rank, (dist_i, pct_i, (_, row)) in enumerate(zip(dist, pct, picked.iterrows()), start=1):
        # Bước 5: giải thích máy này hơn/kém máy trong mơ ở điểm nào
        explanation = build_explanation(row.to_dict(), ideal, weights, req.budget.max)
        items.append({
            "rank": rank,
            "laptopId": int(row["laptop_id"]),
            "distance": float(dist_i),
            "matchPct": round(float(pct_i), 1),
            "explanation": explanation,
        })

    return {"ideal": ideal, "weights": weights, "items": items, "modelVersion": registry.version}


@app.post("/similar")
def similar_endpoint(req: SimilarRequest) -> dict:
    """"Máy tương tự" ở trang Chi tiết: tìm k máy KHÁC giống máy đang xem nhất (item-item, không
    liên quan hồ sơ nhu cầu), dùng Euclidean hai phía (retriever.similar_items)."""
    catalog = _require_catalog()
    if req.laptopId not in catalog.index:
        raise HTTPException(status_code=404, detail="Khong tim thay laptop trong catalog da dong bo")
    # Vị trí hàng của máy đang xem, cần để tìm láng giềng của nó
    pos = catalog.index.get_loc(req.laptopId)
    # k+1 vì kết quả luôn gồm chính nó (khoảng cách 0), similar_items() sẽ bỏ phần tử đầu này
    dist, idx = similar_items(catalog, _state["scaler"], pos, k=req.k + 1)
    picked = catalog.iloc[idx]
    items = [
        {"laptopId": int(row["laptop_id"]), "distance": float(d)}
        for d, (_, row) in zip(dist, picked.iterrows())
    ]
    return {"items": items}


@app.post("/train")
def train_endpoint(req: TrainRequest) -> dict:
    """Kích hoạt huấn luyện lại Mô hình A + Mô hình C từ xa (thay cho `python -m app.lifecycle.train`).
    Import `train` trong hàm để tránh vòng lặp import và vì thao tác này nặng, hiếm khi gọi."""
    from app import train as train_module

    train_module.main()  # chạy cả pipeline: GridSearchCV, đánh giá, lưu artifact mới
    registry.activate_latest()  # nạp ngay artifact vừa tạo, không cần restart
    return {"version": registry.version, "metadata": registry.metadata}


@app.post("/models/{version}/activate")
def activate_model(version: str) -> dict:
    """Chuyển về một phiên bản mô hình cũ đã lưu (rollback). Mỗi artifact có thư mục riêng, không
    bao giờ bị ghi đè."""
    try:
        registry.activate(version)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return {"version": registry.version}


@app.get("/models/{version}")
def get_model(version: str) -> dict:
    """Xem chi tiết (tham số tốt nhất, macro-F1, confusion matrix,...) của một phiên bản mô hình."""
    try:
        return registry.load_metadata(version)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail="Khong tim thay version") from exc
