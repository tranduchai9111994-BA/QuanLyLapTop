"""Suy phân khúc từ hoạt động khi người dùng chọn 'Chưa rõ' (docs/04 SS3.5)."""
from __future__ import annotations

import pandas as pd

from app.data.features import MODEL_A_FEATURES

# Giá trị là phân vị mục tiêu đã tính hướng (weight_kg: 25 = muốn nhẹ).
ACTIVITY_TARGETS = {
    "choi_game": {"gpu_score": 75, "refresh_hz": 75, "gpu_dedicated": 1, "cpu_score": 60},
    "do_hoa": {"srgb_100": 1, "cpu_score": 75, "ram_gb": 75, "gpu_score": 60},
    "dung_video": {"srgb_100": 1, "cpu_score": 75, "ram_gb": 75, "gpu_score": 60},
    "di_chuyen_nhieu": {"weight_kg": 25, "battery_wh": 75, "gpu_score": 25},
    # docs/04 gợi ý "trung vị" cho văn phòng/học tập, nhưng trung vị toàn catalog (gồm cả
    # Gaming/Creator) kéo vector lệch lên cao, nên dùng P25.
    "van_phong": {"cpu_score": 25, "ram_gb": 25, "gpu_score": 25},
    "hoc_tap": {"cpu_score": 25, "ram_gb": 25, "gpu_score": 25},
    "lap_trinh": {"cpu_score": 60, "ram_gb": 60, "gpu_score": 25},
    "thiet_ke": {"srgb_100": 1, "cpu_score": 75, "ram_gb": 75, "gpu_score": 60},
    "xem_phim": {"cpu_score": 25, "ram_gb": 25},
}

def build_activity_vector(catalog: pd.DataFrame, activities: list[str]) -> dict:
    """Nhiều hoạt động cùng tác động một đặc trưng thì lấy phân vị lệch xa trung vị (50) nhất,
    vì đó là yêu cầu rõ ràng hơn trung bình cộng."""
    demands: dict[str, list[float]] = {f: [] for f in MODEL_A_FEATURES}
    for act in activities:
        targets = ACTIVITY_TARGETS.get(act, {})
        for feat, pct in targets.items():
            demands[feat].append(float(pct))

    vector: dict[str, float] = {}
    for feat in MODEL_A_FEATURES:
        if not demands[feat]:
            vector[feat] = float(catalog[feat].median())
        elif feat in ("gpu_dedicated", "srgb_100"):
            vector[feat] = max(demands[feat])
        else:
            pct = max(demands[feat], key=lambda p: abs(p - 50))
            vector[feat] = float(catalog[feat].quantile(pct / 100))
    return vector


def infer_segment(model, catalog: pd.DataFrame, activities: list[str]) -> dict:
    vector = build_activity_vector(catalog, activities)
    X = pd.DataFrame([vector])[MODEL_A_FEATURES]
    proba = model.predict_proba(X)[0]
    labels = model.classes_
    order = proba.argsort()[::-1]

    # Lấy k láng giềng đã bỏ phiếu để UI giải thích "phân khúc được chọn vì...",
    # cùng cách với /predict-segment (main.py).
    prep = model.named_steps["prep"]
    knn = model.named_steps["knn"]
    neigh_dist, neigh_idx = knn.kneighbors(prep.transform(X))
    train_labels = knn.classes_[knn._y]
    neighbors = [
        {"label": str(train_labels[j]), "distance": round(float(d), 4)}
        for j, d in zip(neigh_idx[0], neigh_dist[0])
    ]

    return {
        "segment": labels[order[0]],
        "confidence": float(proba[order[0]]),
        "distribution": {labels[i]: float(proba[i]) for i in order},
        "neighbors": neighbors,
    }
