"""Số liệu để giao diện giải thích "vì sao máy này ra X%" bằng toán học (nút "!" ở SegmentSuggester).

Mô hình A = chuẩn hóa -> kNN. Giao diện cần đủ số để người xem tự kiểm tra từng bước:
  1) đổi giá trị gốc sang z-score (cần trung bình, độ lệch chuẩn đã học trên máy huấn luyện),
  2) hiệu từng cột giữa máy đang xét và từng láng giềng,
  3) cộng lại thành khoảng cách, rồi đếm phiếu.
Module này chỉ ĐỌC từ Pipeline đã huấn luyện, không đổi gì trong mô hình.
"""
from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline

from app.data.features import BINARY, MODEL_A_FEATURES, NUMERIC, NUMERIC_LOG, enrich_catalog

PROCESSED_DIR = Path(__file__).resolve().parents[3] / "data" / "processed"  # D:\QL_Laptop\data\processed
RANDOM_STATE = 42  # phải trùng classifier.RANDOM_STATE / cách chia ở lifecycle/train.py
_names_cache: dict[int, list[str] | None] = {}


def scaling_info(pipeline: Pipeline) -> list[dict]:
    """Với mỗi đặc trưng: cách xử lý (log2 + z-score / z-score / giữ nguyên 0-1) và trung bình, độ lệch chuẩn đã học."""
    prep = pipeline.named_steps["prep"]
    log_sc = prep.named_transformers_["log"].named_steps["sc"]
    num_sc = prep.named_transformers_["num"].named_steps["sc"]
    info: list[dict] = []
    for name, mean, std in zip(NUMERIC_LOG, log_sc.mean_, log_sc.scale_):
        info.append({"feature": name, "kind": "log2_z", "mean": float(mean), "std": float(std)})
    for name, mean, std in zip(NUMERIC, num_sc.mean_, num_sc.scale_):
        info.append({"feature": name, "kind": "z", "mean": float(mean), "std": float(std)})
    for name in BINARY:
        info.append({"feature": name, "kind": "keep", "mean": None, "std": None})
    return info  # thứ tự khớp MODEL_A_FEATURES (cũng là thứ tự cột sau ColumnTransformer)


def z_to_raw(z_row: np.ndarray, scaling: list[dict]) -> list[float]:
    """Đổi một dòng z-score về giá trị gốc (ngược của log2 + z-score). Cột 0/1 giữ nguyên."""
    raw: list[float] = []
    for z, s in zip(z_row, scaling):
        if s["kind"] == "keep":
            raw.append(float(z))
            continue
        value = float(z) * s["std"] + s["mean"]
        raw.append(float(2 ** value) if s["kind"] == "log2_z" else value)
    return raw


def training_names(pipeline: Pipeline) -> list[str] | None:
    """Tên 800 máy mà mô hình đã ghi nhớ, theo đúng thứ tự các dòng của `knn._fit_X`; None nếu không dựng lại chắc chắn được.

    Mô hình chỉ lưu SỐ, không lưu tên. Cách dựng lại: đọc `catalog_vn.csv`, chia 80/20 đúng như lúc huấn luyện
    (seed 42, giữ tỷ lệ phân khúc) rồi lấy tên của 80%. Chỉ dùng kết quả khi CẢ HAI điều kiện đúng: số liệu chuẩn hóa của các máy
    đó trùng khít `knn._fit_X` và nhãn trùng `knn._y`. File CSV đã đổi sau khi huấn luyện thì không trùng, hàm trả None
    (giao diện chỉ hiện "#1", "#2", không hiện tên sai)."""
    key = id(pipeline)
    if key not in _names_cache:
        _names_cache[key] = _rebuild_training_names(pipeline)
    return _names_cache[key]


def _rebuild_training_names(pipeline: Pipeline) -> list[str] | None:
    try:
        catalog = pd.read_csv(PROCESSED_DIR / "catalog_vn.csv")
        df = enrich_catalog(catalog, pd.read_csv(PROCESSED_DIR / "cpu_benchmark.csv"), pd.read_csv(PROCESSED_DIR / "gpu_benchmark.csv"))
        train, _ = train_test_split(df, test_size=0.2, stratify=df["segment"], random_state=RANDOM_STATE)
        knn = pipeline.named_steps["knn"]
        if len(train) != knn._fit_X.shape[0]:
            return None
        same_x = np.allclose(pipeline.named_steps["prep"].transform(train[MODEL_A_FEATURES]), knn._fit_X, atol=1e-6)
        same_y = bool((knn.classes_[knn._y] == train["segment"].to_numpy()).all())
        return train["name"].astype(str).tolist() if same_x and same_y else None
    except Exception:  # thiếu file, sai định dạng...: không có tên thì thôi, không làm hỏng dự đoán
        return None


def build_explain(
    pipeline: Pipeline,
    X_row: pd.Series,
    z_row: np.ndarray,
    neighbor_idx: np.ndarray,
    train_names: list[str] | None = None,
) -> dict:
    """Gói số liệu giải thích cho MỘT máy: tham số mô hình, cách chuẩn hóa, giá trị gốc + z của máy đang xét,
    và z + giá trị gốc của từng láng giềng (cùng thứ tự với `neighbors` trong kết quả dự đoán)."""
    knn = pipeline.named_steps["knn"]
    scaling = scaling_info(pipeline)
    neighbors_z = knn._fit_X[neighbor_idx]  # (k, 11): các máy huấn luyện đã chuẩn hóa
    return {
        "model": {
            "k": int(knn.n_neighbors),
            "metric": str(knn.metric),
            "weights": knn.weights if isinstance(knn.weights, str) else "uniform",
            "n_train": int(knn._fit_X.shape[0]),
        },
        "features": list(MODEL_A_FEATURES),
        "scaling": scaling,
        "inputs": [float(X_row[c]) for c in MODEL_A_FEATURES],
        "query_z": [round(float(v), 6) for v in z_row],
        "neighbors_z": [[round(float(v), 6) for v in row] for row in neighbors_z],
        "neighbors_raw": [[round(v, 4) for v in z_to_raw(row, scaling)] for row in neighbors_z],
        # Tên từng láng giềng (cùng thứ tự); None nếu không dựng lại chắc chắn được (xem training_names)
        "neighbors_name": [train_names[int(j)] for j in neighbor_idx] if train_names else None,
    }
