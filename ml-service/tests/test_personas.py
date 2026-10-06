"""Chạy 30 persona qua đúng luồng nghiệp vụ:

    câu tự do -> Mô hình C (TF-IDF + kNN) -> hồ sơ nhu cầu
              -> lọc cứng (ngân sách, must; không lọc cứng theo phân khúc)
              -> Mô hình B (kNN một phía, lọc mềm phân khúc) -> top-N

Phân khúc chỉ là một đặc trưng trong metric nên không ép phân khúc suy ra phải đúng.
"""
from app.models.classifier import build_pipeline
from app.data.features import MODEL_A_FEATURES
from app.models.retriever import build_ideal_vector, build_weights, fit_scaler, recommend
from app.models.segment_inference import infer_segment
from app.models.text_classifier import NeedTextModel


def _run_persona(catalog, model, scaler, persona):
    inp = persona["input"]
    segment = inp["segment"] or infer_segment(model, catalog, inp["activities"])["segment"]

    budget = {"min": inp["budget"][0], "max": inp["budget"][1]}
    must = inp.get("must", {})

    # lọc cứng chỉ gồm ngân sách tối đa và ràng buộc người dùng nói rõ
    cand = catalog[catalog["price_vnd"] <= budget["max"]]
    if must.get("ram_min"):
        cand = cand[cand["ram_gb"] >= must["ram_min"]]
    if must.get("gpu_dedicated"):
        cand = cand[cand["gpu_dedicated"] == 1]
    if cand.empty:
        return None, segment

    priorities = inp["priorities"]
    ideal = build_ideal_vector(cand, priorities, must, budget, segment)
    weights = build_weights(priorities, segment)
    _, idx = recommend(cand, scaler, ideal, weights, top_n=5, preferred_segment=segment)
    return cand.iloc[idx], segment


def test_personas(enriched_catalog, personas):
    catalog = enriched_catalog
    model = build_pipeline()
    model.set_params(knn__n_neighbors=5, knn__weights="distance", knn__metric="euclidean")
    model.fit(catalog[MODEL_A_FEATURES], catalog["segment"])
    scaler = fit_scaler(catalog)

    passed, failures = 0, []
    for persona in personas:
        items, _ = _run_persona(catalog, model, scaler, persona)
        expect = persona["expect"]
        ok = items is not None
        if ok:
            if "all_price_lte" in expect and not (items["price_vnd"] <= expect["all_price_lte"]).all():
                ok = False
            if "all_ram_gte" in expect and not (items["ram_gb"] >= expect["all_ram_gte"]).all():
                ok = False
            if expect.get("top1_gpu_dedicated") and items.iloc[0]["gpu_dedicated"] != 1:
                ok = False
        passed += ok
        if not ok:
            failures.append(persona["id"])

    rate = passed / len(personas)
    print(f"Ty le persona dat: {rate:.0%} ({passed}/{len(personas)}). That bai: {failures}")
    assert rate >= 0.9, f"Tỷ lệ persona đạt {rate:.0%} < 90%. Thất bại: {failures}"


def test_need_text_model_on_personas(personas):
    """Mô hình C đoán đúng nhãn nhu cầu từ câu tự do của persona (>= 80%)."""
    model = NeedTextModel(n_neighbors=7).fit()
    correct, wrong = 0, []
    for p in personas:
        if not p.get("text") or not p.get("need_label_expect"):
            continue
        pred = model.predict(p["text"])
        if pred["label"] == p["need_label_expect"]:
            correct += 1
        else:
            wrong.append((p["id"], p["text"], pred["label"], p["need_label_expect"]))

    total = sum(1 for p in personas if p.get("text"))
    rate = correct / total
    print(f"Mo hinh C doan dung nhan nhu cau: {rate:.0%} ({correct}/{total})")
    for w in wrong:
        print("   sai:", w)
    assert rate >= 0.8, f"Chỉ đạt {rate:.0%} < 80%"


def test_need_text_produces_valid_query(personas):
    """Câu tự do phải sinh ra hồ sơ truy vấn hợp lệ (đủ trường, giá trị trong miền cho phép)."""
    model = NeedTextModel(n_neighbors=7).fit()
    for p in personas:
        if not p.get("text"):
            continue
        need = model.parse_need(p["text"])
        assert need["budget"]["min"] < need["budget"]["max"], p["id"]
        assert set(need["priorities"]) >= {"performance", "mobility", "display", "price"}, p["id"]
        for key, val in need["priorities"].items():
            assert 1 <= val <= 5, f"{p['id']}: {key}={val} ngoài thang 1-5"
        assert need["activities"], p["id"]
