"""FastAPI routes cho ML service (docs/06 SS4).

File nay la "cong vao" duy nhat cua toan bo ML service - moi request tu backend (Node.js) deu di
qua day. No KHONG chua logic thuat toan (dieu do nam o retriever.py/classifier.py/text_classifier.py),
chi lam nhiem vu: nhan request -> goi dung ham thuat toan -> tra ve JSON. Bien duy nhat luu TRANG
THAI trong bo nho la `_state` (dict o duoi) - vi day la 1 tien trinh Python song song voi backend,
KHONG dung chung DB, nen catalog/scaler/model phai duoc "day" (sync) tu backend sang qua
`/catalog/sync` moi khi du lieu doi, roi giu trong RAM cho cac request `/recommend` sau do dung.
"""
from __future__ import annotations

from datetime import datetime, timezone

import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException

from app.explain import build_explanation
from app.features import MODEL_A_FEATURES, MODEL_B_FEATURES
from app.registry import registry
from app.retriever import build_ideal_vector, build_weights, fit_scaler, match_pct, recommend, similar_items
from app.schemas import CatalogSyncRequest, PredictSegmentRequest, RecommendRequest, SimilarRequest, TrainRequest
from app.segment_inference import infer_segment
from app.text_classifier import NeedTextModel

app = FastAPI(title="SmartLap ML service")

# "Bo nho lam viec" cua ca service - khong phai database, se MAT SACH neu tat process (do la ly do
# backend luon phai goi lai /catalog/sync moi khi khoi dong lai ML service, xem snapshotSync.ts):
#   catalog       : DataFrame toan bo laptop dang ban, da duoc lam giau dac trung (Mo hinh B dung)
#   scaler        : StandardScaler da "hoc" thong ke (trung binh/do lech chuan) tren catalog nay
#   index_built_at: thoi diem catalog duoc dong bo lan gan nhat (backend/frontend hien thi de biet
#                   du lieu goi y co "cu" khong)
#   text_model    : Mo hinh C (TF-IDF+kNN) da huan luyen san, dung cho o nhap cau tu do
_state: dict = {"catalog": None, "scaler": None, "index_built_at": None, "text_model": None}


@app.on_event("startup")
def on_startup() -> None:
    # Nap mo hinh phan lop (Mo hinh A) MOI NHAT da luu tren dia (khong huan luyen lai luc khoi
    # dong - train.py chi chay khi goi rieng /train hoac `python -m app.train`)
    registry.activate_latest()
    # Mo hinh C nhe (132 cau) nen huan luyen ngay luc khoi dong, khong can nap tu artifact
    _state["text_model"] = NeedTextModel(n_neighbors=7).fit()


@app.get("/health")
def health() -> dict:
    """Kiem tra nhanh service con song khong, dang dung phien ban mo hinh nao, catalog da dong
    bo chua - dung boi launcher (start-smartlap.ps1) va cac cong cu debug thu cong (curl)."""
    catalog = _state["catalog"]
    return {
        "status": "ok",
        "clfVersion": registry.version,
        "catalogSize": 0 if catalog is None else len(catalog),
        "indexBuiltAt": _state["index_built_at"],
    }


@app.post("/catalog/sync")
def catalog_sync(req: CatalogSyncRequest) -> dict:
    """Nhan TOAN BO danh sach laptop dang ban tu backend (goi moi khi co may moi/sua gia/deploy
    lai), thay the HOAN TOAN catalog dang giu trong bo nho, roi fit lai scaler tren du lieu moi.

    Day KHONG phai dong bo GIA TANG DAN (incremental) - la thay the toan bo 1 lan, don gian va
    it loi hon nhieu so voi cap nhat tung phan, chap nhan doi voi quy mo ~1000 may cua do an.
    """
    df = pd.DataFrame(req.items)
    # Doi ten "id" (ten cot backend gui) -> "laptop_id" (ten noi bo cac ham retriever.py dung),
    # dong thoi dat lam index de tra cuu nhanh theo id (vd trong /similar ben duoi)
    df = df.rename(columns={"id": "laptop_id"}).set_index("laptop_id", drop=False)

    # Backend gui `discount_percent` (co san, tinh don gian tu 2 gia) va `sales_count` THO.
    # sales_count can duoc quy doi ve `sales_score` (thang 0-100, LOG hoa) NGAY TAI DAY vi phep
    # tinh nay phu thuoc gia tri MAX cua CA SNAPSHOT (giong cach lam trong features.enrich_catalog
    # khi huan luyen tu CSV) - khong the tinh truoc o backend cho tung may rieng le.
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
    """Ham dung chung: bat cu endpoint nao can doc catalog deu goi ham nay truoc, de bao loi ro
    rang (409 - "chua san sang") thay vi crash mo ho neu ai do goi /recommend truoc /catalog/sync."""
    if _state["catalog"] is None:
        raise HTTPException(status_code=409, detail="Catalog chua duoc dong bo (/catalog/sync)")
    return _state["catalog"]


