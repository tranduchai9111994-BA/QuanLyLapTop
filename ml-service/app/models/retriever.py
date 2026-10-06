"""Mô hình B: kNN truy hồi có trọng số, dùng khoảng cách MỘT PHÍA (one-sided).

Máy mạnh hơn hoặc rẻ hơn mức mong muốn không bị phạt (Euclidean hai phía từng phạt oan máy
cấu hình cao hơn hồ sơ lý tưởng). Hàm khoảng cách được đưa thẳng vào metric của
NearestNeighbors chứ không xếp hạng lại bên ngoài. Giá và brand_tier nằm trong metric.
match% dùng mốc cố định, không chuẩn hóa theo top-N.
"""
from __future__ import annotations

import numpy as np
import pandas as pd
from sklearn.neighbors import NearestNeighbors
from sklearn.preprocessing import StandardScaler

from app.data.features import MODEL_B_FEATURES

PERCENTILE_BY_PRIORITY = {1: 25, 2: 40, 3: 55, 4: 75, 5: 90}

GROUPS = {
    "performance": ["cpu_score", "gpu_score", "ram_gb", "ssd_gb"],
    "mobility": ["weight_kg", "battery_wh"],
    "display": ["ppi", "refresh_hz", "srgb_100"],
    # Nhóm giá gồm cả giá tuyệt đối lẫn value_index: người ưu tiên tiết kiệm muốn vừa rẻ vừa đáng tiền.
    "price": ["price_vnd", "value_index"],
    "brand": ["brand_tier"],
    # Độ phổ biến: máy giảm sâu, bán chạy được nâng lên một chút. Trọng số cố định, không có thanh
    # trượt, và giữ ở mức vừa phải để không lấn át các tiêu chí chính.
    "popularity": ["discount_percent", "sales_score"],
}
POPULARITY_WEIGHT = 0.12

BASE_WEIGHT_BY_SEGMENT = {
    "GAMING": {"performance": 1.3, "mobility": 0.7, "display": 1.0, "price": 1.0, "brand": 0.5},
    "ULTRABOOK": {"performance": 0.8, "mobility": 1.4, "display": 1.0, "price": 1.0, "brand": 0.7},
    "CREATOR": {"performance": 1.2, "mobility": 0.8, "display": 1.3, "price": 0.8, "brand": 0.6},
    "OFFICE": {"performance": 0.8, "mobility": 1.0, "display": 0.8, "price": 1.3, "brand": 0.6},
}
SCREEN_INCH_WEIGHT = 0.05

# Hướng "tốt" của từng đặc trưng:
#  +1 = càng cao càng tốt  -> chỉ phạt khi máy thấp hơn nhu cầu
#  -1 = càng thấp càng tốt -> chỉ phạt khi máy cao hơn nhu cầu
#   0 = hai phía (lệch hướng nào cũng là khác biệt)
FEATURE_DIRECTION: dict[str, int] = {
    "cpu_score": +1,
    "gpu_score": +1,
    "ram_gb": +1,
    "ssd_gb": +1,
    "ppi": +1,
    "refresh_hz": +1,
    "srgb_100": +1,
    "battery_wh": +1,
    "brand_tier": +1,
    "gpu_dedicated": +1,
    "value_index": +1,
    "discount_percent": +1,
    "sales_score": +1,
    "weight_kg": -1,
    "price_vnd": -1,
    "screen_inch": 0,
}

# Hệ số phạt khi máy vượt nhu cầu theo hướng tốt. Đặt 0 = không phạt máy mạnh/rẻ/nhẹ hơn.
# Đã kiểm chứng: "không phạt" chỉ có tác dụng nếu q của đặc trưng một phía nằm ở BIÊN mong muốn
# (xem build_ideal_vector). Nếu q giá nằm giữa khoảng ngân sách thì mọi máy rẻ hơn đều phạt 0,
# mất khả năng phân biệt và người ưu tiên tiết kiệm lại bị gợi ý máy đắt.
OVERSHOOT_PENALTY = 0.0


def fit_scaler(catalog: pd.DataFrame) -> StandardScaler:
    """z-score trên toàn catalog để các đặc trưng cùng thang đo."""
    scaler = StandardScaler()
    scaler.fit(catalog[MODEL_B_FEATURES])
    return scaler


