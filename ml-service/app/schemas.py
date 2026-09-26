"""Pydantic schemas cho FastAPI routes (docs/06 SS4)."""
from __future__ import annotations

from typing import Any, Optional

from pydantic import BaseModel, Field


class CatalogSyncRequest(BaseModel):
    """Backend day snapshot da tinh san dac trung (cpu_score, gpu_score, ppi, gpu_dedicated,...).
    Dung dict linh hoat vi ML service khong so huu schema catalog (Backend la nguon su that)."""
    items: list[dict[str, Any]]


class PredictSegmentRequest(BaseModel):
    items: list[dict[str, Any]]


class Budget(BaseModel):
    min: float
    max: float


class Priorities(BaseModel):
    performance: int = Field(ge=1, le=5, default=3)
    mobility: int = Field(ge=1, le=5, default=3)
    display: int = Field(ge=1, le=5, default=3)
    price: int = Field(ge=1, le=5, default=3)


class RecommendRequest(BaseModel):
    candidateIds: list[int]
    segment: str
    budget: Budget
    priorities: Priorities
    must: dict[str, Any] = Field(default_factory=dict)
    topN: int = 5
    # Trong so uy tin thuong hieu (tang len khi nguoi dung nhac den "ben", "bao hanh tot")
    brandWeight: float = 1.0


class SimilarRequest(BaseModel):
    laptopId: int
    k: int = 6


class TrainRequest(BaseModel):
    note: Optional[str] = None
