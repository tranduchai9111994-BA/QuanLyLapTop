import numpy as np

from app.classifier import build_pipeline
from app.features import MODEL_A_FEATURES


def test_scaler_inside_pipeline():
    """Scaler phai nam trong Pipeline, khong duoc fit rieng ngoai (tranh ro ri du lieu)."""
    pipe = build_pipeline()
    assert pipe.steps[0][0] == "prep"
    assert pipe.steps[-1][0] == "knn"


def test_price_not_in_classifier():
    """D-04: price_vnd khong duoc dua vao dac trung Mo hinh A."""
    assert "price_vnd" not in MODEL_A_FEATURES


def test_reproducible(enriched_catalog):
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
    """Doi don vi gia VND <-> nghin VND khong lam doi thu hang (gia khong nam trong Mo hinh A)."""
    X = enriched_catalog.copy()
    y = X["segment"]
    pipe = build_pipeline()
    pipe.fit(X[MODEL_A_FEATURES], y)
    pred_before = pipe.predict(X[MODEL_A_FEATURES])

    X2 = X.copy()
    X2["price_vnd"] = X2["price_vnd"] / 1000  # doi don vi, khong anh huong vi price khong trong feature list
    pred_after = pipe.predict(X2[MODEL_A_FEATURES])
    assert (pred_before == pred_after).all()


def test_neighbors_explain_the_vote(enriched_catalog):
    """FR-09: danh sach lang gieng tra ve cho nhan vien phai DUNG la k may da bo phieu - voi
    weights="uniform", ty le nhan trong k lang gieng phai bang dung xac suat predict_proba.
    Chan loi lay lang gieng sai cach (vd quen buoc chuan hoa "prep" hoac map sai nhan)."""
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