def build_ideal_vector(
    candidates: pd.DataFrame, priorities: dict, must: dict, budget: dict, segment: str
) -> dict:
    """Dựng vector nhu cầu lý tưởng q, "chiếc máy trong mơ" chứ không phải máy có thật.

    Mỗi đặc trưng lấy phân vị trong `candidates` theo mức ưu tiên (PERCENTILE_BY_PRIORITY).
    Ví dụ hiệu năng 5/5 -> phân vị 90: chỉ 10% ứng viên có CPU mạnh hơn. `recommend` sau đó
    tìm các máy có tổng khoảng cách có trọng số tới q nhỏ nhất.
    """
    q: dict[str, float] = {}

    # Hiệu năng: cpu/gpu/ram/ssd dùng chung một mức ưu tiên
    for feat in ["cpu_score", "gpu_score", "ram_gb", "ssd_gb"]:
        p = priorities.get("performance", 3)
        q[feat] = float(candidates[feat].quantile(PERCENTILE_BY_PRIORITY[p] / 100))

    # Di động: cân nặng càng thấp càng tốt nên lật ngược phân vị
    p_mob = priorities.get("mobility", 3)
    q["weight_kg"] = float(candidates["weight_kg"].quantile((100 - PERCENTILE_BY_PRIORITY[p_mob]) / 100))
    q["battery_wh"] = float(candidates["battery_wh"].quantile(PERCENTILE_BY_PRIORITY[p_mob] / 100))

    # Màn hình: sRGB 100% chỉ bật khi người dùng thật sự quan tâm (>= 4/5)
    p_disp = priorities.get("display", 3)
    for feat in ["ppi", "refresh_hz"]:
        q[feat] = float(candidates[feat].quantile(PERCENTILE_BY_PRIORITY[p_disp] / 100))
    q["srgb_100"] = 1 if p_disp >= 4 else 0

    # Giá: với khoảng cách một phía, q phải đặt ở biên mong muốn. p=5 -> ngân sách tối thiểu,
    # p=1 -> ngân sách tối đa.
    p_price = priorities.get("price", 3)
    b_min, b_max = budget["min"], budget["max"]
    q["price_vnd"] = b_min + (1 - (p_price - 1) / 4) * (b_max - b_min)
    q["value_index"] = float(candidates["value_index"].quantile(PERCENTILE_BY_PRIORITY[p_price] / 100))

    q["screen_inch"] = float(candidates["screen_inch"].median())
    q["gpu_dedicated"] = 1 if segment == "GAMING" else int(candidates["gpu_dedicated"].median())
    q["brand_tier"] = float(candidates["brand_tier"].quantile(0.5))
    # Độ phổ biến luôn hướng tới mức cao nhưng chỉ ở phân vị 80, đòi nhất catalog thì quá khắt khe.
    q["discount_percent"] = float(candidates["discount_percent"].quantile(0.80))
    q["sales_score"] = float(candidates["sales_score"].quantile(0.80))

    ram_min = must.get("ramMin")
    if ram_min:
        q["ram_gb"] = max(q["ram_gb"], ram_min)
    return q


def build_weights(
    priorities: dict,
    segment: str,
    brand_weight: float = 1.0,
    base_weights_override: dict[str, dict[str, float]] | None = None,
) -> dict:
    """Tính trọng số w_j cho từng đặc trưng, tổng bằng 1.

    Trọng số nhóm = mức ưu tiên x trọng số nền của phân khúc, chia đều cho các đặc trưng trong
    nhóm, rồi chuẩn hóa. Ví dụ GAMING, hiệu năng 5/5: 5 * 1.3 = 6.5, chia 4 đặc trưng = 1.625 mỗi cái.

    `base_weights_override` (FR-13): admin ghi đè trọng số nền theo phân khúc. Chỉ phân khúc có
    trong dict mới bị ghi đè (merge nông), phân khúc khác vẫn dùng BASE_WEIGHT_BY_SEGMENT.
    """
    base = dict(BASE_WEIGHT_BY_SEGMENT.get(segment, BASE_WEIGHT_BY_SEGMENT["OFFICE"]))
    if base_weights_override and segment in base_weights_override:
        base.update(base_weights_override[segment])

    # screen_inch và gpu_dedicated có trọng số cố định, không phụ thuộc mức ưu tiên
    raw: dict[str, float] = {"screen_inch": SCREEN_INCH_WEIGHT, "gpu_dedicated": 0.06}

    for group, feats in GROUPS.items():
        if group == "popularity":
            w_group = POPULARITY_WEIGHT
        elif group == "brand":
            # Không có thanh trượt riêng, chỉ tăng khi câu nói tự do có từ khóa "bền", "uy tín"
            # (xem PRIORITY_HINTS trong text_classifier.py)
            w_group = base[group] * brand_weight
        else:
            p = priorities.get(group, 3)  # mặc định 3 = vừa
            w_group = p * base[group]
        per_feat = w_group / len(feats)
        for f in feats:
            raw[f] = per_feat

    total = sum(raw.values())
    return {k: v / total for k, v in raw.items()}


