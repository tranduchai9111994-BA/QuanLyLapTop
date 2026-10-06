"""Chặn các lỗi dễ tái phát của khoảng cách một phía (Mô hình B)."""
import numpy as np
import pandas as pd

from app.data.features import MODEL_B_FEATURES
from app.models.retriever import (
    build_ideal_vector,
    build_weights,
    fit_scaler,
    one_sided_distance,
    recommend,
)


def test_stronger_and_cheaper_not_penalized():
    """Máy mạnh hơn và rẻ hơn mức mong muốn thì khoảng cách bằng 0, không bị phạt."""
    w = np.array([0.5, 0.5])
    d = np.array([+1.0, -1.0])  # đặc trưng 1 càng cao càng tốt, đặc trưng 2 càng thấp càng tốt
    q = np.array([0.0, 0.0])

    assert one_sided_distance(np.array([2.0, -2.0]), q, w, d) == 0.0  # mạnh hơn và rẻ hơn
    assert one_sided_distance(np.array([-2.0, 0.0]), q, w, d) > 0     # yếu hơn thì bị phạt
    assert one_sided_distance(np.array([0.0, 2.0]), q, w, d) > 0      # đắt hơn thì bị phạt


def test_one_sided_metric_argument_order(enriched_catalog):
    """Chặn lỗi đảo thứ tự đối số: scikit-learn gọi metric(query, train), ngược với (x, q) của công thức.

    Nếu đảo nhầm, hệ thống sẽ ưu tiên máy yếu hơn. Nên khi ưu tiên hiệu năng tối đa,
    cpu_score trung bình của top-5 phải cao hơn trung bình toàn tập.
    """
    catalog = enriched_catalog
    scaler = fit_scaler(catalog)
    priorities = {"performance": 5, "mobility": 1, "display": 3, "price": 1}
    budget = {"min": int(catalog["price_vnd"].min()), "max": int(catalog["price_vnd"].max())}

    ideal = build_ideal_vector(catalog, priorities, {}, budget, "GAMING")
    weights = build_weights(priorities, "GAMING")
    _, idx = recommend(catalog, scaler, ideal, weights, top_n=5)
    top = catalog.iloc[idx]

    assert top["cpu_score"].mean() > catalog["cpu_score"].mean(), (
        f"Top-5 khi ưu tiên hiệu năng có cpu_score trung bình {top['cpu_score'].mean():.1f} "
        f"thấp hơn trung bình catalog {catalog['cpu_score'].mean():.1f} -> metric bị lật dấu"
    )


def test_cheap_priority_returns_cheaper_machines(enriched_catalog):
    """Ưu tiên tiết kiệm tối đa thì giá trung bình top-5 phải thấp hơn khi ưu tiên tiết kiệm thấp."""
    catalog = enriched_catalog
    scaler = fit_scaler(catalog)
    budget = {"min": 10_000_000, "max": 40_000_000}
    cand = catalog[catalog["price_vnd"] <= budget["max"]]

    cheap_first = {"performance": 3, "mobility": 3, "display": 3, "price": 5}
    money_no_object = {"performance": 3, "mobility": 3, "display": 3, "price": 1}

    _, idx_cheap = recommend(cand, scaler, build_ideal_vector(cand, cheap_first, {}, budget, "OFFICE"),
                             build_weights(cheap_first, "OFFICE"), top_n=5)
    _, idx_rich = recommend(cand, scaler, build_ideal_vector(cand, money_no_object, {}, budget, "OFFICE"),
                            build_weights(money_no_object, "OFFICE"), top_n=5)

    avg_cheap = cand.iloc[idx_cheap]["price_vnd"].mean()
    avg_rich = cand.iloc[idx_rich]["price_vnd"].mean()
    assert avg_cheap < avg_rich, f"ưu tiên rẻ: {avg_cheap/1e6:.1f}tr không thấp hơn {avg_rich/1e6:.1f}tr"


def test_soft_segment_filter_keeps_other_segments(enriched_catalog):
    """Lọc mềm: máy khác phân khúc vẫn được lọt top nếu thật sự phù hợp, không bị loại thẳng."""
    catalog = enriched_catalog
    scaler = fit_scaler(catalog)
    priorities = {"performance": 5, "mobility": 2, "display": 5, "price": 2}
    budget = {"min": 20_000_000, "max": 80_000_000}
    cand = catalog[catalog["price_vnd"] <= budget["max"]]

    ideal = build_ideal_vector(cand, priorities, {}, budget, "CREATOR")
    weights = build_weights(priorities, "CREATOR")
    _, idx = recommend(cand, scaler, ideal, weights, top_n=20, preferred_segment="CREATOR")
    segments = set(cand.iloc[idx]["segment"])
    assert len(segments) > 1, "Lọc mềm nhưng top-20 chỉ có đúng một phân khúc -> hóa ra vẫn là lọc cứng"
