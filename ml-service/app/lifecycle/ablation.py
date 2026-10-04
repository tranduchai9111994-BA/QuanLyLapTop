"""Thi nghiem cat bo (docs/04 SS6.3) + xu ly mat can bang lop (SS5.3).
Chay: python -m app.lifecycle.ablation
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.metrics import f1_score
from sklearn.model_selection import StratifiedKFold, cross_val_score, train_test_split
from sklearn.neighbors import KNeighborsClassifier
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import FunctionTransformer, StandardScaler

from app.models.classifier import RANDOM_STATE, build_pipeline, grid_search
from app.data.features import BINARY, MODEL_A_FEATURES, NUMERIC, NUMERIC_LOG, enrich_catalog

ROOT = Path(__file__).resolve().parents[3]
DATA_DIR = ROOT / "data"
ARTIFACTS_DIR = Path(__file__).resolve().parents[2] / "artifacts"


def load_data() -> pd.DataFrame:
    catalog = pd.read_csv(DATA_DIR / "processed" / "catalog_vn.csv")
    cpu_bench = pd.read_csv(DATA_DIR / "processed" / "cpu_benchmark.csv")
    gpu_bench = pd.read_csv(DATA_DIR / "processed" / "gpu_benchmark.csv")
    return enrich_catalog(catalog, cpu_bench, gpu_bench)


def cv_f1(pipe, X, y) -> tuple[float, float]:
    cv = StratifiedKFold(5, shuffle=True, random_state=RANDOM_STATE)
    scores = cross_val_score(pipe, X, y, cv=cv, scoring="f1_macro", n_jobs=-1)
    return float(scores.mean()), float(scores.std())


def no_scaler_preprocessor() -> ColumnTransformer:
    """Bien the KHONG StandardScaler - minh chung 03 SS5.2."""
    return ColumnTransformer([
        ("log", Pipeline([("impute", SimpleImputer(strategy="median")),
                            ("log", FunctionTransformer(np.log2, feature_names_out="one-to-one"))]), NUMERIC_LOG),
        ("num", SimpleImputer(strategy="median"), NUMERIC),
        ("bin", "passthrough", BINARY),
    ])


def run_ablation(df: pd.DataFrame, best_k: int, best_weights: str, best_metric: str) -> list[dict]:
    X, y = df, df["segment"]
    results = []

    base_pipe = build_pipeline()
    base_pipe.set_params(knn__n_neighbors=best_k, knn__weights=best_weights, knn__metric=best_metric)
    mean, std = cv_f1(base_pipe, X[MODEL_A_FEATURES], y)
    results.append({"variant": "day_du (baseline)", "f1_macro_mean": mean, "f1_macro_std": std})

    no_scale_pipe = Pipeline([("prep", no_scaler_preprocessor()), ("knn", KNeighborsClassifier(
        n_neighbors=best_k, weights=best_weights, metric=best_metric))])
    mean, std = cv_f1(no_scale_pipe, X[MODEL_A_FEATURES], y)
    results.append({"variant": "khong StandardScaler", "f1_macro_mean": mean, "f1_macro_std": std})

    for drop_feat in ["refresh_hz", "srgb_100"]:
        feats = [f for f in MODEL_A_FEATURES if f != drop_feat]
        pipe = build_pipeline()
        # xay lai preprocessor thieu 1 cot
        num = [f for f in NUMERIC if f != drop_feat]
        binf = [f for f in BINARY if f != drop_feat]
        pipe.named_steps["prep"].transformers = [
            ("log", pipe.named_steps["prep"].transformers[0][1], NUMERIC_LOG),
            ("num", pipe.named_steps["prep"].transformers[1][1], num),
            ("bin", "passthrough", binf),
        ]
        pipe.set_params(knn__n_neighbors=best_k, knn__weights=best_weights, knn__metric=best_metric)
        mean, std = cv_f1(pipe, X[feats], y)
        results.append({"variant": f"bo {drop_feat}", "f1_macro_mean": mean, "f1_macro_std": std})

    manhattan_pipe = build_pipeline()
    manhattan_pipe.set_params(knn__n_neighbors=best_k, knn__weights=best_weights, knn__metric="manhattan")
    mean, std = cv_f1(manhattan_pipe, X[MODEL_A_FEATURES], y)
    results.append({"variant": "Manhattan thay Euclidean", "f1_macro_mean": mean, "f1_macro_std": std})

    return results


def run_imbalance_configs(df: pd.DataFrame, best_k: int, best_metric: str) -> list[dict]:
    X, y = df, df["segment"]
    results = []

    for weights_mode in ["uniform", "distance"]:
        pipe = build_pipeline()
        pipe.set_params(knn__n_neighbors=best_k, knn__weights=weights_mode, knn__metric=best_metric)
        mean, std = cv_f1(pipe, X[MODEL_A_FEATURES], y)
        results.append({"config": f"weights={weights_mode}", "f1_macro_mean": mean, "f1_macro_std": std})

    try:
        from imblearn.over_sampling import RandomOverSampler
        from imblearn.pipeline import Pipeline as ImbPipeline

        from app.data.features import build_model_a_preprocessor

        imb_pipe = ImbPipeline([
            ("prep", build_model_a_preprocessor()),
            ("oversample", RandomOverSampler(random_state=RANDOM_STATE)),
            ("knn", KNeighborsClassifier(n_neighbors=best_k, weights="uniform", metric=best_metric)),
        ])
        mean, std = cv_f1(imb_pipe, X[MODEL_A_FEATURES], y)
        results.append({"config": "RandomOverSampler (trong pipeline)", "f1_macro_mean": mean, "f1_macro_std": std})
    except ImportError:
        results.append({"config": "RandomOverSampler", "error": "imbalanced-learn chua cai dat"})

    return results


def main() -> int:
    df = load_data()
    X_train, _, y_train, _ = train_test_split(
        df, df["segment"], test_size=0.2, stratify=df["segment"], random_state=RANDOM_STATE
    )
    search = grid_search(X_train, y_train)
    best = search.best_params_
    print("Dung tham so tot nhat tu grid search:", best)

    ablation = run_ablation(df, best["knn__n_neighbors"], best["knn__weights"], best["knn__metric"])
    imbalance = run_imbalance_configs(df, best["knn__n_neighbors"], best["knn__metric"])

    print("\n=== Thi nghiem cat bo (ablation) ===")
    for r in ablation:
        print(f"  {r['variant']:<30} f1_macro={r['f1_macro_mean']:.4f} (+/-{r['f1_macro_std']:.4f})")

    print("\n=== Cau hinh mat can bang lop ===")
    for r in imbalance:
        if "error" in r:
            print(f"  {r['config']:<30} {r['error']}")
        else:
            print(f"  {r['config']:<30} f1_macro={r['f1_macro_mean']:.4f} (+/-{r['f1_macro_std']:.4f})")

    out = {"best_params": best, "ablation": ablation, "imbalance": imbalance}
    latest = (ARTIFACTS_DIR / "LATEST")
    if latest.exists():
        out_path = ARTIFACTS_DIR / latest.read_text().strip() / "experiments.json"
        out_path.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"\nDa luu -> {out_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