@app.post("/predict-segment")
def predict_segment(req: PredictSegmentRequest) -> dict:
    """Mo hinh A: cho 1 hoac nhieu cau hinh laptop, du doan PHAN KHUC (Gaming/Office/...) kem xac
    suat tung nhan - dung khi nhan vien them may MOI vao he thong (chua ai gan nhan tay)."""
    if registry.model is None:
        raise HTTPException(status_code=503, detail="Chua co mo hinh phan lop duoc kich hoat")
    X = pd.DataFrame(req.items)
    # Neu request thieu cot nao trong dac trung Mo hinh A can (vd may moi chua co du lieu day
    # du), dien 0 tam de khong bi loi thieu cot - chap nhan do chinh xac giam nhe cho truong hop
    # hiem gap nay, con hon la tra loi 500 cho ca request
    for col in MODEL_A_FEATURES:
        if col not in X.columns:
            X[col] = 0
    proba = registry.model.predict_proba(X[MODEL_A_FEATURES])
    labels = registry.model.classes_

    # FR-09: lay chinh k lang gieng da "bo phieu" - dua qua buoc chuan hoa ("prep") roi hoi buoc
    # kNN. `knn._y` la nhan (da ma hoa thanh so) cua tap huan luyen, sklearn luu san sau khi fit;
    # doi lai ra ten phan khuc bang `knn.classes_`. Dung de nhan vien thay DUOC ly do mo hinh
    # chon nhan nay (vd "5/7 may gan nhat la Gaming"), khong phai 1 con so hop den.
    prep = registry.model.named_steps["prep"]
    knn = registry.model.named_steps["knn"]
    neigh_dist, neigh_idx = knn.kneighbors(prep.transform(X[MODEL_A_FEATURES]))
    train_labels = knn.classes_[knn._y]

    results = []
    for row_i, row_proba in enumerate(proba):
        # Sap xep xac suat GIAM DAN de lay nhan co xac suat cao nhat len dau (order[0])
        order = np.argsort(row_proba)[::-1]
        results.append({
            "label": labels[order[0]],
            "proba": float(row_proba[order[0]]),
            # Tra ve CA PHAN BO xac suat (khong chi 1 nhan) de frontend hien thi "89% Gaming, 11%
            # Do hoa" - giup nhan vien thay duoc muc do CHAC CHAN cua du doan, khong chi 1 con so
            "distribution": {labels[i]: float(row_proba[i]) for i in order},
            "neighbors": [
                {"label": str(train_labels[j]), "distance": round(float(d), 4)}
                for j, d in zip(neigh_idx[row_i], neigh_dist[row_i])
            ],
        })
    return {"items": results, "modelVersion": registry.version}


