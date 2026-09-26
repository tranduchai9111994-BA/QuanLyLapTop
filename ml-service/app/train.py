"""Huan luyen Mo hinh A + luu artifact (docs/04 SS3, SS8). Chay: python -m app.train"""
from __future__ import annotations

import hashlib
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import joblib
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import sklearn
from sklearn.metrics import ConfusionMatrixDisplay, classification_report, confusion_matrix, f1_score
from sklearn.model_selection import train_test_split

from app.classifier import RANDOM_STATE, dummy_baseline, grid_search, k_curve, rule_based_baseline
from app.features import MODEL_A_FEATURES, enrich_catalog

ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = ROOT / "data"
ARTIFACTS_DIR = Path(__file__).resolve().parent.parent / "artifacts"


def dataset_hash(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def load_dataset() -> tuple[pd.DataFrame, Path]:
    catalog_path = DATA_DIR / "processed" / "catalog_vn.csv"
    catalog = pd.read_csv(catalog_path)
    cpu_bench = pd.read_csv(DATA_DIR / "processed" / "cpu_benchmark.csv")
    gpu_bench = pd.read_csv(DATA_DIR / "processed" / "gpu_benchmark.csv")
    enriched = enrich_catalog(catalog, cpu_bench, gpu_bench)
    return enriched, catalog_path


def main() -> int:
    df, catalog_path = load_dataset()
    X = df
    y = df["segment"]

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, stratify=y, random_state=RANDOM_STATE
    )

    golden_path = ARTIFACTS_DIR / "golden_test.csv"
    if not golden_path.exists():
        ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
        X_test.to_csv(golden_path, index=False)
        print(f"Da dong bang golden_test.csv ({len(X_test)} mau)")

    search = grid_search(X_train, y_train)
    best_pipe = search.best_estimator_
    best_params = search.best_params_
    print("Best params:", best_params)
    print(f"CV f1_macro mean={search.best_score_:.4f}")

    y_pred_test = best_pipe.predict(X_test[MODEL_A_FEATURES])
    test_f1_macro = f1_score(y_test, y_pred_test, average="macro")
    report = classification_report(y_test, y_pred_test, output_dict=True)
    cm = confusion_matrix(y_test, y_pred_test, labels=sorted(y.unique()))

    # baseline
    dummy = dummy_baseline(y_train)
    dummy_pred = dummy.predict(np.zeros((len(y_test), 1)))
    dummy_f1 = f1_score(y_test, dummy_pred, average="macro")

    rule_pred = rule_based_baseline(X_test)
    rule_f1 = f1_score(y_test, rule_pred, average="macro")

    curve = k_curve(X_train, y_train, best_params["knn__weights"], best_params["knn__metric"])

    version = f"clf-{datetime.now(timezone.utc).strftime('%Y.%m.%d-%H%M%S')}"
    out_dir = ARTIFACTS_DIR / version
    out_dir.mkdir(parents=True, exist_ok=True)
    joblib.dump(best_pipe, out_dir / "model.joblib")

    metadata = {
        "version": version,
        "type": "classifier",
        "trained_at": datetime.now(timezone.utc).isoformat(),
        "dataset_hash": dataset_hash(catalog_path),
        "n_samples": len(df),
        "class_counts": y.value_counts().to_dict(),
        "best_params": best_params,
        "cv_f1_macro_mean": float(search.best_score_),
        "cv_f1_macro_std": float(search.cv_results_["std_test_score"][search.best_index_]),
        "test_metrics": {"f1_macro": float(test_f1_macro), "report": report, "confusion_matrix": cm.tolist(), "labels": sorted(y.unique().tolist())},
        "baseline": {"dummy_f1_macro": float(dummy_f1), "rule_f1_macro": float(rule_f1)},
        "k_curve": curve,
        "feature_list": MODEL_A_FEATURES,
        "sklearn_version": sklearn.__version__,
    }
    (out_dir / "metadata.json").write_text(json.dumps(metadata, ensure_ascii=False, indent=2), encoding="utf-8")

    labels_sorted = sorted(y.unique())
    disp = ConfusionMatrixDisplay(confusion_matrix=cm, display_labels=labels_sorted)
    disp.plot(cmap="Blues", xticks_rotation=45)
    plt.title(f"Confusion matrix - {version}")
    plt.tight_layout()
    plt.savefig(out_dir / "confusion_matrix.png", dpi=150)
    plt.close()

    ks = [c["k"] for c in curve]
    means = [c["f1_macro_mean"] for c in curve]
    stds = [c["f1_macro_std"] for c in curve]
    plt.figure(figsize=(7, 4))
    plt.errorbar(ks, means, yerr=stds, marker="o", capsize=3)
    plt.axvline(best_params["knn__n_neighbors"], color="red", linestyle="--", label="k tot nhat")
    plt.xlabel("k (so lang gieng)")
    plt.ylabel("Macro-F1 (CV trung binh)")
    plt.title(f"Duong cong k - {version}")
    plt.legend()
    plt.tight_layout()
    plt.savefig(out_dir / "k_curve.png", dpi=150)
    plt.close()

    latest_path = ARTIFACTS_DIR / "LATEST"
    latest_path.write_text(version, encoding="utf-8")

    print(f"Test macro-F1={test_f1_macro:.4f} (muc tieu >= 0.75)")
    print(f"Vuot dummy: +{test_f1_macro - dummy_f1:.4f} (muc tieu >= 0.30)")
    print(f"Vuot luat: +{test_f1_macro - rule_f1:.4f} (muc tieu >= 0.05)")
    print(f"Da luu artifact -> {out_dir}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
