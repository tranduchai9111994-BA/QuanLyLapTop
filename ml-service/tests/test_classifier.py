import numpy as np

from app.models.classifier import build_pipeline
from app.data.features import MODEL_A_FEATURES


def test_scaler_inside_pipeline():
    """Chuẩn hóa phải nằm trong Pipeline, không được fit riêng bên ngoài (tránh rò rỉ dữ liệu)."""
    pipe = build_pipeline()
    assert pipe.steps[0][0] == "prep"
    assert pipe.steps[-1][0] == "knn"


def test_price_not_in_classifier():
    """D-04: giá (price_vnd) không được đưa vào đặc trưng Mô hình A."""
    assert "price_vnd" not in MODEL_A_FEATURES


def test_reproducible(enriched_catalog):
    """Học hai lần với cùng dữ liệu và tham số thì dự đoán phải giống hệt."""
    X, y = enriched_catalog, enriched_catalog["segment"]
    pipe1 = build_pipeline()
    pipe1.set_params(knn__n_neighbors=5, knn__weights="distance", knn__metric="euclidean")
    pipe1.fit(X[MODEL_A_FEATURES], y)

    pipe2 = build_pipeline()
    pipe2.set_params(knn__n_neighbors=5, knn__weights="distance", knn__metric="euclidean")
    pipe2.fit(X[MODEL_A_FEATURES], y)

    pred1 = pipe1.predict(X[MODEL_A_FEATURES])
    pred2 = pipe2.predict(X[MODEL_A_FEATURES])
    assert (pred1 == pred2).all()


def test_scale_invariance(enriched_catalog):
    """Đổi đơn vị giá (VND sang nghìn VND) không làm đổi dự đoán, vì giá không nằm trong Mô hình A."""
    X = enriched_catalog.copy()
    y = X["segment"]
    pipe = build_pipeline()
    pipe.fit(X[MODEL_A_FEATURES], y)
    pred_before = pipe.predict(X[MODEL_A_FEATURES])

    X2 = X.copy()
    X2["price_vnd"] = X2["price_vnd"] / 1000  # đổi đơn vị, không ảnh hưởng vì giá không có trong danh sách đặc trưng
    pred_after = pipe.predict(X2[MODEL_A_FEATURES])
    assert (pred_before == pred_after).all()


def test_neighbors_explain_the_vote(enriched_catalog):
    """FR-09: danh sách láng giềng trả cho nhân viên phải đúng là k máy đã bỏ phiếu. Với
    weights="uniform", tỷ lệ mỗi nhãn trong k láng giềng phải bằng đúng xác suất predict_proba.
    Bắt lỗi lấy láng giềng sai cách (ví dụ quên bước chuẩn hóa "prep" hoặc ánh xạ sai nhãn)."""
    X, y = enriched_catalog, enriched_catalog["segment"]
    pipe = build_pipeline()
    pipe.set_params(knn__n_neighbors=7, knn__weights="uniform", knn__metric="euclidean")
    pipe.fit(X[MODEL_A_FEATURES], y)

    sample = X[MODEL_A_FEATURES].iloc[:20]
    proba = pipe.predict_proba(sample)
    knn = pipe.named_steps["knn"]
    _, idx = knn.kneighbors(pipe.named_steps["prep"].transform(sample))
    train_labels = knn.classes_[knn._y]

    for row_i in range(len(sample)):
        votes = list(train_labels[idx[row_i]])
        for class_i, label in enumerate(knn.classes_):
            assert np.isclose(votes.count(label) / 7, proba[row_i][class_i])
