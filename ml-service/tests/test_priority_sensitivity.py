"""Độ nhạy theo mức ưu tiên: đổi một nhóm ưu tiên từ 1 lên 5 thì kết quả phải đổi đúng hướng.

Cách kiểm tra: giữ các nhóm khác ở mức 3, chỉ đổi MỘT nhóm rồi so đặc trưng đại diện của top-5.
Khoảng cách là đa chiều nên không đòi đơn điệu từng bước, chỉ đòi mức 5 tốt hơn rõ rệt mức 1.
"""
import numpy as np
import pytest

from app.models.retriever import build_ideal_vector, build_weights, fit_scaler, recommend

SEGMENTS = ["OFFICE", "ULTRABOOK", "GAMING", "CREATOR"]
BASE = {"performance": 3, "mobility": 3, "display": 3, "price": 3}


def _top_n(catalog, scaler, priorities, segment, budget, n=5):
    cand = catalog[catalog["price_vnd"] <= budget["max"]]
    ideal = build_ideal_vector(cand, priorities, {}, budget, segment)
    weights = build_weights(priorities, segment)
    _, idx = recommend(cand, scaler, ideal, weights, top_n=n, preferred_segment=segment)
    return cand.iloc[idx]


def _budget(catalog):
    return {
        "min": int(catalog["price_vnd"].quantile(0.10)),
        "max": int(catalog["price_vnd"].quantile(0.90)),
    }


@pytest.mark.parametrize("segment", SEGMENTS)
def test_performance_priority_raises_power(enriched_catalog, segment):
    """Ưu tiên hiệu năng 1 -> 5 thì sức mạnh trung bình (cpu+gpu) của top-5 phải tăng."""
    catalog, scaler, budget = enriched_catalog, fit_scaler(enriched_catalog), _budget(enriched_catalog)

    low = _top_n(catalog, scaler, {**BASE, "performance": 1}, segment, budget)
    high = _top_n(catalog, scaler, {**BASE, "performance": 5}, segment, budget)

    power_low = (0.6 * low["cpu_score"] + 0.4 * low["gpu_score"]).mean()
    power_high = (0.6 * high["cpu_score"] + 0.4 * high["gpu_score"]).mean()
    assert power_high > power_low, (
        f"[{segment}] ưu tiên hiệu năng mức 5 cho sức mạnh {power_high:.1f} "
        f"không cao hơn mức 1 ({power_low:.1f})"
    )


@pytest.mark.parametrize("segment", SEGMENTS)
def test_mobility_priority_lowers_weight(enriched_catalog, segment):
    """Ưu tiên di động 1 -> 5 thì cân nặng trung bình top-5 phải giảm."""
    catalog, scaler, budget = enriched_catalog, fit_scaler(enriched_catalog), _budget(enriched_catalog)

    low = _top_n(catalog, scaler, {**BASE, "mobility": 1}, segment, budget)
    high = _top_n(catalog, scaler, {**BASE, "mobility": 5}, segment, budget)

    assert high["weight_kg"].mean() < low["weight_kg"].mean(), (
        f"[{segment}] ưu tiên di động mức 5 cho cân nặng {high['weight_kg'].mean():.2f}kg "
        f"không nhẹ hơn mức 1 ({low['weight_kg'].mean():.2f}kg)"
    )


@pytest.mark.parametrize("segment", SEGMENTS)
def test_price_priority_lowers_price(enriched_catalog, segment):
    """Ưu tiên tiết kiệm 1 -> 5 thì giá trung bình top-5 phải giảm."""
    catalog, scaler, budget = enriched_catalog, fit_scaler(enriched_catalog), _budget(enriched_catalog)

    low = _top_n(catalog, scaler, {**BASE, "price": 1}, segment, budget)
    high = _top_n(catalog, scaler, {**BASE, "price": 5}, segment, budget)

    assert high["price_vnd"].mean() < low["price_vnd"].mean(), (
        f"[{segment}] ưu tiên tiết kiệm mức 5 cho giá {high['price_vnd'].mean()/1e6:.1f}tr "
        f"không rẻ hơn mức 1 ({low['price_vnd'].mean()/1e6:.1f}tr)"
    )


