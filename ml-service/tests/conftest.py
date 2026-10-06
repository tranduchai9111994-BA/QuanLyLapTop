import json
from pathlib import Path

import pandas as pd
import pytest

from app.data.features import enrich_catalog

ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = ROOT / "data"


@pytest.fixture(scope="session")
def enriched_catalog() -> pd.DataFrame:
    """Catalog đã thêm đặc trưng dẫn xuất và cột id, dùng chung cả phiên test."""
    catalog = pd.read_csv(DATA_DIR / "processed" / "catalog_vn.csv")
    cpu_bench = pd.read_csv(DATA_DIR / "processed" / "cpu_benchmark.csv")
    gpu_bench = pd.read_csv(DATA_DIR / "processed" / "gpu_benchmark.csv")
    df = enrich_catalog(catalog, cpu_bench, gpu_bench)
    df.insert(0, "id", range(1, len(df) + 1))
    return df


@pytest.fixture(scope="session")
def personas() -> list[dict]:
    """Bộ persona mẫu đọc từ data/personas/personas.json."""
    return json.loads((DATA_DIR / "personas" / "personas.json").read_text(encoding="utf-8"))
