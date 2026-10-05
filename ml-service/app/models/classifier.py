"""Mô hình A: kNN PHÂN LỚP phân khúc laptop (docs/04 SS3).

Khác với Mô hình B (retriever.py - TÌM máy gần giống nhu cầu), Mô hình A trả lời câu hỏi khác:
"Cho một cấu hình laptop (CPU, GPU, RAM,...), nó thuộc phân khúc nào trong 4 nhóm
OFFICE/ULTRABOOK/GAMING/CREATOR?"

Dùng khi nào:
  1. Nhân viên thêm laptop mới -> AI gợi ý phân khúc (xem SegmentSuggester.tsx ở frontend)
  2. Người dùng wizard chọn "Chưa rõ nhu cầu" -> suy phân khúc từ hoạt động (segment_inference.py)

Thuật toán: KNeighborsClassifier của scikit-learn - phiên bản "phân lớp" (classification) của
kNN, khác với NearestNeighbors "truy hồi" (retrieval) dùng trong retriever.py. Cả hai đều dựa
trên cùng nguyên lý: tìm k láng giềng gần nhất, nhưng Mô hình A dùng k láng giềng đó để BỎ PHIẾU
ra MỘT NHÃN (vd "3/5 láng giềng là GAMING nên dự đoán GAMING"), còn Mô hình B trả về CHÍNH các
láng giềng đó làm kết quả (không bỏ phiếu).
"""
from __future__ import annotations

import numpy as np
import pandas as pd
from sklearn.dummy import DummyClassifier
from sklearn.model_selection import GridSearchCV, StratifiedKFold
from sklearn.neighbors import KNeighborsClassifier
from sklearn.pipeline import Pipeline

from app.data.features import MODEL_A_FEATURES, build_model_a_preprocessor

RANDOM_STATE = 42  # cố định để kết quả tái lập được giữa các lần chạy (docs yêu cầu)

# Không gian tham số để GridSearchCV tìm ra bộ tham số kNN tốt nhất:
#   n_neighbors: k = 1, 3, 5, ..., 31 (số LẺ để tránh hòa phiếu khi biểu quyết 50-50)
#   weights: "uniform" = mỗi láng giềng 1 phiếu | "distance" = láng giềng gần hơn phiếu nặng hơn
#   metric: cách đo khoảng cách - Euclidean (đường thẳng) hay Manhattan (tổng trị tuyệt đối)
PARAM_GRID = {  # 16 x 2 x 2 = 64 tổ hợp cần thử
    "knn__n_neighbors": list(range(1, 32, 2)),  # 16 giá trị k: 1, 3, 5, ..., 31
    "knn__weights": ["uniform", "distance"],  # 2 cách tính phiếu
    "knn__metric": ["euclidean", "manhattan"],  # 2 cách đo khoảng cách
}


def build_pipeline() -> Pipeline:
    """Dựng "dây chuyền" xử lý: chuẩn hóa dữ liệu (bước "prep") -> phân lớp kNN (bước "knn").

    QUAN TRỌNG: Scaler PHẢI nằm trong Pipeline này (không được fit scaler riêng bên ngoài rồi
    mới đưa vào kNN). Nếu fit bên ngoài, khi chạy cross-validation, scaler sẽ "nhìn thấy" cả
    dữ liệu validation trước khi model được đánh giá trên nó - gọi là RÒ RỈ DỮ LIỆU (data
    leakage), làm điểm số cao giả tạo. Đặt trong Pipeline giúp scikit-learn tự động fit lại
    scaler CHỈ trên tập train ở mỗi fold. Xem test_scaler_inside_pipeline trong thư mục tests/.
    """
    return Pipeline([
        ("prep", build_model_a_preprocessor()),
        ("knn", KNeighborsClassifier()),
    ])


