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
    """Tính hash SHA256 của file CSV để lưu vào metadata; dùng phát hiện khi dữ liệu đổi."""
    return hashlib.sha256(path.read_bytes()).hexdigest()


def load_dataset() -> tuple[pd.DataFrame, Path]:
    """BƯỚC 1: Đọc 1.000 laptop từ CSV, tra bảng benchmark CPU/GPU để có điểm số, làm giàu các cột số.

    Đầu vào:
    - catalog_vn.csv: 1.000 máy với tên CPU/GPU, cấu hình (RAM, SSD...)
    - cpu_benchmark.csv, gpu_benchmark.csv: bảng tra cứu điểm hiệu năng

    Đầu ra:
    - DataFrame 1.000 máy với 11 cột số (sau chuẩn hóa) + nhãn segment
    - Đường dẫn file CSV (để tính hash)
    """
    catalog_path = DATA_DIR / "processed" / "catalog_vn.csv"
    catalog = pd.read_csv(catalog_path)
    format_errors = check_catalog_format(catalog)
    if format_errors:  # báo rõ nguyên nhân thay vì lỗi KeyError khó hiểu
        raise ValueError("File catalog_vn.csv sai định dạng: " + " | ".join(format_errors))
    cpu_bench = pd.read_csv(DATA_DIR / "processed" / "cpu_benchmark.csv")
    gpu_bench = pd.read_csv(DATA_DIR / "processed" / "gpu_benchmark.csv")
    enriched = enrich_catalog(catalog, cpu_bench, gpu_bench)  # tra benchmark, thêm cột cpu_score, gpu_score, ppi...
    return enriched, catalog_path


