"""Mô hình A: kNN phân lớp, đoán phân khúc (OFFICE/ULTRABOOK/GAMING/CREATOR) cho một máy.

Dùng khi nhân viên thêm máy mới và khi Wizard suy phân khúc từ hoạt động (segment_inference.py).
k láng giềng gần nhất bỏ phiếu ra một nhãn; Mô hình B (retriever.py) thì trả luôn các láng giềng.
"""
from __future__ import annotations

import numpy as np
import pandas as pd
from sklearn.dummy import DummyClassifier
from sklearn.model_selection import GridSearchCV, StratifiedKFold
from sklearn.neighbors import KNeighborsClassifier
from sklearn.pipeline import Pipeline

from app.data.features import MODEL_A_FEATURES, build_model_a_preprocessor

RANDOM_STATE = 42  # cố định để chạy lại ra cùng kết quả

# Thử 64 tổ hợp = 16 k × 2 trọng số × 2 metric để tìm bộ tham số tốt nhất
# - k: 1→31 lẻ (đỡ hòa phiếu); có áp lực k quá nhỏ → khớp, k quá lớn → mất đặc điểm
# - weights: uniform (mỗi láng giềng 1 phiếu) vs distance (gần thì phiếu nặng hơn)
# - metric: euclidean (Pytago, giữ kích cỡ) vs manhattan (lưới, chịu ngoại lệ hơn)
PARAM_GRID = {  # 16 x 2 x 2 = 64 tổ hợp
    "knn__n_neighbors": list(range(1, 32, 2)),
    "knn__weights": ["uniform", "distance"],
    "knn__metric": ["euclidean", "manhattan"],
}


def build_pipeline() -> Pipeline:
    """Xây dựng quy trình: chuẩn hóa (log2 + z-score) → kNN. Chuẩn hóa nằm TRONG Pipeline để CV không bị rò rỉ dữ liệu."""
    return Pipeline([
        ("prep", build_model_a_preprocessor()),  # nhóm 1 (RAM/SSD): log2→z-score; nhóm 2 (7 cột): z-score; nhóm 3: giữ 0/1
        ("knn", KNeighborsClassifier()),  # tìm k láng giềng gần nhất, bỏ phiếu
    ])


def grid_search(X: pd.DataFrame, y: pd.Series) -> GridSearchCV:
    """Thử 64 tổ hợp (k, metric, weights) × 5 phần kiểm thử chéo = 320 lần; chọn bộ tốt nhất theo macro-F1."""
    pipe = build_pipeline()  # chuẩn hóa + kNN
    cv = StratifiedKFold(5, shuffle=True, random_state=RANDOM_STATE)  # 5 phần, mỗi phần giữ tỷ lệ 4 phân khúc
    search = GridSearchCV(
        pipe, PARAM_GRID, cv=cv, scoring="f1_macro", n_jobs=-1, return_train_score=True
    )
    search.fit(X[MODEL_A_FEATURES], y)  # 320 lần học trên 5 phần; rồi học lại bộ thắng trên toàn bộ X, y
    return search


def rule_based_baseline(X: pd.DataFrame) -> np.ndarray:
    """Mốc so sánh 2: luật if-else viết tay (không ML). Nếu kNN không thắng mốc này thì không đáng dùng."""
    preds = []
    p70_cpu = X["cpu_score"].quantile(0.70)
    for _, row in X.iterrows():
        if row["gpu_dedicated"] and row["refresh_hz"] >= 120:  # card rời + tần số cao → GAMING
            preds.append("GAMING")
        elif row["srgb_100"] and row["cpu_score"] >= p70_cpu:  # màn chuẩn màu + CPU mạnh → CREATOR
            preds.append("CREATOR")
        elif row["weight_kg"] <= 1.4:  # nhẹ → ULTRABOOK (mỏng nhẹ di động)
            preds.append("ULTRABOOK")
        else:  # còn lại → OFFICE (văn phòng)
            preds.append("OFFICE")
    return np.array(preds)


def dummy_baseline(y_train: pd.Series) -> DummyClassifier:
    """Mốc so sánh 1 (thấp nhất): luôn đoán lớp xuất hiện nhiều nhất trong tập học. macro-F1 ≈ 0.128."""
    clf = DummyClassifier(strategy="most_frequent")
    clf.fit(np.zeros((len(y_train), 1)), y_train)
    return clf


def k_curve(X: pd.DataFrame, y: pd.Series, best_weights: str, best_metric: str) -> list[dict]:
    """Vẽ đường cong macro-F1 khi thay k (1→31 lẻ), giữ metric/weights đã tìm được. Dùng để demo: k=7 cao nhất."""
    from sklearn.model_selection import cross_val_score

    curve = []
    cv = StratifiedKFold(5, shuffle=True, random_state=RANDOM_STATE)  # 5 phần để đánh giá ổn định
    for k in range(1, 32, 2):  # k lẻ: 1, 3, 5, 7, 9, ..., 31
        pipe = build_pipeline()
        pipe.set_params(knn__n_neighbors=k, knn__weights=best_weights, knn__metric=best_metric)
        scores = cross_val_score(pipe, X[MODEL_A_FEATURES], y, cv=cv, scoring="f1_macro", n_jobs=-1)
        curve.append({"k": k, "f1_macro_mean": float(scores.mean()), "f1_macro_std": float(scores.std())})
    return curve