def one_sided_distance(x: np.ndarray, q: np.ndarray, weights_vec: np.ndarray, directions: np.ndarray) -> float:
    """Khoảng cách một phía giữa máy `x` và hồ sơ nhu cầu `q`.

        d(x, q) = sqrt( sum_j w_j * pen_j^2 )
        hướng +1: pen = max(0, q_j - x_j) + OVERSHOOT * max(0, x_j - q_j)
        hướng -1: pen = max(0, x_j - q_j) + OVERSHOOT * max(0, q_j - x_j)
        hướng  0: pen = |x_j - q_j|
    """
    diff = np.asarray(x, dtype=float) - np.asarray(q, dtype=float)  # dương = máy "nhiều hơn" q
    pen = np.empty_like(diff)

    up = directions > 0
    pen[up] = np.maximum(0.0, -diff[up]) + OVERSHOOT_PENALTY * np.maximum(0.0, diff[up])

    down = directions < 0
    pen[down] = np.maximum(0.0, diff[down]) + OVERSHOOT_PENALTY * np.maximum(0.0, -diff[down])

    both = directions == 0
    pen[both] = np.abs(diff[both])

    return float(np.sqrt(np.sum(weights_vec * pen**2)))


def make_one_sided_metric(weights_vec: np.ndarray, directions: np.ndarray):
    """Bọc `one_sided_distance` thành metric cho NearestNeighbors.

    Lưu ý: sklearn gọi metric theo thứ tự (q, x), ngược với (x, q) mà công thức cần. Hàm này
    không đối xứng nên đảo thứ tự sẽ phạt nhầm máy mạnh thay vì máy yếu. Test
    `test_one_sided_metric_argument_order` chặn lỗi này.
    """

    def metric(a: np.ndarray, b: np.ndarray) -> float:
        # a = điểm truy vấn (q), b = máy trong catalog (x)
        return one_sided_distance(b, a, weights_vec, directions)

    return metric


# Trọng số "độ khớp phân khúc" khi lọc mềm: máy khác phân khúc bị trừ điểm nhưng vẫn có cơ hội
# vào top nếu thật sự phù hợp (lọc cứng trước đây loại thẳng nên mất máy tốt).
SEGMENT_SOFT_WEIGHT = 0.18


def recommend(
    candidates: pd.DataFrame,
    scaler: StandardScaler,
    ideal: dict,
    weights: dict,
    top_n: int,
    preferred_segment: str | None = None,
) -> tuple[np.ndarray, np.ndarray]:
    """kNN truy hồi với metric một phía. Nếu có `preferred_segment` thì độ khớp phân khúc
    được thêm vào metric như một đặc trưng (lọc mềm) thay vì loại ứng viên khác phân khúc."""
    feats = MODEL_B_FEATURES
    Xs = scaler.transform(candidates[feats])
    q_df = pd.DataFrame([{f: ideal.get(f, 0) for f in feats}])
    qs = scaler.transform(q_df)

    w = [weights.get(f, 0.0) for f in feats]
    directions = [FEATURE_DIRECTION.get(f, 0) for f in feats]

    if preferred_segment is not None and "segment" in candidates.columns:
        seg_match = (candidates["segment"] == preferred_segment).astype(float).to_numpy().reshape(-1, 1)
        Xs = np.hstack([Xs, seg_match])
        qs = np.hstack([qs, np.array([[1.0]])])  # mong muốn: khớp phân khúc
        w.append(SEGMENT_SOFT_WEIGHT)
        directions.append(+1)  # không khớp chỉ bị phạt, không bị loại

    w_arr = np.array(w, dtype=float)
    w_arr = w_arr / w_arr.sum() if w_arr.sum() > 0 else w_arr
    dir_arr = np.array(directions, dtype=float)

    n_neighbors = min(top_n, len(candidates))
    nn = NearestNeighbors(
        n_neighbors=n_neighbors,
        algorithm="brute",
        metric=make_one_sided_metric(w_arr, dir_arr),
    )
    nn.fit(Xs)
    dist, idx = nn.kneighbors(qs)
    return dist[0], idx[0]


# Mốc cố định đổi khoảng cách -> % phù hợp. Không chuẩn hóa theo top-N nên catalog không có
# máy nào hợp nhu cầu thì điểm vẫn thấp.
MATCH_TAU = 0.9


def match_pct(distances: np.ndarray, tau: float = MATCH_TAU) -> np.ndarray:
    """100 * exp(-d / tau), tau cố định nên điểm so sánh được giữa các lần truy vấn."""
    return 100 * np.exp(-np.asarray(distances, dtype=float) / tau)


def similar_items(candidates: pd.DataFrame, scaler: StandardScaler, laptop_idx: int, k: int = 7) -> tuple[np.ndarray, np.ndarray]:
    """Máy tương tự (item-item): dùng Euclidean hai phía vì cần tìm máy giống nhau,
    mạnh hơn hay yếu hơn đều là khác biệt."""
    feats = MODEL_B_FEATURES
    Xs = scaler.transform(candidates[feats])
    nn = NearestNeighbors(n_neighbors=min(k, len(candidates)), metric="euclidean")
    nn.fit(Xs)
    dist, idx = nn.kneighbors(Xs[laptop_idx : laptop_idx + 1])
    return dist[0][1:], idx[0][1:]  # bỏ phần tử đầu (chính nó)
