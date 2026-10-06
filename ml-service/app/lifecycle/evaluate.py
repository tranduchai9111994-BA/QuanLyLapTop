"""Đánh giá định lượng Mô hình B (truy hồi) và Mô hình C (phân loại câu tự do).

Chạy: python -m app.lifecycle.evaluate

Mô hình B được so với 3 baseline:
  - price_asc   : sắp theo giá tăng dần (cách người dùng hay làm nhất)
  - value_desc  : sắp theo value_index (hiệu năng/giá) giảm dần
  - random      : chọn ngẫu nhiên (mốc dưới)

Độ liên quan tính tự động từ hồ sơ persona, không gán nhãn tay (xem relevance_scores).
"""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.model_selection import StratifiedKFold, cross_val_predict, cross_val_score
from sklearn.metrics import classification_report, confusion_matrix

from app.models.classifier import build_pipeline
from app.data.features import MODEL_A_FEATURES, enrich_catalog
from app.models.retriever import build_ideal_vector, build_weights, fit_scaler, recommend
from app.models.segment_inference import infer_segment
from app.models.text_classifier import NeedTextModel, build_text_pipeline, normalize_text

RANDOM_STATE = 42
ROOT = Path(__file__).resolve().parents[3]
DATA_DIR = ROOT / "data"
ARTIFACTS_DIR = Path(__file__).resolve().parents[2] / "artifacts"
TOP_K = 5


def load_catalog() -> pd.DataFrame:
    catalog = pd.read_csv(DATA_DIR / "processed" / "catalog_vn.csv")
    cpu = pd.read_csv(DATA_DIR / "processed" / "cpu_benchmark.csv")
    gpu = pd.read_csv(DATA_DIR / "processed" / "gpu_benchmark.csv")
    df = enrich_catalog(catalog, cpu, gpu)
    df.insert(0, "id", range(1, len(df) + 1))
    return df


def load_personas() -> list[dict]:
    return json.loads((DATA_DIR / "personas" / "personas.json").read_text(encoding="utf-8"))


# ---------------------------------------------------------------------------
# Độ liên quan (graded relevance), tính tự động từ hồ sơ persona
# ---------------------------------------------------------------------------
def relevance_scores(cand: pd.DataFrame, persona: dict) -> pd.Series:
    """Điểm "hài lòng" của persona với từng máy, không gán nhãn tay.

        gain(máy) = feasible x SUM_g ( p_g / 5 ) x mức_đạt_được_g(máy)

    mức_đạt_được_g là hạng phân vị (0..1) của máy trong tập ứng viên theo hướng tốt của tiêu chí g,
    không phải nhị phân, nên tiêu chí mức 2-3 vẫn đóng góp (ít hơn). Cách đo này công bằng với
    baseline một chiều (chỉ rẻ, chỉ đắt tiền).
    """
    inp = persona["input"]
    priorities = inp["priorities"]
    must = inp.get("must", {})
    budget_max = inp["budget"][1]

    feasible = cand["price_vnd"] <= budget_max
    if must.get("ram_min"):
        feasible &= cand["ram_gb"] >= must["ram_min"]
    if must.get("gpu_dedicated"):
        feasible &= cand["gpu_dedicated"] == 1

    def pct_rank(series: pd.Series, higher_is_better: bool) -> pd.Series:
        r = series.rank(pct=True)
        return r if higher_is_better else 1.0 - r

    achieved = {
        "performance": pct_rank(0.6 * cand["cpu_score"] + 0.4 * cand["gpu_score"], True),
        "mobility": pct_rank(cand["weight_kg"], False),
        "display": pct_rank(
            0.5 * pct_rank(cand["ppi"], True)
            + 0.3 * pct_rank(cand["refresh_hz"], True)
            + 0.2 * cand["srgb_100"],
            True,
        ),
        "price": pct_rank(cand["price_vnd"], False),
    }

    gain = pd.Series(0.0, index=cand.index)
    for group, level in priorities.items():
        if group in achieved:
            gain += (level / 5.0) * achieved[group]

    return (gain * feasible.astype(float)).astype(float)