@app.post("/parse-need")
def parse_need_endpoint(payload: dict) -> dict:
    """{text: "con hoc ke toan, can may ben, re"} -> ho so nhu cau day du (Mo hinh C).

    Day la duong vao "thong minh" thay cho viec nguoi dung tu keo thanh truot: he thong doc
    cau noi tu nhien roi TU suy ra nhom nhu cau, muc uu tien, ngan sach va rang buoc.
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
    """{activities: [...]}. -> suy phan khuc tu hoat dong khi nguoi dung chon 'Chua ro'."""
    catalog = _require_catalog()
    if registry.model is None:
        raise HTTPException(status_code=503, detail="Chua co mo hinh phan lop duoc kich hoat")
    activities = payload.get("activities", [])
    result = infer_segment(registry.model, catalog, activities)
    result["modelVersion"] = registry.version
    return result


@app.post("/recommend")
def recommend_endpoint(req: RecommendRequest) -> dict:
    """Mo hinh B: dau vao la ho so nhu cau day du (ngan sach, muc uu tien, phan khuc mong muon,
    rang buoc bat buoc) + danh sach `candidateIds` (may da qua LOC CUNG o backend - ngan sach,
    RAM toi thieu,...), tra ve TOP-N may gan nhat kem % phu hop va giai thich. Day la ham duoc
    goi khi nguoi dung bam "Xem ket qua" tren man Wizard.
    """
    catalog = _require_catalog()
    # Chi xet trong so may DA duoc backend loc cung san (ngan sach, RAM toi thieu,...) - Mo hinh
    # B khong tu loc lai tu dau, chi xep hang trong tap ung vien da duoc thu hep
    candidates = catalog.loc[catalog["laptop_id"].isin(req.candidateIds)]
    if candidates.empty:
        return {"ideal": {}, "weights": {}, "items": []}

    # Buoc 1: dung "may trong mo" tu muc uu tien (xem retriever.build_ideal_vector)
    ideal = build_ideal_vector(
        candidates, req.priorities.model_dump(), req.must, req.budget.model_dump(), req.segment
    )
    # Buoc 2: tinh trong so tung dac trung theo muc uu tien + phan khuc (xem retriever.build_weights)
    weights = build_weights(
        req.priorities.model_dump(),
        req.segment,
        brand_weight=req.brandWeight,
        base_weights_override=req.baseWeightsOverride,
    )
    # Buoc 3: chay kNN that su voi metric mot phia. Loc MEM phan khuc: phan khuc mong muon la
    # mot dac trung trong metric, khong loai bo ung vien khac phan khuc (xem retriever.recommend)
    dist, idx = recommend(
        candidates, _state["scaler"], ideal, weights, req.topN, preferred_segment=req.segment
    )
    # Buoc 4: doi khoang cach kNN (con so kho hieu voi nguoi dung thuong) thanh % de hien thi
    pct = match_pct(dist)

    picked = candidates.iloc[idx]
    items = []
    for rank, (dist_i, pct_i, (_, row)) in enumerate(zip(dist, pct, picked.iterrows()), start=1):
        # Buoc 5: sinh giai thich (may nay hon/kem may trong mo o diem nao) cho tung may trong top-N
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
    """"May tuong tu" tren trang Chi tiet: cho 1 laptop dang xem, tim k may KHAC giong no nhat
    (item-item, khong lien quan gi den ho so nhu cau nguoi dung) - dung Euclidean hai phia thong
    thuong (xem retriever.similar_items), khac voi /recommend dung khoang cach mot phia."""
    catalog = _require_catalog()
    if req.laptopId not in catalog.index:
        raise HTTPException(status_code=404, detail="Khong tim thay laptop trong catalog da dong bo")
    # Vi tri (so thu tu hang) cua may dang xem trong DataFrame - can de tim lang gieng CUA no
    pos = catalog.index.get_loc(req.laptopId)
    # k+1 vi ket qua tra ve LUON GOM CHINH NO (khoang cach 0, hang dau) - similar_items() se tu
    # bo phan tu dau nay, nen phai xin thua 1 tu dau de con lai dung k may THAT SU khac no
    dist, idx = similar_items(catalog, _state["scaler"], pos, k=req.k + 1)
    picked = catalog.iloc[idx]
    items = [
        {"laptopId": int(row["laptop_id"]), "distance": float(d)}
        for d, (_, row) in zip(dist, picked.iterrows())
    ]
    return {"items": items}


@app.post("/train")
def train_endpoint(req: TrainRequest) -> dict:
    """Kich hoat huan luyen lai Mo hinh A + Mo hinh C tu xa (khong can vao terminal go
    `python -m app.train`) - dung khi admin muon huan luyen lai ngay sau khi sua nhieu du lieu.
    Import `train` NGAY TRONG ham (khong import o dau file) de tranh vong lap import va vi day
    la thao tac NANG, hiem khi goi, khong can tai san luc khoi dong service."""
    from app import train as train_module

    train_module.main()  # chay toan bo pipeline: GridSearchCV, danh gia, luu artifact moi ra dia
    registry.activate_latest()  # nap artifact VUA tao ngay lap tuc, khong can restart service
    return {"version": registry.version, "metadata": registry.metadata}


@app.post("/models/{version}/activate")
def activate_model(version: str) -> dict:
    """Chuyen ve dung 1 phien ban mo hinh CU da luu (vd ban moi train te hon, muon quay lai ban
    truoc) - moi artifact duoc luu voi ten thu muc rieng (vd `clf-2026.09.27-...`), khong bao gio
    bi ghi de, nen luon "rollback" duoc."""
    try:
        registry.activate(version)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return {"version": registry.version}


@app.get("/models/{version}")
def get_model(version: str) -> dict:
    """Xem thong tin chi tiet (tham so tot nhat, macro-F1, confusion matrix,...) cua 1 phien ban
    mo hinh CU THE - dung khi muon so sanh nhieu lan train voi nhau."""
    try:
        return registry.load_metadata(version)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail="Khong tim thay version") from exc
