"""Nạp / kích hoạt phiên bản mô hình (docs/06 SS2)."""
from __future__ import annotations

import json
from pathlib import Path

import joblib
from sklearn.pipeline import Pipeline

ARTIFACTS_DIR = Path(__file__).resolve().parents[2] / "artifacts"


class ModelRegistry:
    def __init__(self) -> None:
        self.version: str | None = None
        self.model: Pipeline | None = None
        self.metadata: dict | None = None

    def list_versions(self) -> list[str]:
        if not ARTIFACTS_DIR.exists():
            return []
        return sorted(
            p.name for p in ARTIFACTS_DIR.iterdir() if p.is_dir() and (p / "metadata.json").exists()
        )

    def load_metadata(self, version: str) -> dict:
        path = ARTIFACTS_DIR / version / "metadata.json"
        return json.loads(path.read_text(encoding="utf-8"))

    def activate(self, version: str) -> None:
        model_path = ARTIFACTS_DIR / version / "model.joblib"
        if not model_path.exists():
            raise FileNotFoundError(f"Khong tim thay artifact cho version {version}")
        self.model = joblib.load(model_path)
        self.metadata = self.load_metadata(version)
        self.version = version

    def activate_latest(self) -> bool:
        latest_path = ARTIFACTS_DIR / "LATEST"
        if not latest_path.exists():
            return False
        self.activate(latest_path.read_text(encoding="utf-8").strip())
        return True


registry = ModelRegistry()
