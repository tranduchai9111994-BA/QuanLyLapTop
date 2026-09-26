from app.classifier import build_pipeline
from app.features import MODEL_A_FEATURES
from app.retriever import build_ideal_vector, build_weights, fit_scaler, recommend
from app.segment_inference import infer_segment


def _run_persona(catalog, model, scaler, persona):
    inp = persona["input"]
    if inp["segment"]:
        segment = inp["segment"]
    else:
        segment = infer_segment(model, catalog, inp["activities"])["segment"]

    candidates = catalog[catalog["segment"] == segment].copy()
    budget = {"min": inp["budget"][0], "max": inp["budget"][1]}
    candidates = candidates[candidates["price_vnd"] <= budget["max"]]

    must = inp.get("must", {})
    if must.get("ram_min"):
        candidates = candidates[candidates["ram_gb"] >= must["ram_min"]]
    if must.get("gpu_dedicated"):
        candidates = candidates[candidates["gpu_dedicated"] == 1]

    if candidates.empty:
        return None, segment

    priorities = inp["priorities"]
    ideal = build_ideal_vector(candidates, priorities, must, budget, segment)
    weights = build_weights(priorities, segment)
    dist, idx = recommend(candidates, scaler, ideal, weights, top_n=5)
    return candidates.iloc[idx], segment


def test_personas(enriched_catalog, personas):
    catalog = enriched_catalog
    model = build_pipeline()
    model.set_params(knn__n_neighbors=5, knn__weights="distance", knn__metric="euclidean")
    model.fit(catalog[MODEL_A_FEATURES], catalog["segment"])
    scaler = fit_scaler(catalog)

    passed = 0
    failures = []
    for persona in personas:
        items, segment = _run_persona(catalog, model, scaler, persona)
        expect = persona["expect"]
        ok = True
        if items is None:
            ok = False
        else:
            if "segment_in" in expect and segment not in expect["segment_in"]:
                ok = False
            if "all_price_lte" in expect and not (items["price_vnd"] <= expect["all_price_lte"]).all():
                ok = False
            if "all_ram_gte" in expect and not (items["ram_gb"] >= expect["all_ram_gte"]).all():
                ok = False
            if expect.get("top1_gpu_dedicated") and items.iloc[0]["gpu_dedicated"] != 1:
                ok = False
        if ok:
            passed += 1
        else:
            failures.append(persona["id"])

    rate = passed / len(personas)
    print(f"Ty le persona dat: {rate:.0%} ({passed}/{len(personas)}). That bai: {failures}")
    assert rate >= 0.9, f"Ty le persona dat {rate:.0%} < 90%. That bai: {failures}"