def dcg(gains: list[float]) -> float:
    return float(sum(g / np.log2(i + 2) for i, g in enumerate(gains)))


def ndcg_at_k(ranked_gains: list[float], all_gains: pd.Series, k: int = TOP_K) -> float:
    ideal = sorted(all_gains.tolist(), reverse=True)[:k]
    idcg = dcg(ideal)
    return dcg(ranked_gains[:k]) / idcg if idcg > 0 else 0.0


# ---------------------------------------------------------------------------
# Các phương pháp xếp hạng để so sánh
# ---------------------------------------------------------------------------
def rank_knn(cand: pd.DataFrame, scaler, persona: dict, segment: str) -> pd.DataFrame:
    inp = persona["input"]
    budget = {"min": inp["budget"][0], "max": inp["budget"][1]}
    ideal = build_ideal_vector(cand, inp["priorities"], inp.get("must", {}), budget, segment)
    weights = build_weights(inp["priorities"], segment)
    _, idx = recommend(cand, scaler, ideal, weights, top_n=TOP_K, preferred_segment=segment)
    return cand.iloc[idx]


def rank_price_asc(cand: pd.DataFrame, *_args) -> pd.DataFrame:
    return cand.nsmallest(TOP_K, "price_vnd")


def rank_value_desc(cand: pd.DataFrame, *_args) -> pd.DataFrame:
    return cand.nlargest(TOP_K, "value_index")


def rank_random(cand: pd.DataFrame, *_args) -> pd.DataFrame:
    return cand.sample(min(TOP_K, len(cand)), random_state=RANDOM_STATE)


def evaluate_model_b(df: pd.DataFrame, personas: list[dict]) -> dict:
    scaler = fit_scaler(df)
    model_a = build_pipeline()
    model_a.set_params(knn__n_neighbors=5, knn__weights="distance", knn__metric="euclidean")
    model_a.fit(df[MODEL_A_FEATURES], df["segment"])

    methods = {
        "kNN one-sided (Mo hinh B)": "knn",
        "Baseline: gia tang dan": "price_asc",
        "Baseline: value_index": "value_desc",
        "Baseline: ngau nhien": "random",
    }
    results = {name: {"precision": [], "ndcg": [], "budget_ok": []} for name in methods}

    for persona in personas:
        inp = persona["input"]
        budget_max = inp["budget"][1]
        must = inp.get("must", {})
        segment = inp["segment"] or infer_segment(model_a, df, inp["activities"])["segment"]

        # Chỉ lọc cứng theo ngân sách + must, không lọc theo phân khúc (lọc mềm)
        cand = df[df["price_vnd"] <= budget_max]
        if must.get("ram_min"):
            cand = cand[cand["ram_gb"] >= must["ram_min"]]
        if must.get("gpu_dedicated"):
            cand = cand[cand["gpu_dedicated"] == 1]
        if len(cand) < TOP_K:
            continue

        gains = relevance_scores(cand, persona)
        relevant_threshold = float(gains.quantile(0.80))

        for name, kind in methods.items():
            if kind == "knn":
                top = rank_knn(cand, scaler, persona, segment)
            elif kind == "price_asc":
                top = rank_price_asc(cand)
            elif kind == "value_desc":
                top = rank_value_desc(cand)
            else:
                top = rank_random(cand)

            top_gains = gains.loc[top.index].tolist()
            # Precision@K: máy tính là "trúng" nếu thuộc 20% hài lòng nhất của tập ứng viên
            precision = float(np.mean([g >= relevant_threshold for g in top_gains]))
            results[name]["precision"].append(precision)
            results[name]["ndcg"].append(ndcg_at_k(top_gains, gains))
            results[name]["budget_ok"].append(float((top["price_vnd"] <= budget_max).all()))

    summary = {
        name: {
            "precision_at_5": round(float(np.mean(v["precision"])), 4),
            "ndcg_at_5": round(float(np.mean(v["ndcg"])), 4),
            "budget_compliance": round(float(np.mean(v["budget_ok"])), 4),
            "n_personas": len(v["precision"]),
        }
        for name, v in results.items()
    }
    return summary


