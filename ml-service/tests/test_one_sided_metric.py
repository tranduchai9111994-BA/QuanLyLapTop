"""Test chan cac loi de tai phat cua khoang cach MOT PHIA (Mo hinh B)."""
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
    """May MANH HON va RE HON muc mong muon phai co khoang cach = 0 (khong bi phat)."""
    w = np.array([0.5, 0.5])
    d = np.array([+1.0, -1.0])  # dac trung 1: cao tot hon; dac trung 2: thap tot hon
    q = np.array([0.0, 0.0])

    assert one_sided_distance(np.array([2.0, -2.0]), q, w, d) == 0.0  # manh hon + re hon
    assert one_sided_distance(np.array([-2.0, 0.0]), q, w, d) > 0     # yeu hon -> bi phat
    assert one_sided_distance(np.array([0.0, 2.0]), q, w, d) > 0      # dat hon -> bi phat


def test_one_sided_metric_argument_order(enriched_catalog):
    """Chan loi da tung gap: scikit-learn goi metric(query, train), nguoc voi thu tu (x, q)
    cua cong thuc mot phia. Neu dao nham, he thong se uu tien may YEU HON - sai hoan toan.

    Kiem tra bang cach: truy van voi ho so uu tien hieu nang toi da, thi cpu_score trung binh
    cua top-5 phai CAO HON dang ke trung binh toan tap ung vien.
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
        f"Top-5 khi uu tien hieu nang co cpu_score trung binh {top['cpu_score'].mean():.1f} "
        f"THAP hon trung binh catalog {catalog['cpu_score'].mean():.1f} -> metric bi lat dau"
    )


def test_cheap_priority_returns_cheaper_machines(enriched_catalog):
    """Uu tien tiet kiem toi da -> gia trung binh top-5 phai thap hon han uu tien tiet kiem thap."""
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
    assert avg_cheap < avg_rich, f"uu tien re: {avg_cheap/1e6:.1f}tr khong thap hon {avg_rich/1e6:.1f}tr"


def test_soft_segment_filter_keeps_other_segments(enriched_catalog):
    """Loc MEM: may khac phan khuc van duoc phep lot top neu that su phu hop (khong bi loai thang)."""
    catalog = enriched_catalog
    scaler = fit_scaler(catalog)
    priorities = {"performance": 5, "mobility": 2, "display": 5, "price": 2}
    budget = {"min": 20_000_000, "max": 80_000_000}
    cand = catalog[catalog["price_vnd"] <= budget["max"]]

    ideal = build_ideal_vector(cand, priorities, {}, budget, "CREATOR")
    weights = build_weights(priorities, "CREATOR")
    _, idx = recommend(cand, scaler, ideal, weights, top_n=20, preferred_segment="CREATOR")
    segments = set(cand.iloc[idx]["segment"])
    assert len(segments) > 1, "Loc mem nhung top-20 chi co dung mot phan khuc -> hoa ra van la loc cung"
