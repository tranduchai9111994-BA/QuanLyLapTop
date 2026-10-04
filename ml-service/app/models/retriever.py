"""Mo hinh B: kNN truy hoi co trong so, dung KHOANG CACH MOT PHIA (one-sided).

Thay doi quan trong so voi ban dau (theo gop y cua giang vien):
 - Khoang cach MOT PHIA: khong phat may MANH HON hoac RE HON muc mong muon. Truoc day dung
   Euclidean hai phia nen may cau hinh cao hon ho so ly tuong bi coi la "xa" => bi tru diem oan.
 - Ham khoang cach nay duoc dua THANG vao metric cua kNN (NearestNeighbors(metric=callable)),
   khong phai xep hang lai o ngoai => kNN van la loi thuat toan.
 - GIA nam trong metric xep hang (truoc day chi la huy hieu hien thi "dang tien").
 - brand_tier (uy tin thuong hieu) la mot dac trung, quy doi hang 1..5.
 - match% dung MOC CO DINH, khong chuan hoa theo top-N (truoc day hang 1 luon ~cao nhat).
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
    # Nhom "gia" gom ca gia tuyet doi lan value_index (hieu nang/trieu dong): nguoi uu tien
    # tiet kiem vua muon re, vua muon dang tien - hai mat cua cung mot nhu cau.
    "price": ["price_vnd", "value_index"],
    "brand": ["brand_tier"],
    # "Do pho bien": may giam gia sau + ban chay se duoc nang len trong xep hang, giong hanh
    # vi mua sam that (nguoi mua co xu huong tin tuong san pham nhieu nguoi da mua + dang sale).
    # Trong so CO DINH (khong gan voi thanh truot nao nguoi dung tu chinh), luon co mat o muc
    # vua phai de KHONG lan at cac tieu chi chinh (hieu nang/gia/di dong/man hinh).
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

# Huong "tot" cua tung dac trung:
#  +1 = cang CAO cang tot  -> chi phat khi may THAP hon nhu cau (thua thi khong phat)
#  -1 = cang THAP cang tot -> chi phat khi may CAO hon nhu cau (re/nhe hon thi khong phat)
#   0 = hai phia (lech huong nao cung tinh la khac biet)
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
    "value_index": +1,  # cang dang tien cang tot; dang tien hon muc mong muon khong bi phat
    "discount_percent": +1,  # giam gia cang sau cang tot, khong bi phat neu giam nhieu hon can
    "sales_score": +1,       # ban cang chay cang duoc tin tuong, khong bi phat neu ban rat chay
    "weight_kg": -1,
    "price_vnd": -1,
    "screen_inch": 0,
}

# He so phat khi may VUOT nhu cau theo huong tot (manh hon / re hon / nhe hon).
# Dat = 0 dung theo yeu cau "khong phat may manh hon hoac re hon muc mong muon".
#
# Luu y quan trong (da kiem chung bang thuc nghiem): viec "khong phat" phai di doi voi cach dat
# vector ly tuong q. Neu q_gia nam giua khoang ngan sach thi MOI may re hon deu co phat = 0,
# gia mat kha nang phan biet => nguoi uu tien tiet kiem lai bi goi y may dat hon. Vi vay q cua
# cac dac trung mot phia duoc dat o BIEN mong muon (xem build_ideal_vector): uu tien gia toi da
# => q = ngan sach toi thieu, uu tien hieu nang toi da => q = phan vi 90.
OVERSHOOT_PENALTY = 0.0


def fit_scaler(catalog: pd.DataFrame) -> StandardScaler:
    """z-score fit tren toan catalog de moi dac trung cung thang do truoc khi tinh khoang cach."""
    scaler = StandardScaler()
    scaler.fit(catalog[MODEL_B_FEATURES])
    return scaler


def build_ideal_vector(
    candidates: pd.DataFrame, priorities: dict, must: dict, budget: dict, segment: str
) -> dict:
    """Dung VECTOR NHU CAU LY TUONG q - "chiec may trong mo" ma nguoi dung dang tim.

    q KHONG PHAI la mot laptop co that trong catalog. No la mot diem duoc "may do" tu chinh
    tap ung vien: voi moi dac trung, ta tra loi cau hoi "nguoi dung muon gia tri nay o MUC NAO
    so voi cac may khac dang co san?" bang cach lay PHAN VI (percentile) trong `candidates`.

    Vi du de hieu: nguoi dung chon "hieu nang" = 5/5 (rat quan trong). Tra bang
    PERCENTILE_BY_PRIORITY, muc 5 tuong ung phan vi 90. Nghia la q["cpu_score"] = gia tri CPU
    o VI TRI 90% (chi 10% may trong tap ung vien co CPU manh hon) - the hien "toi muon mot
    trong nhung may manh nhat". Nguoc lai muc 1/5 chi can phan vi 25 (trung binh yeu cung duoc).

    Sau khi co q, Mo hinh B (ham `recommend` ben duoi) se tim CAC MAY GAN q NHAT trong khong
    gian da chieu - do la ban chat cua "kNN truy hoi": khong tim may giong q nhat theo TUNG dac
    trung rieng le, ma tim may co TONG khoang cach (co trong so) toi q la nho nhat.
    """
    q: dict[str, float] = {}

    # Nhom HIEU NANG: cpu/gpu/ram/ssd deu dung CHUNG mot muc uu tien "performance"
    for feat in ["cpu_score", "gpu_score", "ram_gb", "ssd_gb"]:
        p = priorities.get("performance", 3)
        q[feat] = float(candidates[feat].quantile(PERCENTILE_BY_PRIORITY[p] / 100))

    # Nhom DI DONG: can nang la "cang THAP cang tot" nen phai LAT nguoc phan vi
    # (uu tien di dong cao -> muon may o phan vi THAP cua can nang, tuc la NHE)
    p_mob = priorities.get("mobility", 3)
    q["weight_kg"] = float(candidates["weight_kg"].quantile((100 - PERCENTILE_BY_PRIORITY[p_mob]) / 100))
    q["battery_wh"] = float(candidates["battery_wh"].quantile(PERCENTILE_BY_PRIORITY[p_mob] / 100))

    # Nhom MAN HINH: do phan giai (ppi) va tan so quet cang cao cang tot; sRGB 100% chi "bat"
    # (=1) khi nguoi dung thuc su quan tam man hinh (muc >= 4/5), con lai khong doi hoi
    p_disp = priorities.get("display", 3)
    for feat in ["ppi", "refresh_hz"]:
        q[feat] = float(candidates[feat].quantile(PERCENTILE_BY_PRIORITY[p_disp] / 100))
    q["srgb_100"] = 1 if p_disp >= 4 else 0

    # Gia: voi khoang cach MOT PHIA, may re hon q khong bi phat => q phai dat o BIEN mong muon
    # thi gia moi phan biet duoc. p=5 (rat quan trong tiet kiem) -> q = ngan sach toi thieu
    # (moi dong dat them deu bi phat); p=1 (khong quan tam gia) -> q = ngan sach toi da.
    p_price = priorities.get("price", 3)
    b_min, b_max = budget["min"], budget["max"]
    q["price_vnd"] = b_min + (1 - (p_price - 1) / 4) * (b_max - b_min)
    # Cang uu tien tiet kiem -> cang doi hoi may "dang tien" (value_index cao)
    q["value_index"] = float(candidates["value_index"].quantile(PERCENTILE_BY_PRIORITY[p_price] / 100))

    q["screen_inch"] = float(candidates["screen_inch"].median())
    q["gpu_dedicated"] = 1 if segment == "GAMING" else int(candidates["gpu_dedicated"].median())
    q["brand_tier"] = float(candidates["brand_tier"].quantile(0.5))
    # "Do pho bien" luon huong toi muc CAO (khong co thanh truot rieng cho nguoi dung chinh) -
    # dat q o phan vi 80: mong muon may giam gia sau + ban chay, nhung khong doi hoi PHAI la
    # may giam gia/ban chay NHAT catalog (qua khat khe se lam mat nhieu may tot khac).
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
    """Tinh trong so w_j cho tung dac trung, dung trong cong thuc khoang cach co trong so.

    Cach tinh (vi du de hieu): neu nguoi dung dat "hieu nang" = 5/5, va phan khuc GAMING co
    trong so nen mac dinh cho nhom hieu nang la 1.3, thi trong so tho cua nhom nay = 5 * 1.3 = 6.5.
    Nhom "hieu nang" gom 4 dac trung (cpu_score, gpu_score, ram_gb, ssd_gb) nen moi dac trung
    nhan 6.5/4 = 1.625. Cuoi cung TAT CA trong so (moi nhom cong lai) duoc CHIA cho tong, de
    tong luon bang 1 (dieu kien bat buoc cua cong thuc Euclidean co trong so).

    => Ket qua: nguoi dung keo thanh truot cang cao, nhom dac trung do cang "nang ky" trong
    viec xep hang, dong thoi van giu duoc dac thu tung phan khuc (vd GAMING luon coi trong
    hieu nang hon OFFICE ngay ca khi ca hai nguoi dung deu chon muc 3/5).

    `base_weights_override` (FR-13, Cau hinh tri thuc): quan tri vien co the sua trong so NEN
    tung phan khuc qua man quan tri, thay vi phai sua code va deploy lai. Chi ghi de PHAN KHUC
    nao thuc su co trong dict truyen vao (merge nong voi mac dinh), phan khuc khac van dung
    BASE_WEIGHT_BY_SEGMENT nhu cu - tranh 1 cau hinh thieu du lieu lam sap toan bo he thong.
    """
    # base: trong so "nen" mac dinh cua tung phan khuc (vd GAMING coi trong hieu nang hon OFFICE)
    base = dict(BASE_WEIGHT_BY_SEGMENT.get(segment, BASE_WEIGHT_BY_SEGMENT["OFFICE"]))
    if base_weights_override and segment in base_weights_override:
        base.update(base_weights_override[segment])

    # man hinh (screen_inch) va gpu_dedicated luon co mot chut trong so co dinh, khong phu
    # thuoc muc uu tien nguoi dung chon (vd kich thuoc man hinh it lien quan den 4 nhom chinh)
    raw: dict[str, float] = {"screen_inch": SCREEN_INCH_WEIGHT, "gpu_dedicated": 0.06}

    for group, feats in GROUPS.items():
        if group == "popularity":
            w_group = POPULARITY_WEIGHT
        elif group == "brand":
            # Nhom thuong hieu KHONG co thanh truot rieng cho nguoi dung keo - no chi tang len
            # khi cau noi tu do co tu khoa "ben", "uy tin" (xem text_classifier.py PRIORITY_HINTS)
            w_group = base[group] * brand_weight
        else:
            p = priorities.get(group, 3)  # muc uu tien 1..5 nguoi dung chon (mac dinh 3 = vua)
            w_group = p * base[group]
        per_feat = w_group / len(feats)  # chia deu cho cac dac trung trong cung nhom
        for f in feats:
            raw[f] = per_feat

    # Chuan hoa de tong trong so = 1 (bat buoc cho cong thuc khoang cach Euclidean co trong so)
    total = sum(raw.values())
    return {k: v / total for k, v in raw.items()}


def one_sided_distance(x: np.ndarray, q: np.ndarray, weights_vec: np.ndarray, directions: np.ndarray) -> float:
    """Khoang cach MOT PHIA giua may `x` va ho so nhu cau `q`.

        d(x, q) = sqrt( sum_j w_j * pen_j^2 )
        huong +1 (cang cao cang tot):  pen = max(0, q_j - x_j) + OVERSHOOT * max(0, x_j - q_j)
        huong -1 (cang thap cang tot): pen = max(0, x_j - q_j) + OVERSHOOT * max(0, q_j - x_j)
        huong  0 (hai phia):           pen = |x_j - q_j|

    Voi OVERSHOOT = 0, may MANH HON / RE HON / NHE HON muc mong muon khong bi phat chut nao.
    """
    diff = np.asarray(x, dtype=float) - np.asarray(q, dtype=float)  # duong = may "nhieu hon" q
    pen = np.empty_like(diff)

    up = directions > 0
    pen[up] = np.maximum(0.0, -diff[up]) + OVERSHOOT_PENALTY * np.maximum(0.0, diff[up])

    down = directions < 0
    pen[down] = np.maximum(0.0, diff[down]) + OVERSHOOT_PENALTY * np.maximum(0.0, -diff[down])

    both = directions == 0
    pen[both] = np.abs(diff[both])

    return float(np.sqrt(np.sum(weights_vec * pen**2)))


def make_one_sided_metric(weights_vec: np.ndarray, directions: np.ndarray):
    """Boc `one_sided_distance` thanh `metric` cho NearestNeighbors.

    CHU Y QUAN TRONG: khi goi `nn.fit(X_may).kneighbors(q)`, scikit-learn tinh
    pairwise_distances(q, X_may) nen ham metric duoc goi theo thu tu (q, x) - NGUOC voi
    thu tu (x, q) ma cong thuc mot phia can. Ham nay KHONG DOI XUNG nen dao thu tu se lam
    lat dau: he thong se phat may MANH HON thay vi may YEU HON (loi that da tung gap).
    Vi vay o day phai doi lai cho dung: sklearn truyen (q, x) -> goi distance(x=b, q=a).
    Test `test_one_sided_metric_argument_order` chan loi nay tai phat.
    """

    def metric(a: np.ndarray, b: np.ndarray) -> float:
        # a = diem truy van (q), b = may trong catalog (x)
        return one_sided_distance(b, a, weights_vec, directions)

    return metric


# Trong so cho "do khop phan khuc" khi dung LOC MEM. Gia tri vua phai: may khac phan khuc
# bi tru diem nhung VAN CO CO HOI lot top neu thuc su phu hop (vd may Creator rat hop nguoi
# can do hoa du duoc gan nhan Gaming). Loc cung truoc day loai thang => mat may tot.
SEGMENT_SOFT_WEIGHT = 0.18


def recommend(
    candidates: pd.DataFrame,
    scaler: StandardScaler,
    ideal: dict,
    weights: dict,
    top_n: int,
    preferred_segment: str | None = None,
) -> tuple[np.ndarray, np.ndarray]:
    """kNN truy hoi voi metric mot phia (metric nam TRONG NearestNeighbors).

    `preferred_segment`: neu co, do khop phan khuc duoc dua vao METRIC duoi dang mot dac trung
    (LOC MEM) thay vi loc bo ung vien khac phan khuc (loc cung).
    """
    feats = MODEL_B_FEATURES
    Xs = scaler.transform(candidates[feats])
    q_df = pd.DataFrame([{f: ideal.get(f, 0) for f in feats}])
    qs = scaler.transform(q_df)

    w = [weights.get(f, 0.0) for f in feats]
    directions = [FEATURE_DIRECTION.get(f, 0) for f in feats]

    if preferred_segment is not None and "segment" in candidates.columns:
        seg_match = (candidates["segment"] == preferred_segment).astype(float).to_numpy().reshape(-1, 1)
        Xs = np.hstack([Xs, seg_match])
        qs = np.hstack([qs, np.array([[1.0]])])  # mong muon: khop phan khuc
        w.append(SEGMENT_SOFT_WEIGHT)
        directions.append(+1)  # khop cang cao cang tot; khong khop chi bi phat, khong bi loai

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


# Moc co dinh doi khoang cach -> % phu hop. Khong chuan hoa theo top-N nua, nen hai lan
# truy van khac nhau co the deu cho diem thap (khi catalog khong co may nao hop nhu cau).
MATCH_TAU = 0.9


def match_pct(distances: np.ndarray, tau: float = MATCH_TAU) -> np.ndarray:
    """100 * exp(-d / tau) voi tau CO DINH => diem so so sanh duoc giua cac lan truy van."""
    return 100 * np.exp(-np.asarray(distances, dtype=float) / tau)


def similar_items(candidates: pd.DataFrame, scaler: StandardScaler, laptop_idx: int, k: int = 7) -> tuple[np.ndarray, np.ndarray]:
    """May tuong tu (item-item): dung Euclidean HAI PHIA vi o day ta tim may GIONG NHAU,
    khong phai may 'thoa man nhu cau' - manh hon hay yeu hon deu la khac biet."""
    feats = MODEL_B_FEATURES
    Xs = scaler.transform(candidates[feats])
    nn = NearestNeighbors(n_neighbors=min(k, len(candidates)), metric="euclidean")
    nn.fit(Xs)
    dist, idx = nn.kneighbors(Xs[laptop_idx : laptop_idx + 1])
    return dist[0][1:], idx[0][1:]  # bo phan tu dau (chinh no)