def evaluate_search_effort(df: pd.DataFrame, personas: list[dict]) -> dict:
    """Công sức tìm kiếm: người dùng phải xem bao nhiêu máy mới gặp máy phù hợp.

    Thay cho đo thời gian thật, tái lập được bằng code:
      - Không có hệ thống: duyệt theo giá tăng dần, đọc lần lượt đến khi gặp máy thỏa nhu cầu.
      - Có hệ thống: đọc lần lượt trong top-5 gợi ý.
    "Máy thỏa nhu cầu" = nằm trong 20% hài lòng nhất (cùng định nghĩa relevance ở trên).
    """
    scaler = fit_scaler(df)
    model_a = build_pipeline()
    model_a.set_params(knn__n_neighbors=5, knn__weights="distance", knn__metric="euclidean")
    model_a.fit(df[MODEL_A_FEATURES], df["segment"])

    manual_positions, system_positions, system_found = [], [], 0
    for persona in personas:
        inp = persona["input"]
        must = inp.get("must", {})
        segment = inp["segment"] or infer_segment(model_a, df, inp["activities"])["segment"]

        cand = df[df["price_vnd"] <= inp["budget"][1]]
        if must.get("ram_min"):
            cand = cand[cand["ram_gb"] >= must["ram_min"]]
        if must.get("gpu_dedicated"):
            cand = cand[cand["gpu_dedicated"] == 1]
        if len(cand) < TOP_K:
            continue

        gains = relevance_scores(cand, persona)
        threshold = float(gains.quantile(0.80))

        # (a) Duyệt thủ công: sắp theo giá tăng dần, đếm số máy phải xem
        manual_order = cand.sort_values("price_vnd").index
        pos = next((i + 1 for i, idx in enumerate(manual_order) if gains.loc[idx] >= threshold), len(cand))
        manual_positions.append(pos)

        # (b) Dùng hệ thống: xem trong top-5
        top = rank_knn(cand, scaler, persona, segment)
        hit = next((i + 1 for i, idx in enumerate(top.index) if gains.loc[idx] >= threshold), None)
        if hit:
            system_positions.append(hit)
            system_found += 1

    return {
        "n_personas": len(manual_positions),
        "manual_avg_items_viewed": round(float(np.mean(manual_positions)), 1),
        "manual_median_items_viewed": float(np.median(manual_positions)),
        "system_avg_items_viewed": round(float(np.mean(system_positions)), 2) if system_positions else None,
        "system_hit_rate_top5": round(system_found / len(manual_positions), 4) if manual_positions else 0,
        "speedup_times": round(float(np.mean(manual_positions) / np.mean(system_positions)), 1)
        if system_positions
        else None,
    }


def evaluate_model_a(df: pd.DataFrame) -> dict:
    """Mô hình A: macro-F1 + confusion matrix bằng cross-validation (không chạm tập test)."""
    X, y = df[MODEL_A_FEATURES], df["segment"]
    cv = StratifiedKFold(5, shuffle=True, random_state=RANDOM_STATE)
    pipe = build_pipeline()
    pipe.set_params(knn__n_neighbors=15, knn__weights="distance", knn__metric="euclidean")

    f1 = cross_val_score(pipe, X, y, cv=cv, scoring="f1_macro", n_jobs=-1)
    y_pred = cross_val_predict(pipe, X, y, cv=cv, n_jobs=-1)
    labels = sorted(y.unique())
    return {
        "cv_f1_macro_mean": round(float(f1.mean()), 4),
        "cv_f1_macro_std": round(float(f1.std()), 4),
        "labels": labels,
        "confusion_matrix": confusion_matrix(y, y_pred, labels=labels).tolist(),
        "report": classification_report(y, y_pred, output_dict=True, zero_division=0),
    }


