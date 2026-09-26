"""build_explanation() - sinh diem manh/canh bao tieng Viet (docs/04 SS7.2)."""
from __future__ import annotations

def format_vnd(amount: float) -> str:
    return f"{int(round(amount)):,}".replace(",", ".") + " VND"


def build_explanation(
    row: dict, ideal: dict, weights: dict, budget_max: float
) -> dict:
    """row: dac trung cua may (don vi goc). ideal: vector ly tuong q (don vi goc).
    weights: trong so dac trung (Sigma w = 1). Tra ve {strengths, warnings}.
    """
    contributions: list[tuple[str, float, float]] = []  # (feature, signed_diff, weighted_sq)
    for feat, w in weights.items():
        if feat not in row or feat not in ideal:
            continue
        diff = row[feat] - ideal[feat]
        contributions.append((feat, diff, w * diff**2))

    contributions.sort(key=lambda t: t[2])

    strengths: list[dict] = []
    warnings: list[dict] = []

    if row.get("gpu_dedicated"):
        strengths.append({"code": "gpu_dedicated", "params": {"gpu": row.get("gpu_model", "")}, "tone": "positive"})

    if row.get("cpu_score", 0) > ideal.get("cpu_score", 0):
        pct = round(100 * (row["cpu_score"] / max(ideal["cpu_score"], 1e-6) - 1), 1)
        if pct > 2:
            strengths.append({"code": "perf_above", "params": {"pct": pct}, "tone": "positive"})

    if row.get("price_vnd", 0) < budget_max:
        strengths.append({
            "code": "price_under",
            "params": {"money": format_vnd(budget_max - row["price_vnd"])},
            "tone": "positive",
        })

    if row.get("refresh_hz", 60) >= ideal.get("refresh_hz", 60) and row.get("refresh_hz", 60) >= 120:
        srgb_text = "màu chuẩn sRGB" if row.get("srgb_100") else "màu phổ thông"
        strengths.append({
            "code": "display_good",
            "params": {"refresh": int(row["refresh_hz"]), "srgb": srgb_text},
            "tone": "positive",
        })

    if row.get("weight_kg", 0) > ideal.get("weight_kg", 0) + 0.2:
        warnings.append({
            "code": "weight_over",
            "params": {"x": row["weight_kg"], "d": round(row["weight_kg"] - ideal["weight_kg"], 1)},
            "tone": "warning",
        })

    ram_min = ideal.get("ram_gb")
    if ram_min and row.get("ram_gb", 0) < ram_min:
        warnings.append({
            "code": "ram_low",
            "params": {"x": row["ram_gb"], "y": ram_min},
            "tone": "warning",
        })

    if row.get("price_vnd", 0) > budget_max:
        warnings.append({
            "code": "price_over",
            "params": {"money": format_vnd(row["price_vnd"] - budget_max)},
            "tone": "warning",
        })

    if not strengths:
        # dam bao moi ket qua co it nhat 1 diem manh (docs/04 test_explanation_schema)
        cheapest_diff = min(contributions, key=lambda t: t[2]) if contributions else None
        if cheapest_diff:
            strengths.append({
                "code": "perf_above" if cheapest_diff[0] == "cpu_score" else "display_good",
                "params": {"pct": 0} if cheapest_diff[0] == "cpu_score" else {"refresh": int(row.get("refresh_hz", 60)), "srgb": ""},
                "tone": "positive",
            })

    warnings = sorted(warnings, key=lambda w: 0)[:2]

    return {"strengths": strengths, "warnings": warnings}
