"""In nội dung bên trong model.joblib (file nhị phân, mở bằng trình soạn thảo không đọc được).

Chạy (từ thư mục ml-service):
    python -m app.lifecycle.inspect_model                       # phiên bản đang dùng (file LATEST)
    python -m app.lifecycle.inspect_model clf-2026.09.27-012747  # một phiên bản cụ thể
"""
from __future__ import annotations

import sys

import joblib

from app.data.features import NUMERIC, NUMERIC_LOG
from app.lifecycle.registry import ARTIFACTS_DIR

sys.stdout.reconfigure(encoding="utf-8")  # console Windows mặc định không in được tiếng Việt


def main() -> None:
    version = sys.argv[1] if len(sys.argv) > 1 else (ARTIFACTS_DIR / "LATEST").read_text(encoding="utf-8").strip()
    model = joblib.load(ARTIFACTS_DIR / version / "model.joblib")
    prep, knn = model.named_steps["prep"], model.named_steps["knn"]

    print(f"Phiên bản: {version}")
    print(f"Mô hình gồm 2 bước nối nhau: {list(model.named_steps)}  (chuẩn hóa -> kNN)\n")

    print("BƯỚC 'prep' - chuẩn hóa: trung bình / độ lệch chuẩn đã học trên tập huấn luyện")
    groups = [("log", NUMERIC_LOG, "sau log2"), ("num", NUMERIC, "giá trị gốc")]
    for name, cols, note in groups:
        scaler = prep.named_transformers_[name].named_steps["sc"]
        for col, mean, std in zip(cols, scaler.mean_, scaler.scale_):
            print(f"  {col:14} trung bình = {mean:9.4f}   độ lệch chuẩn = {std:8.4f}   ({note})")

    print("\nBƯỚC 'knn' - bộ phân loại")
    print(f"  k (số láng giềng)   : {knn.n_neighbors}")
    print(f"  cách đo khoảng cách : {knn.metric}")
    print(f"  trọng số phiếu      : {knn.weights}")
    print(f"  số máy đã ghi nhớ   : {knn._fit_X.shape[0]} (mỗi máy {knn._fit_X.shape[1]} đặc trưng)")
    print(f"  các nhãn            : {list(knn.classes_)}")


if __name__ == "__main__":
    main()
