"""Huấn luyện Mô hình A và C rồi lưu thành phiên bản mới (docs/04 SS3, SS8). Chạy: python -m app.lifecycle.train"""
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

from app.models.classifier import RANDOM_STATE, dummy_baseline, grid_search, k_curve, rule_based_baseline
from app.data.data_check import check_catalog_format
from app.data.features import MODEL_A_FEATURES, enrich_catalog
from app.models.text_classifier import NeedTextModel, build_text_pipeline, normalize_text

ROOT = Path(__file__).resolve().parents[3]
DATA_DIR = ROOT / "data"
ARTIFACTS_DIR = Path(__file__).resolve().parents[2] / "artifacts"


def dataset_hash(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def load_dataset() -> tuple[pd.DataFrame, Path]:
    catalog_path = DATA_DIR / "processed" / "catalog_vn.csv"
    catalog = pd.read_csv(catalog_path)
    format_errors = check_catalog_format(catalog)
    if format_errors:  # báo rõ nguyên nhân thay vì lỗi KeyError khó hiểu
        raise ValueError("File catalog_vn.csv sai định dạng: " + " | ".join(format_errors))
    cpu_bench = pd.read_csv(DATA_DIR / "processed" / "cpu_benchmark.csv")
    gpu_bench = pd.read_csv(DATA_DIR / "processed" / "gpu_benchmark.csv")
    enriched = enrich_catalog(catalog, cpu_bench, gpu_bench)
    return enriched, catalog_path


def run_training() -> dict:
    """Huấn luyện + lưu phiên bản mới, trả về metadata của bản vừa train (KHÔNG đổi mô hình đang dùng)."""
    df, catalog_path = load_dataset()  # Bước 1: đọc CSV 1.000 máy, tra điểm CPU/GPU để có các cột số
    X = df
    y = df["segment"]

    # Bước 2: chia 80% (800 máy) để học, 20% (200 máy) để kiểm tra; giữ đúng tỷ lệ 4 phân khúc
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, stratify=y, random_state=RANDOM_STATE
    )

    golden_path = ARTIFACTS_DIR / "golden_test.csv"  # đóng băng tập kiểm tra ở lần train đầu tiên
    if not golden_path.exists():
        ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
        X_test.to_csv(golden_path, index=False)
        print(f"Da dong bang golden_test.csv ({len(X_test)} mau)")

    search = grid_search(X_train, y_train)  # Bước 3: thử mọi tổ hợp (k, cách đo, trọng số phiếu), chấm bằng kiểm thử chéo 5 phần
    best_pipe = search.best_estimator_
    best_params = search.best_params_
    print("Best params:", best_params)
    print(f"CV f1_macro mean={search.best_score_:.4f}")

    y_pred_test = best_pipe.predict(X_test[MODEL_A_FEATURES])  # Bước 4: chấm điểm trên 200 máy chưa từng thấy
    test_f1_macro = f1_score(y_test, y_pred_test, average="macro")
    report = classification_report(y_test, y_pred_test, output_dict=True)
    cm = confusion_matrix(y_test, y_pred_test, labels=sorted(y.unique()))

    # Bước 5: 2 mốc so sánh (đoán lớp đông nhất / luật if-else tự viết)
    dummy = dummy_baseline(y_train)
    dummy_pred = dummy.predict(np.zeros((len(y_test), 1)))
    dummy_f1 = f1_score(y_test, dummy_pred, average="macro")

    rule_pred = rule_based_baseline(X_test)
    rule_f1 = f1_score(y_test, rule_pred, average="macro")

    # Bước 6: tính đường cong chọn k (macro-F1 theo từng k) để vẽ biểu đồ
    curve = k_curve(X_train, y_train, best_params["knn__weights"], best_params["knn__metric"])

    # Bước 7: lưu mô hình vào thư mục phiên bản mới (tên theo ngày giờ), không ghi đè bản cũ
    version = f"clf-{datetime.now(timezone.utc).strftime('%Y.%m.%d-%H%M%S')}"
    out_dir = ARTIFACTS_DIR / version
    out_dir.mkdir(parents=True, exist_ok=True)
    joblib.dump(best_pipe, out_dir / "model.joblib")

    # Bước 8: ghi tham số tốt nhất, điểm số, số mẫu... vào metadata.json (file đọc được bằng VS Code)
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

    # Bước 9: vẽ 2 ảnh (ma trận nhầm lẫn, đường cong k) để dùng cho slide
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

    # Bước 10: huấn luyện Mô hình C (phân loại câu nhu cầu tự do, TF-IDF + kNN)
    text_meta = train_text_model(out_dir)
    metadata["text_model"] = text_meta
    (out_dir / "metadata.json").write_text(json.dumps(metadata, ensure_ascii=False, indent=2), encoding="utf-8")

    # Bước 11: chỉ khi CHƯA có bản nào đang dùng (lần huấn luyện đầu tiên) mới ghi LATEST; các lần sau
    # LATEST chỉ đổi khi bấm "Đưa vào sử dụng" (registry.save_latest), để huấn luyện không tự thay mô hình
    latest_path = ARTIFACTS_DIR / "LATEST"
    if not latest_path.exists():
        latest_path.write_text(version, encoding="utf-8")

    print(f"Test macro-F1={test_f1_macro:.4f} (muc tieu >= 0.75)")
    print(f"Vuot dummy: +{test_f1_macro - dummy_f1:.4f} (muc tieu >= 0.30)")
    print(f"Vuot luat: +{test_f1_macro - rule_f1:.4f} (muc tieu >= 0.05)")
    print(f"Mo hinh C (cau tu do): k={text_meta['best_k']}, CV macro-F1={text_meta['cv_f1_macro']:.4f}, "
          f"{text_meta['n_samples']} cau")
    print(f"Da luu artifact -> {out_dir}")
    return metadata


def main() -> int:
    run_training()
    return 0


def train_text_model(out_dir: Path) -> dict:
    """Huấn luyện Mô hình C trên tập câu nhu cầu, chọn k bằng kiểm thử chéo, lưu thành joblib."""
    from sklearn.model_selection import StratifiedKFold, cross_val_score

    model = NeedTextModel()
    samples = model.load_samples()
    X = [normalize_text(s["text"]) for s in samples]
    y = [s["label"] for s in samples]

    cv = StratifiedKFold(5, shuffle=True, random_state=RANDOM_STATE)
    scores_by_k = {}
    for k in (1, 3, 5, 7):
        scores = cross_val_score(build_text_pipeline(k), X, y, cv=cv, scoring="f1_macro")
        scores_by_k[k] = float(scores.mean())
    best_k = max(scores_by_k, key=scores_by_k.get)

    final = NeedTextModel(n_neighbors=best_k).fit()
    joblib.dump(final.pipeline, out_dir / "text_model.joblib")

    return {
        "type": "text_need_classifier",
        "algorithm": "TF-IDF (word 1-2gram + char_wb 3-5gram) + kNN cosine",
        "n_samples": len(X),
        "labels": sorted(set(y)),
        "f1_macro_by_k": {str(k): round(v, 4) for k, v in scores_by_k.items()},
        "best_k": best_k,
        "cv_f1_macro": round(scores_by_k[best_k], 4),
    }


if __name__ == "__main__":
    sys.exit(main())