def grid_search(X: pd.DataFrame, y: pd.Series) -> GridSearchCV:
    """Thử TẤT CẢ tổ hợp tham số trong PARAM_GRID, chọn bộ tốt nhất theo macro-F1.

    Dùng StratifiedKFold (5 phần) thay vì KFold thường: "Stratified" đảm bảo mỗi phần (fold)
    có tỷ lệ các phân khúc GIỐNG NHAU với toàn bộ dữ liệu - quan trọng vì lớp CREATOR ít mẫu
    hơn hẳn GAMING/OFFICE, nếu chia ngẫu nhiên có thể có fold thiếu hẳn mẫu CREATOR.

    Vì sao chấm điểm bằng macro-F1 chứ không phải accuracy (docs/04 SS3.4): accuracy dễ bị
    "lừa" bởi lớp đông (vd dự đoán toàn GAMING/OFFICE vẫn đúng phần lớn, dù bỏ qua CREATOR
    hoàn toàn). macro-F1 tính F1 riêng cho TỪNG lớp rồi lấy TRUNG BÌNH ĐỀU, nên mô hình bỏ
    qua lớp nhỏ sẽ bị phạt điểm rõ ràng.
    """
    pipe = build_pipeline()
    cv = StratifiedKFold(5, shuffle=True, random_state=RANDOM_STATE)  # 800 máy -> 5 phần x 160 máy, giữ tỷ lệ 4 phân khúc
    # Mỗi tổ hợp: học 5 lần (mỗi lần bỏ 1 phần, học trên 640 máy), chấm macro-F1 trên 160 máy bị bỏ,
    # rồi lấy trung bình 5 điểm; tổ hợp có trung bình cao nhất sẽ thắng
    search = GridSearchCV(
        pipe, PARAM_GRID, cv=cv, scoring="f1_macro", n_jobs=-1, return_train_score=True
    )
    search.fit(X[MODEL_A_FEATURES], y)  # 64 x 5 = 320 lần học; xong học lại bộ thắng trên đủ 800 máy (best_estimator_)
    return search


def rule_based_baseline(X: pd.DataFrame) -> np.ndarray:
    """Bộ LUẬT IF-ELSE thủ công, dùng làm MỐC SO SÁNH để chứng minh kNN thực sự học được gì
    (docs/04 SS6.1) - không phải chỉ "đặt tên AI" cho một bộ luật cố định.

    Luật (theo thứ tự ưu tiên, kiểm tra từ trên xuống):
      1. Có GPU rời VÀ tần số quét >= 120Hz  -> chắc chắn là máy GAMING
      2. Màn hình chuẩn màu (sRGB 100%) VÀ CPU thuộc nhóm mạnh (top 30%) -> CREATOR
      3. Nhẹ (<= 1.4kg) -> ULTRABOOK
      4. Còn lại -> OFFICE (nhóm "mặc định" khi không khớp điều kiện nào ở trên)

    Nếu kNN KHÔNG vượt được bộ luật này rõ rệt, nghĩa là dữ liệu quá "sạch" (ranh giới phân
    khúc quá rõ ràng), không thể hiện được giá trị của học máy so với luật cố định - xem
    ml-service/README.md mục "Kết quả hiện tại" để biết lần phát hiện vấn đề này.
    """
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
    """Mốc so sánh THẤP NHẤT: luôn dự đoán nhãn XUẤT HIỆN NHIỀU NHẤT trong tập huấn luyện,
    bất kể đặc trưng đầu vào là gì. Nếu kNN không vượt được cả mốc này, mô hình vô dụng."""
    clf = DummyClassifier(strategy="most_frequent")
    clf.fit(np.zeros((len(y_train), 1)), y_train)
    return clf


def k_curve(X: pd.DataFrame, y: pd.Series, best_weights: str, best_metric: str) -> list[dict]:
    """Vẽ "đường cong chọn k": tính macro-F1 (bằng cross-validation) cho TỪNG giá trị k riêng
    lẻ, giữ nguyên weights/metric đã chọn tốt nhất. Kết quả dùng để VẼ BIỂU ĐỒ trong báo cáo
    (docs/04 SS5.1) - trục X là k, trục Y là macro-F1, giúp hội đồng THẤY được vì sao chọn k
    đó (thay vì chỉ nói suông "đã grid search").

    Ý nghĩa hình dạng đường cong: k quá NHỎ (1-3) thường nhạy cảm nhiều (một mẫu lạ có thể
    làm sai lệch kết quả). k quá LỚN làm "mờ" ranh giới giữa các lớp, thiên về lớp chiếm đa
    số. Điểm k tối ưu thường nằm giữa, nơi đường cong đạt đỉnh cao nhất.
    """
    from sklearn.model_selection import cross_val_score

    curve = []
    cv = StratifiedKFold(5, shuffle=True, random_state=RANDOM_STATE)
    for k in range(1, 32, 2):
        pipe = build_pipeline()
        pipe.set_params(knn__n_neighbors=k, knn__weights=best_weights, knn__metric=best_metric)
        scores = cross_val_score(pipe, X[MODEL_A_FEATURES], y, cv=cv, scoring="f1_macro", n_jobs=-1)
        curve.append({"k": k, "f1_macro_mean": float(scores.mean()), "f1_macro_std": float(scores.std())})
    return curve
