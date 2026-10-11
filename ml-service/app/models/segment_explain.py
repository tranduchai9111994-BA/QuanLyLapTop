"""Số liệu để giao diện giải thích "vì sao máy này ra X%" bằng toán học (nút "!" ở SegmentSuggester).

Mô hình A = chuẩn hóa -> kNN. Giao diện cần đủ số để người xem tự kiểm tra từng bước:
  1) đổi giá trị gốc sang z-score (cần trung bình, độ lệch chuẩn đã học trên máy huấn luyện),
  2) hiệu từng cột giữa máy đang xét và từng láng giềng,
  3) cộng lại thành khoảng cách, rồi đếm phiếu.
Module này chỉ ĐỌC từ Pipeline đã huấn luyện, không đổi gì trong mô hình.
"""
from __future__ import annotations

import numpy as np
import pandas as pd
from sklearn.pipeline import Pipeline

from app.data.features import BINARY, MODEL_A_FEATURES, NUMERIC, NUMERIC_LOG


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


def build_explain(pipeline: Pipeline, X_row: pd.Series, z_row: np.ndarray, neighbor_idx: np.ndarray) -> dict:
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
    }