def evaluate_model_c() -> dict:
    """Mô hình C: macro-F1 cross-validation trên tập câu nhu cầu."""
    m = NeedTextModel()
    m.load_samples()
    X = [normalize_text(s["text"]) for s in m.samples]
    y = [s["label"] for s in m.samples]
    cv = StratifiedKFold(5, shuffle=True, random_state=RANDOM_STATE)

    per_k = {}
    for k in (1, 3, 5, 7):
        scores = cross_val_score(build_text_pipeline(k), X, y, cv=cv, scoring="f1_macro")
        per_k[k] = round(float(scores.mean()), 4)
    best_k = max(per_k, key=per_k.get)

    y_pred = cross_val_predict(build_text_pipeline(best_k), X, y, cv=cv)
    labels = sorted(set(y))
    return {
        "n_samples": len(X),
        "n_labels": len(labels),
        "f1_macro_by_k": per_k,
        "best_k": best_k,
        "cv_f1_macro": per_k[best_k],
        "labels": labels,
        "confusion_matrix": confusion_matrix(y, y_pred, labels=labels).tolist(),
    }


def main() -> None:
    df = load_catalog()
    personas = load_personas()

    print("=" * 74)
    print("MÔ HÌNH A - phân lớp phân khúc (kNN trên đặc trưng kỹ thuật)")
    print("=" * 74)
    a = evaluate_model_a(df)
    print(f"  macro-F1 (5-fold CV): {a['cv_f1_macro_mean']:.4f} (+/- {a['cv_f1_macro_std']:.4f})")
    print(f"  Nhãn: {a['labels']}")
    print("  Confusion matrix (hàng = thật, cột = dự đoán):")
    for lab, row in zip(a["labels"], a["confusion_matrix"]):
        print(f"    {lab:10s} {row}")
    print("  Recall từng lớp:")
    for lab in a["labels"]:
        print(f"    {lab:10s} recall={a['report'][lab]['recall']:.3f}  f1={a['report'][lab]['f1-score']:.3f}")

    print()
    print("=" * 74)
    print("MÔ HÌNH C - phân loại câu nhu cầu tự do (TF-IDF + kNN)")
    print("=" * 74)
    c = evaluate_model_c()
    print(f"  Số câu huấn luyện: {c['n_samples']} | số nhãn: {c['n_labels']}")
    print(f"  macro-F1 theo k: {c['f1_macro_by_k']}  -> chọn k={c['best_k']} ({c['cv_f1_macro']:.4f})")
    print("  Confusion matrix:")
    for lab, row in zip(c["labels"], c["confusion_matrix"]):
        print(f"    {lab:10s} {row}")

    print()
    print("=" * 74)
    print(f"MÔ HÌNH B - truy hồi top-{TOP_K} (so với baseline, trên {len(personas)} persona)")
    print("=" * 74)
    b = evaluate_model_b(df, personas)
    print(f"  {'Phương pháp':<28} {'P@5':>8} {'nDCG@5':>9} {'Đúng ngân sách':>16}")
    for name, m in b.items():
        print(f"  {name:<28} {m['precision_at_5']:>8.3f} {m['ndcg_at_5']:>9.3f} {m['budget_compliance']:>15.0%}")

    knn_ndcg = b["kNN one-sided (Mo hinh B)"]["ndcg_at_5"]
    best_baseline = max(v["ndcg_at_5"] for k, v in b.items() if "Baseline" in k)
    print(f"\n  => kNN vượt baseline tốt nhất: {knn_ndcg - best_baseline:+.3f} nDCG@5")

    print()
    print("=" * 74)
    print("ĐO THỰC TẾ - công sức tìm kiếm (số máy phải xem qua)")
    print("=" * 74)
    e = evaluate_search_effort(df, personas)
    print(f"  Duyệt thủ công (sắp theo giá) : {e['manual_avg_items_viewed']} máy/lần "
          f"(trung vị {e['manual_median_items_viewed']:.0f})")
    print(f"  Dùng hệ thống gợi ý           : {e['system_avg_items_viewed']} máy/lần")
    print(f"  Tỷ lệ tìm thấy ngay trong top-5: {e['system_hit_rate_top5']:.0%}")
    print(f"  => Nhanh hơn khoảng {e['speedup_times']} lần về số máy phải xem")

    out = {"model_a": a, "model_b": b, "model_c": c, "search_effort": e}
    ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
    path = ARTIFACTS_DIR / "evaluation.json"
    path.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\nĐã lưu kết quả -> {path}")


if __name__ == "__main__":
    main()
