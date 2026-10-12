"""Thí nghiệm độ nhạy của điểm kiểm tra theo tỷ lệ chia học/thi (10/90 ... 40/60).

Chạy (từ thư mục ml-service):  python -m app.lifecycle.split_ratio
Chỉ đọc dữ liệu và in kết quả, không ghi gì vào artifacts.

Giữ cố định bộ tham số mô hình đang dùng (k = 7, uniform, euclidean), chia ngẫu nhiên có giữ tỷ lệ phân khúc nhiều lần cho mỗi tỷ lệ,
huấn luyện lại trên phần học rồi chấm macro-F1 và recall CREATOR trên phần thi. Cho biết đổi tỷ lệ chia làm đổi ĐIỂM TRUNG BÌNH hay
chỉ làm đổi ĐỘ DAO ĐỘNG của con số chấm.

Hạn chế: k không được chọn lại cho từng tỷ lệ, và k = 7 vốn được chọn trên chính dữ liệu này nên điểm hơi lạc quan.
"""
from __future__ import annotations

import numpy as np
from sklearn.metrics import f1_score, recall_score
from sklearn.model_selection import train_test_split

from app.data.features import MODEL_A_FEATURES
from app.lifecycle.train import load_dataset
from app.models.classifier import build_pipeline

TEST_SIZES = (0.1, 0.2, 0.3, 0.4)  # tỷ lệ phần thi
N_REPEATS = 40  # số lần chia ngẫu nhiên cho mỗi tỷ lệ (seed 0..39)


def evaluate_split(df, test_size: float, seed: int) -> tuple[float, float]:
    """Một lần chia: trả về (macro-F1, recall CREATOR) trên phần thi."""
    X_train, X_test, y_train, y_test = train_test_split(
        df, df["segment"], test_size=test_size, stratify=df["segment"], random_state=seed
    )
    pipe = build_pipeline()
    pipe.set_params(knn__n_neighbors=7, knn__weights="uniform", knn__metric="euclidean")  # tham số đã chọn, giữ cố định
    pipe.fit(X_train[MODEL_A_FEATURES], y_train)
    pred = pipe.predict(X_test[MODEL_A_FEATURES])
    f1 = f1_score(y_test, pred, average="macro")
    recall_creator = recall_score(y_test, pred, labels=["CREATOR"], average=None)[0]
    return float(f1), float(recall_creator)


def main() -> None:
    df, _ = load_dataset()
    n_creator = int((df["segment"] == "CREATOR").sum())
    print(f"{'phần thi':>9} {'học':>5} {'thi':>5} {'CREATOR(thi)':>13} | {'macro-F1 TB':>11} {'độ lệch':>8} {'nhỏ nhất':>9} {'lớn nhất':>9}"
          f" | {'recall CREATOR TB (độ lệch)':>28}")
    for test_size in TEST_SIZES:
        results = [evaluate_split(df, test_size, seed) for seed in range(N_REPEATS)]
        f1s = np.array([r[0] for r in results])
        recalls = np.array([r[1] for r in results])
        n_test = int(round(len(df) * test_size))
        print(f"{test_size:>9.1f} {len(df) - n_test:>5} {n_test:>5} {int(round(n_creator * test_size)):>13} |"
              f" {f1s.mean():>11.4f} {f1s.std():>8.4f} {f1s.min():>9.4f} {f1s.max():>9.4f} |"
              f" {recalls.mean():>16.3f} ({recalls.std():.3f})")


if __name__ == "__main__":
    main()