def run_training() -> dict:
    """CHẠY TOÀN BỘ HUẤN LUYỆN TRÊN 1.000 MÁY — 11 bước (xem dòng 48-150).

    Luồng:
    1. Đọc dữ liệu (load_dataset)
    2. Chia 80/20 (800 học, 200 test)
    3. GridSearchCV thử 64 tổ hợp × 5 phần = 320 lần → chọn k, metric, weights tốt nhất
    4. Chấm điểm trên 200 máy test
    5. So sánh 2 baseline (dummy 0.128, rule 0.632)
    6. Vẽ đường cong k (macro-F1 vs k)
    7. Lưu model.joblib vào thư mục phiên bản (tên ngày giờ)
    8. Ghi metadata.json (tham số tốt nhất, điểm số, k_curve)
    9. Vẽ 2 ảnh (ma trận nhầm lẫn, đường cong k)
    10. Huấn luyện Mô hình C (câu tự do: TF-IDF + kNN)
    11. Ghi LATEST (chỉ lần đầu; các lần sau đổi bằng tay "Đưa vào sử dụng")

    Trả về: metadata dict (tham số, điểm, baseline, k_curve)
    ⚠ KHÔNG đổi LATEST tự động (đã quy định D-08)
    """
    df, catalog_path = load_dataset()  # Bước 1: đọc 1.000 máy, tra benchmark
    X = df
    y = df["segment"]

    # Bước 2: chia 80% (800 máy) để học, 20% (200 máy) để kiểm tra
    # stratify=y: giữ đúng tỷ lệ 4 phân khúc trong cả train lẫn test (OFFICE, GAMING, ULTRABOOK, CREATOR)
    # random_state=42: cố định seed để mỗi lần chạy chia giống nhau
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, stratify=y, random_state=RANDOM_STATE
    )

    golden_path = ARTIFACTS_DIR / "golden_test.csv"  # đóng băng tập kiểm tra ở lần train đầu tiên
    if not golden_path.exists():
        ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
        X_test.to_csv(golden_path, index=False)
        print(f"Đã đóng băng golden_test.csv ({len(X_test)} mẫu)")

    # Bước 3: GridSearchCV thử 64 tổ hợp (16 k × 2 weights × 2 metric) × 5 phần CV = 320 lần học
    # Mỗi lần: fit StandardScaler + kNN trên 640 máy, test trên 160 máy, ghi macro-F1
    # Chọn bộ tham số (k, weights, metric) có macro-F1 cao nhất trung bình 5 phần
    search = grid_search(X_train, y_train)
    best_pipe = search.best_estimator_  # Pipeline đã fit (chuẩn hóa + kNN) với bộ tham số tốt nhất
    best_params = search.best_params_   # {"knn__n_neighbors": 7, "knn__weights": "uniform", "knn__metric": "euclidean"}
    print("Best params:", best_params)
    print(f"CV f1_macro mean={search.best_score_:.4f}")  # macro-F1 trung bình 5 phần

    # Bước 4: Dự đoán 200 máy test (chưa từng thấy trong huấn luyện)
    # best_pipe sẽ chuẩn hóa 200 máy này dùng σ từ 800 máy (không rò rỉ dữ liệu)
    y_pred_test = best_pipe.predict(X_test[MODEL_A_FEATURES])
    test_f1_macro = f1_score(y_test, y_pred_test, average="macro")  # macro-F1 trên test (thực tế)
    report = classification_report(y_test, y_pred_test, output_dict=True)  # precision, recall, F1 per class
    cm = confusion_matrix(y_test, y_pred_test, labels=sorted(y.unique()))  # ma trận nhầm lẫn 4×4

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

    # Bước 8: Lưu metadata (JSON) — tất cả thông tin huấn luyện vào 1 file đọc được
    # Dùng để báo cáo, demo, so sánh phiên bản khác nhau, bảo vệ trước hội đồng
    metadata = {
        "version": version,  # phiên bản (ngày giờ)
        "type": "classifier",
        "trained_at": datetime.now(timezone.utc).isoformat(),
        "dataset_hash": dataset_hash(catalog_path),  # Hash của CSV input (phát hiện dữ liệu đổi)
        "n_samples": len(df),  # 1000
        "class_counts": y.value_counts().to_dict(),  # OFFICE 344, GAMING 335, ULTRABOOK 201, CREATOR 120
        "best_params": best_params,  # k=7, weights=uniform, metric=euclidean
        "cv_f1_macro_mean": float(search.best_score_),  # 0.7938 (CV trung bình 5 phần)
        "cv_f1_macro_std": float(search.cv_results_["std_test_score"][search.best_index_]),  # dao động
        "test_metrics": {"f1_macro": float(test_f1_macro), "report": report, "confusion_matrix": cm.tolist(), "labels": sorted(y.unique().tolist())},  # điểm test 200 máy
        "baseline": {"dummy_f1_macro": float(dummy_f1), "rule_f1_macro": float(rule_f1)},  # mốc so sánh: 0.128, 0.632
        "k_curve": curve,  # [(k=1, 0.7566), (k=3, 0.7647), ..., (k=31, 0.6968)] → dùng vẽ biểu đồ
        "feature_list": MODEL_A_FEATURES,  # 11 đặc trưng: ram_gb, ssd_gb, cpu_score, ...
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
    plt.axvline(best_params["knn__n_neighbors"], color="red", linestyle="--", label="k tốt nhất")
    plt.xlabel("k (số láng giềng)")
    plt.ylabel("Macro-F1 (CV trung bình)")
    plt.title(f"Đường cong k - {version}")
    plt.legend()
    plt.tight_layout()
    plt.savefig(out_dir / "k_curve.png", dpi=150)
    plt.close()

    # Bước 10: huấn luyện Mô hình C (phân loại câu nhu cầu tự do, TF-IDF + kNN)
    text_meta = train_text_model(out_dir)
    metadata["text_model"] = text_meta
    (out_dir / "metadata.json").write_text(json.dumps(metadata, ensure_ascii=False, indent=2), encoding="utf-8")

    # Bước 11: Ghi phiên bản LATEST (chỉ lần đầu; các lần sau = quyết định D-08)
    # Quyết định thiết kế D-08: huấn luyện không tự đổi mô hình → phải bấm "Đưa vào sử dụng" tay
    # Lý do: an toàn; người duyệt quyết định có chấp nhận bản này không trước khi replace production
    latest_path = ARTIFACTS_DIR / "LATEST"
    if not latest_path.exists():
        latest_path.write_text(version, encoding="utf-8")
        print(f"⚠ Lần đầu: ghi LATEST = {version}. Các lần sau cần bấm 'Đưa vào sử dụng' tay (D-08)")

    print(f"Test macro-F1={test_f1_macro:.4f} (mục tiêu >= 0.75)")
    print(f"Vượt dummy: +{test_f1_macro - dummy_f1:.4f} (mục tiêu >= 0.30)")
    print(f"Vượt luật: +{test_f1_macro - rule_f1:.4f} (mục tiêu >= 0.05)")
    print(f"Mô hình C (câu tự do): k={text_meta['best_k']}, CV macro-F1={text_meta['cv_f1_macro']:.4f}, "
          f"{text_meta['n_samples']} câu")
    print(f"Đã lưu artifact -> {out_dir}")
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
