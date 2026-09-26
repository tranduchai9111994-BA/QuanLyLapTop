"""Dung dac trung tu catalog tho (xem docs/03 SmartLap SS3/SS5)."""
from __future__ import annotations

import re

import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import FunctionTransformer, StandardScaler

NUMERIC_LOG = ["ram_gb", "ssd_gb"]
NUMERIC = ["cpu_score", "gpu_score", "screen_inch", "ppi", "refresh_hz", "weight_kg", "battery_wh"]
BINARY = ["gpu_dedicated", "srgb_100"]
MODEL_A_FEATURES = NUMERIC_LOG + NUMERIC + BINARY  # price_vnd KHONG duoc dua vao (D-04)
# Mo hinh B (truy hoi) CO dung gia, uy tin thuong hieu va value_index (hieu nang tren moi trieu
# dong) - dung ten de tai "hieu nang va gia thanh". value_index giup mo hinh danh gia duoc
# "dang tien hay khong" ngay trong metric, thay vi chi la huy hieu hien thi nhu truoc.
MODEL_B_FEATURES = MODEL_A_FEATURES + ["price_vnd", "brand_tier", "value_index"]

DEDICATED_GPU_MARKERS = ("geforce", "radeon rx", "rtx", "quadro", "arc a")


def normalize_name(name: str) -> str:
    name = str(name).lower()
    for token in ("(r)", "(tm)", "processor"):
        name = name.replace(token, "")
    return re.sub(r"\s+", " ", name).strip()


def build_bench_lookup(bench_df: pd.DataFrame) -> dict[str, float]:
    max_raw = bench_df["raw_score"].max()
    lookup: dict[str, float] = {}
    for _, row in bench_df.iterrows():
        score = 100.0 * row["raw_score"] / max_raw
        lookup[normalize_name(row["pattern"])] = score
        lookup[normalize_name(row["display_name"])] = score
    return lookup


def match_score(model_name: str, lookup: dict[str, float]) -> float | None:
    norm = normalize_name(model_name)
    if norm in lookup:
        return lookup[norm]
    for key, score in lookup.items():
        if key in norm or norm in key:
            return score
    return None


def is_gpu_dedicated(gpu_model: str) -> int:
    norm = normalize_name(gpu_model)
    return int(any(marker in norm for marker in DEDICATED_GPU_MARKERS))


def compute_ppi(resolution: str, screen_inch: float) -> float:
    w, h = (int(x) for x in str(resolution).lower().split("x"))
    return float(np.sqrt(w**2 + h**2) / screen_inch)


def enrich_catalog(catalog: pd.DataFrame, cpu_bench: pd.DataFrame, gpu_bench: pd.DataFrame) -> pd.DataFrame:
    """Them cpu_score, gpu_score, gpu_dedicated, ppi, performance_index, value_index."""
    df = catalog.copy()
    cpu_lookup = build_bench_lookup(cpu_bench)
    gpu_lookup = build_bench_lookup(gpu_bench)

    cpu_scores, gpu_scores, unmatched_cpu, unmatched_gpu = [], [], [], []
    for _, row in df.iterrows():
        cs = match_score(row["cpu_model"], cpu_lookup)
        gs = match_score(row["gpu_model"], gpu_lookup)
        if cs is None:
            unmatched_cpu.append(row["cpu_model"])
            cs = 0.0
        if gs is None:
            unmatched_gpu.append(row["gpu_model"])
            gs = 0.0
        cpu_scores.append(cs)
        gpu_scores.append(gs)

    if unmatched_cpu or unmatched_gpu:
        raise ValueError(
            f"Khong khop bang benchmark. CPU: {sorted(set(unmatched_cpu))} "
            f"GPU: {sorted(set(unmatched_gpu))}"
        )

    df["cpu_score"] = cpu_scores
    df["gpu_score"] = gpu_scores

    # Uu tien cot `dedicated` that trong bang benchmark; chi suy tu ten khi bang khong co cot do
    if "dedicated" in gpu_bench.columns:
        ded_map = {normalize_name(r["display_name"]): int(r["dedicated"]) for _, r in gpu_bench.iterrows()}
        df["gpu_dedicated"] = df["gpu_model"].apply(
            lambda g: ded_map.get(normalize_name(g), is_gpu_dedicated(g))
        )
    else:
        df["gpu_dedicated"] = df["gpu_model"].apply(is_gpu_dedicated)

    if "brand_tier" not in df.columns:
        df["brand_tier"] = 3  # mac dinh trung binh neu catalog cu chua co cot nay

    df["ppi"] = df.apply(lambda r: compute_ppi(r["resolution"], r["screen_inch"]), axis=1)
    df["refresh_hz"] = df["refresh_hz"].fillna(60)
    df["battery_wh"] = df.groupby("segment")["battery_wh"].transform(
        lambda s: s.fillna(s.median())
    )

    ram_norm = df["ram_gb"] / df["ram_gb"].max()
    ssd_norm = df["ssd_gb"] / df["ssd_gb"].max()
    df["performance_index"] = (
        0.5 * df["cpu_score"] + 0.35 * df["gpu_score"] + 0.1 * (100 * ram_norm) + 0.05 * (100 * ssd_norm)
    )
    df["value_index"] = df["performance_index"] / (df["price_vnd"] / 1_000_000)
    return df


def build_model_a_preprocessor() -> ColumnTransformer:
    return ColumnTransformer([
        (
            "log",
            Pipeline([
                ("impute", SimpleImputer(strategy="median")),
                ("log", FunctionTransformer(np.log2, feature_names_out="one-to-one")),
                ("sc", StandardScaler()),
            ]),
            NUMERIC_LOG,
        ),
        (
            "num",
            Pipeline([
                ("impute", SimpleImputer(strategy="median")),
                ("sc", StandardScaler()),
            ]),
            NUMERIC,
        ),
        ("bin", "passthrough", BINARY),
    ])
