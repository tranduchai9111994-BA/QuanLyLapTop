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

# Tham số thử: k lẻ cho đỡ hòa phiếu; uniform = mỗi láng giềng 1 phiếu, distance = gần thì phiếu nặng hơn;
# euclidean = đường thẳng, manhattan = cộng độ lệch từng cột
PARAM_GRID = {  # 16 x 2 x 2 = 64 tổ hợp
    "knn__n_neighbors": list(range(1, 32, 2)),
    "knn__weights": ["uniform", "distance"],
    "knn__metric": ["euclidean", "manhattan"],
}


def build_pipeline() -> Pipeline:
    """Chuẩn hóa rồi kNN. Chuẩn hóa nằm trong Pipeline để kiểm thử chéo không bị rò rỉ dữ liệu."""
    return Pipeline([
        ("prep", build_model_a_preprocessor()),
        ("knn", KNeighborsClassifier()),
    ])


def grid_search(X: pd.DataFrame, y: pd.Series) -> GridSearchCV:
    """Thử mọi tổ hợp trong PARAM_GRID, chọn bộ có macro-F1 trung bình cao nhất."""
    pipe = build_pipeline()
    cv = StratifiedKFold(5, shuffle=True, random_state=RANDOM_STATE)  # 5 phần, mỗi phần giữ tỷ lệ phân khúc
    # mỗi tổ hợp học 5 lần, chấm trên phần bị bỏ ra, lấy trung bình 5 điểm
    search = GridSearchCV(
        pipe, PARAM_GRID, cv=cv, scoring="f1_macro", n_jobs=-1, return_train_score=True
    )
    search.fit(X[MODEL_A_FEATURES], y)  # 64 x 5 = 320 lần học, rồi học lại bộ thắng trên toàn bộ dữ liệu
    return search


def rule_based_baseline(X: pd.DataFrame) -> np.ndarray:
    """Mốc so sánh: luật if-else viết tay, kNN phải hơn mốc này mới đáng dùng."""
    preds = []
    p70_cpu = X["cpu_score"].quantile(0.70)
    for _, row in X.iterrows():
        if row["gpu_dedicated"] and row["refresh_hz"] >= 120:
            preds.append("GAMING")
        elif row["srgb_100"] and row["cpu_score"] >= p70_cpu:
            preds.append("CREATOR")
        elif row["weight_kg"] <= 1.4:
            preds.append("ULTRABOOK")
        else:
            preds.append("OFFICE")
    return np.array(preds)


def dummy_baseline(y_train: pd.Series) -> DummyClassifier:
    """Mốc thấp nhất: luôn đoán nhãn xuất hiện nhiều nhất."""
    clf = DummyClassifier(strategy="most_frequent")
    clf.fit(np.zeros((len(y_train), 1)), y_train)
    return clf


def k_curve(X: pd.DataFrame, y: pd.Series, best_weights: str, best_metric: str) -> list[dict]:
    """macro-F1 theo từng k (giữ weights/metric đã chọn), dùng vẽ đường cong chọn k trong báo cáo."""
    from sklearn.model_selection import cross_val_score

    curve = []
    cv = StratifiedKFold(5, shuffle=True, random_state=RANDOM_STATE)
    for k in range(1, 32, 2):
        pipe = build_pipeline()
        pipe.set_params(knn__n_neighbors=k, knn__weights=best_weights, knn__metric=best_metric)
        scores = cross_val_score(pipe, X[MODEL_A_FEATURES], y, cv=cv, scoring="f1_macro", n_jobs=-1)
        curve.append({"k": k, "f1_macro_mean": float(scores.mean()), "f1_macro_std": float(scores.std())})
    return curve
