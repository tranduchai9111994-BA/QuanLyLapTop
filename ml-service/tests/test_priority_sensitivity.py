"""Kiem thu DO NHAY theo muc uu tien: doi tung muc uu tien 1..5 thi ket qua phai doi DUNG HUONG.

Day la tinh dung dan cot loi cua Mo hinh B: neu nguoi dung keo "Di dong & pin" len cao ma may
goi y khong nhe hon, thi he thong dang noi doi nguoi dung.

Quy uoc kiem tra: giu nguyen cac nhom khac o muc 3, chi doi MOT nhom tu 1 -> 5, roi so sanh
dac trung dai dien cua top-5. Vi khoang cach la da chieu nen khong doi hoi don dieu tuyet doi
o tung buoc, ma doi hoi: muc 5 phai TOT HON RO RET so voi muc 1.
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
    """Uu tien hieu nang 1 -> 5: suc manh trung binh (cpu+gpu) cua top-5 phai TANG."""
    catalog, scaler, budget = enriched_catalog, fit_scaler(enriched_catalog), _budget(enriched_catalog)

    low = _top_n(catalog, scaler, {**BASE, "performance": 1}, segment, budget)
    high = _top_n(catalog, scaler, {**BASE, "performance": 5}, segment, budget)

    power_low = (0.6 * low["cpu_score"] + 0.4 * low["gpu_score"]).mean()
    power_high = (0.6 * high["cpu_score"] + 0.4 * high["gpu_score"]).mean()
    assert power_high > power_low, (
        f"[{segment}] uu tien hieu nang muc 5 cho suc manh {power_high:.1f} "
        f"khong cao hon muc 1 ({power_low:.1f})"
    )


@pytest.mark.parametrize("segment", SEGMENTS)
def test_mobility_priority_lowers_weight(enriched_catalog, segment):
    """Uu tien di dong 1 -> 5: can nang trung binh top-5 phai GIAM."""
    catalog, scaler, budget = enriched_catalog, fit_scaler(enriched_catalog), _budget(enriched_catalog)

    low = _top_n(catalog, scaler, {**BASE, "mobility": 1}, segment, budget)
    high = _top_n(catalog, scaler, {**BASE, "mobility": 5}, segment, budget)

    assert high["weight_kg"].mean() < low["weight_kg"].mean(), (
        f"[{segment}] uu tien di dong muc 5 cho can nang {high['weight_kg'].mean():.2f}kg "
        f"khong nhe hon muc 1 ({low['weight_kg'].mean():.2f}kg)"
    )


@pytest.mark.parametrize("segment", SEGMENTS)
def test_price_priority_lowers_price(enriched_catalog, segment):
    """Uu tien tiet kiem 1 -> 5: gia trung binh top-5 phai GIAM."""
    catalog, scaler, budget = enriched_catalog, fit_scaler(enriched_catalog), _budget(enriched_catalog)

    low = _top_n(catalog, scaler, {**BASE, "price": 1}, segment, budget)
    high = _top_n(catalog, scaler, {**BASE, "price": 5}, segment, budget)

    assert high["price_vnd"].mean() < low["price_vnd"].mean(), (
        f"[{segment}] uu tien tiet kiem muc 5 cho gia {high['price_vnd'].mean()/1e6:.1f}tr "
        f"khong re hon muc 1 ({low['price_vnd'].mean()/1e6:.1f}tr)"
    )


@pytest.mark.parametrize("segment", SEGMENTS)
def test_display_priority_improves_screen(enriched_catalog, segment):
    """Uu tien man hinh 1 -> 5: diem man hinh tong hop (ppi + tan so + sRGB) phai TANG."""
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
        f"[{segment}] uu tien man hinh muc 5 cho diem {screen_score(high):.2f} "
        f"khong cao hon muc 1 ({screen_score(low):.2f})"
    )


def test_priority_changes_actually_change_results(enriched_catalog):
    """Doi muc uu tien phai thuc su doi ket qua - khong duoc tra ve y het nhau."""
    catalog, scaler, budget = enriched_catalog, fit_scaler(enriched_catalog), _budget(enriched_catalog)

    seen: dict[str, set] = {}
    for group in ("performance", "mobility", "display", "price"):
        ids_low = set(_top_n(catalog, scaler, {**BASE, group: 1}, "OFFICE", budget)["id"])
        ids_high = set(_top_n(catalog, scaler, {**BASE, group: 5}, "OFFICE", budget)["id"])
        assert ids_low != ids_high, f"Doi uu tien '{group}' tu 1 sang 5 nhung top-5 khong doi gi"
        seen[group] = ids_high

    # Cac nhu cau khac nhau khong duoc cho ra cung mot bo ket qua
    assert len({frozenset(v) for v in seen.values()}) > 1, "Moi nhu cau deu cho cung mot ket qua"


def test_conflicting_priorities_still_reasonable(enriched_catalog):
    """Tinh huong mau thuan: vua doi hieu nang toi da vua doi tiet kiem toi da.
    He thong phai tra ve may CAN BANG (dang tien), khong sap va khong ra may dat nhat."""
    catalog, scaler, budget = enriched_catalog, fit_scaler(enriched_catalog), _budget(enriched_catalog)

    conflict = _top_n(
        catalog, scaler, {"performance": 5, "mobility": 3, "display": 3, "price": 5}, "OFFICE", budget
    )
    assert len(conflict) == 5
    # Khong duoc toan may dat nhat trong tap ung vien
    cand = catalog[catalog["price_vnd"] <= budget["max"]]
    assert conflict["price_vnd"].mean() < cand["price_vnd"].quantile(0.85)
    # Va phai "dang tien" hon mat bang chung
    assert conflict["value_index"].mean() > cand["value_index"].median()


def test_all_extreme_combinations_return_results(enriched_catalog):
    """Quet TOAN BO 5^4 = 625 to hop uu tien: khong to hop nao duoc loi hay tra ve rong."""
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
                            failures.append((pri, "ket qua khong hop le"))
                    except Exception as exc:  # noqa: BLE001
                        failures.append((pri, str(exc)))
    assert not failures, f"{len(failures)} to hop uu tien bi loi: {failures[:3]}"
