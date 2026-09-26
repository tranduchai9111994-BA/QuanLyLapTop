"""Mo hinh B: kNN truy hoi co trong so (docs/04 SS4)."""
from __future__ import annotations

import numpy as np
import pandas as pd
from sklearn.neighbors import NearestNeighbors
from sklearn.preprocessing import StandardScaler

from app.features import MODEL_B_FEATURES

PERCENTILE_BY_PRIORITY = {1: 25, 2: 40, 3: 55, 4: 75, 5: 90}

GROUPS = {
    "performance": ["cpu_score", "gpu_score", "ram_gb", "ssd_gb"],
    "mobility": ["weight_kg", "battery_wh"],
    "display": ["ppi", "refresh_hz", "srgb_100"],
    "price": ["price_vnd"],
}

BASE_WEIGHT_BY_SEGMENT = {
    "GAMING": {"performance": 1.3, "mobility": 0.7, "display": 1.0, "price": 1.0},
    "ULTRABOOK": {"performance": 0.8, "mobility": 1.4, "display": 1.0, "price": 1.0},
    "CREATOR": {"performance": 1.2, "mobility": 0.8, "display": 1.3, "price": 0.8},
    "OFFICE": {"performance": 0.8, "mobility": 1.0, "display": 0.8, "price": 1.3},
}
SCREEN_INCH_WEIGHT = 0.05


def fit_scaler(catalog: pd.DataFrame) -> StandardScaler:
    """z-score fit tren toan catalog (docs/04 SS4.3)."""
    scaler = StandardScaler()
    scaler.fit(catalog[MODEL_B_FEATURES])
    return scaler


def build_ideal_vector(
    candidates: pd.DataFrame, priorities: dict, must: dict, budget: dict, segment: str
) -> dict:
    q: dict[str, float] = {}
    for feat in ["cpu_score", "gpu_score", "ram_gb", "ssd_gb"]:
        p = priorities.get("performance", 3)
        q[feat] = float(candidates[feat].quantile(PERCENTILE_BY_PRIORITY[p] / 100))

    p_mob = priorities.get("mobility", 3)
    q["weight_kg"] = float(candidates["weight_kg"].quantile((100 - PERCENTILE_BY_PRIORITY[p_mob]) / 100))
    q["battery_wh"] = float(candidates["battery_wh"].quantile(PERCENTILE_BY_PRIORITY[p_mob] / 100))

    p_disp = priorities.get("display", 3)
    for feat in ["ppi", "refresh_hz"]:
        q[feat] = float(candidates[feat].quantile(PERCENTILE_BY_PRIORITY[p_disp] / 100))
    q["srgb_100"] = 1 if p_disp >= 4 else 0

    p_price = priorities.get("price", 3)
    b_min, b_max = budget["min"], budget["max"]
    q["price_vnd"] = b_min + (1 - (p_price - 1) / 4 * 0.7) * (b_max - b_min)

    q["screen_inch"] = float(candidates["screen_inch"].median())
    q["gpu_dedicated"] = 1 if segment == "GAMING" else int(candidates["gpu_dedicated"].median())

    ram_min = must.get("ramMin")
    if ram_min:
        q["ram_gb"] = max(q["ram_gb"], ram_min)

    return q


def build_weights(priorities: dict, segment: str) -> dict:
    base = BASE_WEIGHT_BY_SEGMENT.get(segment, BASE_WEIGHT_BY_SEGMENT["OFFICE"])
    raw: dict[str, float] = {"screen_inch": SCREEN_INCH_WEIGHT}
    for group, feats in GROUPS.items():
        p = priorities.get(group, 3)
        w_group = p * base[group]
        per_feat = w_group / len(feats)
        for f in feats:
            raw[f] = per_feat
    total = sum(raw.values())
    return {k: v / total for k, v in raw.items()}


def recommend(
    candidates: pd.DataFrame,
    scaler: StandardScaler,
    ideal: dict,
    weights: dict,
    top_n: int,
) -> tuple[np.ndarray, np.ndarray]:
    feats = MODEL_B_FEATURES
    Xs = scaler.transform(candidates[feats])
    q_df = pd.DataFrame([{f: ideal.get(f, 0) for f in feats}])
    qs = scaler.transform(q_df)

    w = np.array([weights.get(f, 0.0) for f in feats])
    sqrt_w = np.sqrt(w)

    n_neighbors = min(top_n, len(candidates))
    nn = NearestNeighbors(n_neighbors=n_neighbors, metric="euclidean")
    nn.fit(Xs * sqrt_w)
    dist, idx = nn.kneighbors(qs * sqrt_w)
    return dist[0], idx[0]


def match_pct(distances: np.ndarray, tau: float | None = None) -> np.ndarray:
    if tau is None:
        tau = float(np.median(distances)) if len(distances) else 1.0
        tau = max(tau, 1e-6)
    return 100 * np.exp(-distances / tau)


def similar_items(candidates: pd.DataFrame, scaler: StandardScaler, laptop_idx: int, k: int = 7) -> tuple[np.ndarray, np.ndarray]:
    feats = MODEL_B_FEATURES
    Xs = scaler.transform(candidates[feats])
    nn = NearestNeighbors(n_neighbors=min(k, len(candidates)), metric="euclidean")
    nn.fit(Xs)
    dist, idx = nn.kneighbors(Xs[laptop_idx : laptop_idx + 1])
    # bo phan tu dau (chinh no)
    return dist[0][1:], idx[0][1:]
