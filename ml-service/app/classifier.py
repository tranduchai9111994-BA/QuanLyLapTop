"""Mo hinh A: kNN phan lop phan khuc (docs/04 SS3)."""
from __future__ import annotations

import numpy as np
import pandas as pd
from sklearn.dummy import DummyClassifier
from sklearn.model_selection import GridSearchCV, StratifiedKFold
from sklearn.neighbors import KNeighborsClassifier
from sklearn.pipeline import Pipeline

from app.features import MODEL_A_FEATURES, build_model_a_preprocessor

RANDOM_STATE = 42

PARAM_GRID = {
    "knn__n_neighbors": list(range(1, 32, 2)),
    "knn__weights": ["uniform", "distance"],
    "knn__metric": ["euclidean", "manhattan"],
}


def build_pipeline() -> Pipeline:
    return Pipeline([
        ("prep", build_model_a_preprocessor()),
        ("knn", KNeighborsClassifier()),
    ])


def grid_search(X: pd.DataFrame, y: pd.Series) -> GridSearchCV:
    pipe = build_pipeline()
    cv = StratifiedKFold(5, shuffle=True, random_state=RANDOM_STATE)
    search = GridSearchCV(
        pipe, PARAM_GRID, cv=cv, scoring="f1_macro", n_jobs=-1, return_train_score=True
    )
    search.fit(X[MODEL_A_FEATURES], y)
    return search


def rule_based_baseline(X: pd.DataFrame) -> np.ndarray:
    """Luat thu cong doi chung (docs/04 SS6.1)."""
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
    clf = DummyClassifier(strategy="most_frequent")
    clf.fit(np.zeros((len(y_train), 1)), y_train)
    return clf


def k_curve(X: pd.DataFrame, y: pd.Series, best_weights: str, best_metric: str) -> list[dict]:
    """Macro-F1 CV theo k, dung cho duong cong (docs/04 SS5.1)."""
    from sklearn.model_selection import cross_val_score

    curve = []
    cv = StratifiedKFold(5, shuffle=True, random_state=RANDOM_STATE)
    for k in range(1, 32, 2):
        pipe = build_pipeline()
        pipe.set_params(knn__n_neighbors=k, knn__weights=best_weights, knn__metric=best_metric)
        scores = cross_val_score(pipe, X[MODEL_A_FEATURES], y, cv=cv, scoring="f1_macro", n_jobs=-1)
        curve.append({"k": k, "f1_macro_mean": float(scores.mean()), "f1_macro_std": float(scores.std())})
    return curve