@pytest.mark.parametrize("segment", SEGMENTS)
def test_display_priority_improves_screen(enriched_catalog, segment):
    """Ưu tiên màn hình 1 -> 5 thì điểm màn hình tổng hợp (ppi + tần số + sRGB) phải tăng."""
    catalog, scaler, budget = enriched_catalog, fit_scaler(enriched_catalog), _budget(enriched_catalog)

    low = _top_n(catalog, scaler, {**BASE, "display": 1}, segment, budget)
    high = _top_n(catalog, scaler, {**BASE, "display": 5}, segment, budget)

    def screen_score(df):
        return (
            df["ppi"] / catalog["ppi"].max()
            + df["refresh_hz"] / catalog["refresh_hz"].max()
            + df["srgb_100"]
        ).mean()

    assert screen_score(high) > screen_score(low), (
        f"[{segment}] ưu tiên màn hình mức 5 cho điểm {screen_score(high):.2f} "
        f"không cao hơn mức 1 ({screen_score(low):.2f})"
    )


def test_priority_changes_actually_change_results(enriched_catalog):
    """Đổi mức ưu tiên phải thật sự đổi kết quả, không được trả về y hệt nhau."""
    catalog, scaler, budget = enriched_catalog, fit_scaler(enriched_catalog), _budget(enriched_catalog)

    seen: dict[str, set] = {}
    for group in ("performance", "mobility", "display", "price"):
        ids_low = set(_top_n(catalog, scaler, {**BASE, group: 1}, "OFFICE", budget)["id"])
        ids_high = set(_top_n(catalog, scaler, {**BASE, group: 5}, "OFFICE", budget)["id"])
        assert ids_low != ids_high, f"Đổi ưu tiên '{group}' từ 1 sang 5 nhưng top-5 không đổi"
        seen[group] = ids_high

    # các nhu cầu khác nhau không được ra cùng một bộ kết quả
    assert len({frozenset(v) for v in seen.values()}) > 1, "Mọi nhu cầu đều cho cùng một kết quả"


def test_conflicting_priorities_still_reasonable(enriched_catalog):
    """Vừa đòi hiệu năng tối đa vừa đòi tiết kiệm tối đa thì phải ra máy cân bằng, đáng tiền."""
    catalog, scaler, budget = enriched_catalog, fit_scaler(enriched_catalog), _budget(enriched_catalog)

    conflict = _top_n(
        catalog, scaler, {"performance": 5, "mobility": 3, "display": 3, "price": 5}, "OFFICE", budget
    )
    assert len(conflict) == 5
    # không được toàn máy đắt nhất tập ứng viên
    cand = catalog[catalog["price_vnd"] <= budget["max"]]
    assert conflict["price_vnd"].mean() < cand["price_vnd"].quantile(0.85)
    # và phải đáng tiền hơn mặt bằng chung
    assert conflict["value_index"].mean() > cand["value_index"].median()


def test_all_extreme_combinations_return_results(enriched_catalog):
    """Quét các tổ hợp ưu tiên (1, 3, 5 cho mỗi nhóm): không tổ hợp nào được lỗi hay trả về rỗng."""
    catalog, scaler, budget = enriched_catalog, fit_scaler(enriched_catalog), _budget(enriched_catalog)
    cand = catalog[catalog["price_vnd"] <= budget["max"]]

    failures = []
    for p in (1, 3, 5):
        for m in (1, 3, 5):
            for d in (1, 3, 5):
                for pr in (1, 3, 5):
                    pri = {"performance": p, "mobility": m, "display": d, "price": pr}
                    try:
                        ideal = build_ideal_vector(cand, pri, {}, budget, "OFFICE")
                        weights = build_weights(pri, "OFFICE")
                        dist, idx = recommend(cand, scaler, ideal, weights, 5, preferred_segment="OFFICE")
                        if len(idx) != 5 or not np.all(np.isfinite(dist)):
                            failures.append((pri, "kết quả không hợp lệ"))
                    except Exception as exc:  # noqa: BLE001
                        failures.append((pri, str(exc)))
    assert not failures, f"{len(failures)} tổ hợp ưu tiên bị lỗi: {failures[:3]}"
