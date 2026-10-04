import numpy as np

from app.models.explain import build_explanation
from app.models.retriever import build_ideal_vector, build_weights, fit_scaler, recommend, similar_items


def test_identity_top1(enriched_catalog):
    """Truy van bang chinh vector mot may X phai ra X hang 1 (dist ~ 0)."""
    catalog = enriched_catalog
    scaler = fit_scaler(catalog)
    row = catalog.iloc[10]
    ideal = row.to_dict()
    weights = {f: 1 / len(catalog.columns) for f in catalog.columns}
    weights = build_weights({"performance": 3, "mobility": 3, "display": 3, "price": 3}, row["segment"])
    dist, idx = recommend(catalog, scaler, ideal, weights, top_n=1)
    assert catalog.iloc[idx[0]]["id"] == row["id"]
    assert dist[0] < 1e-6


def test_weight_changes_ranking(enriched_catalog):
    """Tang uu tien di dong -> trong luong trung binh top-5 phai giam."""
    catalog = enriched_catalog
    scaler = fit_scaler(catalog)
    candidates = catalog[catalog["segment"] == "GAMING"]
    budget = {"min": 15_000_000, "max": 60_000_000}

    low_mobility = {"performance": 3, "mobility": 1, "display": 3, "price": 3}
    high_mobility = {"performance": 3, "mobility": 5, "display": 3, "price": 3}

    ideal_low = build_ideal_vector(candidates, low_mobility, {}, budget, "GAMING")
    weights_low = build_weights(low_mobility, "GAMING")
    dist_low, idx_low = recommend(candidates, scaler, ideal_low, weights_low, top_n=5)

    ideal_high = build_ideal_vector(candidates, high_mobility, {}, budget, "GAMING")
    weights_high = build_weights(high_mobility, "GAMING")
    dist_high, idx_high = recommend(candidates, scaler, ideal_high, weights_high, top_n=5)

    avg_weight_low = candidates.iloc[idx_low]["weight_kg"].mean()
    avg_weight_high = candidates.iloc[idx_high]["weight_kg"].mean()
    assert avg_weight_high <= avg_weight_low


def test_budget_hard_constraint(enriched_catalog):
    """Khong ket qua nao vuot Bmax khi loc cung da ap dung truoc."""
    catalog = enriched_catalog
    budget_max = 25_000_000
    candidates = catalog[(catalog["segment"] == "OFFICE") & (catalog["price_vnd"] <= budget_max)]
    scaler = fit_scaler(catalog)
    priorities = {"performance": 3, "mobility": 3, "display": 3, "price": 3}
    ideal = build_ideal_vector(candidates, priorities, {}, {"min": 9_000_000, "max": budget_max}, "OFFICE")
    weights = build_weights(priorities, "OFFICE")
    dist, idx = recommend(candidates, scaler, ideal, weights, top_n=5)
    picked = candidates.iloc[idx]
    assert (picked["price_vnd"] <= budget_max).all()


def test_explanation_schema(enriched_catalog):
    """Moi ket qua phai co >= 1 diem manh, ma cau hop le."""
    catalog = enriched_catalog
    row = catalog.iloc[0].to_dict()
    ideal = row.copy()
    ideal["cpu_score"] = 0
    weights = build_weights({"performance": 3, "mobility": 3, "display": 3, "price": 3}, row["segment"])
    result = build_explanation(row, ideal, weights, budget_max=row["price_vnd"] + 1_000_000)
    assert len(result["strengths"]) >= 1
    assert len(result["warnings"]) <= 2
