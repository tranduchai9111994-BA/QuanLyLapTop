"""Số liệu giải thích (nút "!") phải tự kiểm tra được: cộng bình phương hiệu z rồi lấy căn == khoảng cách của kNN."""
import numpy as np
import pytest

from app.data.features import MODEL_A_FEATURES
from app.models.classifier import build_pipeline
from app.models.segment_explain import build_explain, scaling_info


@pytest.fixture(scope="module")
def fitted(enriched_catalog):
    train = enriched_catalog.iloc[:800]
    pipe = build_pipeline()
    pipe.set_params(knn__n_neighbors=7, knn__weights="uniform", knn__metric="euclidean")
    pipe.fit(train[MODEL_A_FEATURES], train["segment"])
    return pipe, train, enriched_catalog.iloc[900]


def test_explain_distance_matches_knn(fitted):
    pipe, _, row = fitted
    prep, knn = pipe.named_steps["prep"], pipe.named_steps["knn"]
    X = row[MODEL_A_FEATURES].to_frame().T.astype(float)
    Z = prep.transform(X)
    dist, idx = knn.kneighbors(Z)
    ex = build_explain(pipe, X.iloc[0], Z[0], idx[0])

    q = np.array(ex["query_z"])
    for d, nz in zip(dist[0], ex["neighbors_z"]):
        assert np.sqrt(((q - np.array(nz)) ** 2).sum()) == pytest.approx(d, abs=1e-4)  # z gửi giao diện làm tròn 6 chữ số
    assert ex["model"] == {"k": 7, "metric": "euclidean", "weights": "uniform", "n_train": 800}
    assert ex["features"] == MODEL_A_FEATURES and len(ex["inputs"]) == 11


def test_explain_raw_values_roundtrip(fitted):
    """Đổi z-score về giá trị gốc (log2 ngược) phải ra đúng giá trị của máy huấn luyện."""
    pipe, train, _ = fitted
    knn = pipe.named_steps["knn"]
    X = train[MODEL_A_FEATURES].iloc[[0]].astype(float)
    Z = pipe.named_steps["prep"].transform(X)
    ex = build_explain(pipe, X.iloc[0], Z[0], np.array([0, 1]))  # láng giềng giả: hai máy huấn luyện đầu tiên
    expected = train[MODEL_A_FEATURES].iloc[0].astype(float).to_numpy()
    assert ex["neighbors_raw"][0] == pytest.approx(list(expected), rel=1e-3, abs=1e-3)
    assert knn._fit_X.shape[0] == 800


def test_scaling_info_order(fitted):
    pipe, _, _ = fitted
    info = scaling_info(pipe)
    assert [s["feature"] for s in info] == MODEL_A_FEATURES
    assert [s["kind"] for s in info[:2]] == ["log2_z", "log2_z"] and info[-1]["kind"] == "keep"


def _production_split():
    """Dữ liệu và cách chia giống lúc huấn luyện (lifecycle/train.py)."""
    import pandas as pd
    from sklearn.model_selection import train_test_split

    from app.data.features import enrich_catalog
    from app.models import segment_explain as se

    df = enrich_catalog(
        pd.read_csv(se.PROCESSED_DIR / "catalog_vn.csv"),
        pd.read_csv(se.PROCESSED_DIR / "cpu_benchmark.csv"),
        pd.read_csv(se.PROCESSED_DIR / "gpu_benchmark.csv"),
    )
    train, _ = train_test_split(df, test_size=0.2, stratify=df["segment"], random_state=42)
    return df, train


def test_training_names_match_when_fitted_like_production():
    from app.models.segment_explain import training_names

    _, train = _production_split()
    pipe = build_pipeline()
    pipe.set_params(knn__n_neighbors=7, knn__weights="uniform", knn__metric="euclidean")
    pipe.fit(train[MODEL_A_FEATURES], train["segment"])
    names = training_names(pipe)
    assert names == train["name"].astype(str).tolist() and len(names) == 800


def test_training_names_none_when_fitted_on_other_rows():
    """Mô hình học trên tập khác thì không được hiện tên (tránh gán nhầm tên máy)."""
    from app.models.segment_explain import training_names

    df, _ = _production_split()
    other = df.iloc[:800]
    pipe = build_pipeline()
    pipe.fit(other[MODEL_A_FEATURES], other["segment"])
    assert training_names(pipe) is None


def test_explain_includes_neighbor_names(fitted):
    pipe, _, row = fitted
    X = row[MODEL_A_FEATURES].to_frame().T.astype(float)
    Z = pipe.named_steps["prep"].transform(X)
    _, idx = pipe.named_steps["knn"].kneighbors(Z)
    names = [f"máy {i}" for i in range(800)]
    ex = build_explain(pipe, X.iloc[0], Z[0], idx[0], names)
    assert ex["neighbors_name"] == [f"máy {int(j)}" for j in idx[0]]
    assert build_explain(pipe, X.iloc[0], Z[0], idx[0])["neighbors_name"] is None
