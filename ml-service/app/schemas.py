"""Pydantic schemas cho FastAPI routes (docs/06 SS4)."""
from __future__ import annotations

from typing import Any, Optional

from pydantic import BaseModel, Field


class CatalogSyncRequest(BaseModel):
    """Backend đẩy snapshot đã tính sẵn đặc trưng (cpu_score, gpu_score, ppi, gpu_dedicated,...).
    Dùng dict linh hoạt vì ML service không sở hữu schema catalog (Backend là nguồn sự thật)."""
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
    # Trọng số uy tín thương hiệu (tăng khi người dùng nhắc "bền", "bảo hành tốt")
    brandWeight: float = 1.0
    # FR-13: admin sửa trọng số NỀN theo phân khúc (KnowledgeConfig "default_weights"). None = dùng
    # BASE_WEIGHT_BY_SEGMENT trong retriever.py; dạng {"GAMING": {"performance": 1.3, ...}}, chỉ ghi
    # đè phân khúc có mặt trong dict.
    baseWeightsOverride: Optional[dict[str, dict[str, float]]] = None


class SimilarRequest(BaseModel):
    laptopId: int
    k: int = 6


class TrainRequest(BaseModel):
    note: Optional[str] = None
