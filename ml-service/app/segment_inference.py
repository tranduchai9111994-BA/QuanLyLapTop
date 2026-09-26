"""Suy phan khuc tu hoat dong khi nguoi dung chon 'Chua ro' (docs/04 SS3.5)."""
from __future__ import annotations

import pandas as pd

from app.features import MODEL_A_FEATURES

ACTIVITY_TARGETS = {
    "choi_game": {"gpu_score": 75, "refresh_hz": 75, "gpu_dedicated": 1, "cpu_score": 60},
    "do_hoa": {"srgb_100": 1, "cpu_score": 75, "ram_gb": 75, "gpu_score": 60},
    "dung_video": {"srgb_100": 1, "cpu_score": 75, "ram_gb": 75, "gpu_score": 60},
    "di_chuyen_nhieu": {"weight_kg": 25, "battery_wh": 75, "gpu_score": 25},
    # docs/04 §3.5 goi y "trung vi" cho van_phong/hoc_tap; nhung trung vi TOAN catalog
    # (gom ca Gaming/Creator manh hon) keo vector lech ve phan khuc cao hon. Dung P25
    # (nhu cau thap) de phan anh dung dac diem thuc te cua nhom Van phong/Hoc tap.
    "van_phong": {"cpu_score": 25, "ram_gb": 25, "gpu_score": 25},
    "hoc_tap": {"cpu_score": 25, "ram_gb": 25, "gpu_score": 25},
    "lap_trinh": {"cpu_score": 60, "ram_gb": 60, "gpu_score": 25},
    "thiet_ke": {"srgb_100": 1, "cpu_score": 75, "ram_gb": 75, "gpu_score": 60},
    "xem_phim": {"cpu_score": 25, "ram_gb": 25},
}

def build_activity_vector(catalog: pd.DataFrame, activities: list[str]) -> dict:
    """Moi gia tri trong ACTIVITY_TARGETS la phan vi muc tieu da tinh huong (vd. weight_kg: 25
    nghia la muon nhe, tuc phan vi thap). Khi nhieu hoat dong cung tac dong len mot dac trung,
    lay phan vi lech xa trung vi (50) nhat - do la yeu cau ro rang hon la "trung binh cong"."""
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
    return {
        "segment": labels[order[0]],
        "confidence": float(proba[order[0]]),
        "distribution": {labels[i]: float(proba[i]) for i in order},
    }
