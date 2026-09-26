"""FastAPI routes cho ML service (docs/06 SS4)."""
from __future__ import annotations

from datetime import datetime, timezone

import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException

from app.explain import build_explanation
from app.features import MODEL_A_FEATURES, MODEL_B_FEATURES
from app.registry import registry
from app.retriever import build_ideal_vector, build_weights, fit_scaler, match_pct, recommend, similar_items
from app.schemas import CatalogSyncRequest, PredictSegmentRequest, RecommendRequest, SimilarRequest, TrainRequest
from app.segment_inference import infer_segment

app = FastAPI(title="SmartLap ML service")

_state: dict = {"catalog": None, "scaler": None, "index_built_at": None}


@app.on_event("startup")
def on_startup() -> None:
    registry.activate_latest()


@app.get("/health")
def health() -> dict:
    catalog = _state["catalog"]
    return {
        "status": "ok",
        "clfVersion": registry.version,
        "catalogSize": 0 if catalog is None else len(catalog),
        "indexBuiltAt": _state["index_built_at"],
    }


@app.post("/catalog/sync")
def catalog_sync(req: CatalogSyncRequest) -> dict:
    df = pd.DataFrame(req.items)
    df = df.rename(columns={"id": "laptop_id"}).set_index("laptop_id", drop=False)
    _state["catalog"] = df
    _state["scaler"] = fit_scaler(df)
    _state["index_built_at"] = datetime.now(timezone.utc).isoformat()
    return {"catalogSize": len(df), "indexBuiltAt": _state["index_built_at"]}


def _require_catalog() -> pd.DataFrame:
    if _state["catalog"] is None:
        raise HTTPException(status_code=409, detail="Catalog chua duoc dong bo (/catalog/sync)")
    return _state["catalog"]


@app.post("/predict-segment")
def predict_segment(req: PredictSegmentRequest) -> dict:
    if registry.model is None:
        raise HTTPException(status_code=503, detail="Chua co mo hinh phan lop duoc kich hoat")
    X = pd.DataFrame(req.items)
    for col in MODEL_A_FEATURES:
        if col not in X.columns:
            X[col] = 0
    proba = registry.model.predict_proba(X[MODEL_A_FEATURES])
    labels = registry.model.classes_
    results = []
    for row_proba in proba:
        order = np.argsort(row_proba)[::-1]
        results.append({
            "label": labels[order[0]],
            "proba": float(row_proba[order[0]]),
            "distribution": {labels[i]: float(row_proba[i]) for i in order},
        })
    return {"items": results, "modelVersion": registry.version}


@app.post("/infer-segment")
def infer_segment_endpoint(payload: dict) -> dict:
    """{activities: [...]}. -> suy phan khuc tu hoat dong khi nguoi dung chon 'Chua ro'."""
    catalog = _require_catalog()
    if registry.model is None:
        raise HTTPException(status_code=503, detail="Chua co mo hinh phan lop duoc kich hoat")
    activities = payload.get("activities", [])
    result = infer_segment(registry.model, catalog, activities)
    result["modelVersion"] = registry.version
    return result


@app.post("/recommend")
def recommend_endpoint(req: RecommendRequest) -> dict:
    catalog = _require_catalog()
    candidates = catalog.loc[catalog["laptop_id"].isin(req.candidateIds)]
    if candidates.empty:
        return {"ideal": {}, "weights": {}, "items": []}

    ideal = build_ideal_vector(
        candidates, req.priorities.model_dump(), req.must, req.budget.model_dump(), req.segment
    )
    weights = build_weights(req.priorities.model_dump(), req.segment)
    dist, idx = recommend(candidates, _state["scaler"], ideal, weights, req.topN)
    pct = match_pct(dist)

    picked = candidates.iloc[idx]
    items = []
    for rank, (dist_i, pct_i, (_, row)) in enumerate(zip(dist, pct, picked.iterrows()), start=1):
        explanation = build_explanation(row.to_dict(), ideal, weights, req.budget.max)
        items.append({
            "rank": rank,
            "laptopId": int(row["laptop_id"]),
            "distance": float(dist_i),
            "matchPct": round(float(pct_i), 1),
            "explanation": explanation,
        })

    return {"ideal": ideal, "weights": weights, "items": items, "modelVersion": registry.version}


@app.post("/similar")
def similar_endpoint(req: SimilarRequest) -> dict:
    catalog = _require_catalog()
    if req.laptopId not in catalog.index:
        raise HTTPException(status_code=404, detail="Khong tim thay laptop trong catalog da dong bo")
    pos = catalog.index.get_loc(req.laptopId)
    dist, idx = similar_items(catalog, _state["scaler"], pos, k=req.k + 1)
    picked = catalog.iloc[idx]
    items = [
        {"laptopId": int(row["laptop_id"]), "distance": float(d)}
        for d, (_, row) in zip(dist, picked.iterrows())
    ]
    return {"items": items}


@app.post("/train")
def train_endpoint(req: TrainRequest) -> dict:
    from app import train as train_module

    train_module.main()
    registry.activate_latest()
    return {"version": registry.version, "metadata": registry.metadata}


@app.post("/models/{version}/activate")
def activate_model(version: str) -> dict:
    try:
        registry.activate(version)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return {"version": registry.version}


@app.get("/models/{version}")
def get_model(version: str) -> dict:
    try:
        return registry.load_metadata(version)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail="Khong tim thay version") from exc
