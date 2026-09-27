"""Bien du lieu laptop THO (ten CPU dang chuoi, do phan giai dang "1920x1080"...) thanh cac
DAC TRUNG SO HOC ma mo hinh kNN co the tinh khoang cach duoc (xem docs/03 SS3, SS5).

kNN chi biet tinh "khoang cach" giua cac DIEM SO, khong biet "Intel Core i5" manh hon hay yeu
hon "AMD Ryzen 5" - vi vay buoc dau tien luon la QUY DOI moi thu ve con so co y nghia so sanh
duoc (diem hieu nang, ty le, 0/1,...). File nay lam dung mot viec do.
"""
from __future__ import annotations

import re

import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import FunctionTransformer, StandardScaler

# ram_gb, ssd_gb: se duoc lay LOG2 truoc khi chuan hoa (xem build_model_a_preprocessor).
# Ly do: chenh lech 8GB->16GB (gap doi) quan trong ngang chenh lech 16GB->32GB (cung gap doi),
# KHONG PHAI ngang chenh lech 8GB->24GB (+16GB nhung khong phai boi so). Lay log bien "ti le
# gap doi" thanh "khoang cach bang nhau" - phu hop voi cach kNN do khoang cach tuyen tinh.
NUMERIC_LOG = ["ram_gb", "ssd_gb"]

# Cac dac trung so hoc BINH THUONG (khong can log), se duoc chuan hoa z-score truc tiep
NUMERIC = ["cpu_score", "gpu_score", "screen_inch", "ppi", "refresh_hz", "weight_kg", "battery_wh"]

# Dac trung nhi phan (chi co gia tri 0 hoac 1), KHONG chuan hoa - giu nguyen vi da o thang 0-1 roi
BINARY = ["gpu_dedicated", "srgb_100"]

# Dac trung dau vao cho MO HINH A (phan lop phan khuc). CHU Y: price_vnd KHONG co mat o day -
# day la quyet dinh thiet ke co chu dich (xem docs, quyet dinh D-04): neu dua gia vao, mo hinh
# se "hoc" phan khuc theo GIA thay vi theo CAU HINH THAT, dan den 2 may cung cau hinh nhung
# khac gia bi xep khac phan khuc - vo ly ve mat ky thuat du co the dung ve mat thi truong.
MODEL_A_FEATURES = NUMERIC_LOG + NUMERIC + BINARY

# Dac trung dau vao cho MO HINH B (truy hoi/xep hang). O day NGUOC LAI, gia va do "dang tien"
# (value_index) PHAI co mat, vi muc dich cua Mo hinh B chinh la can bang "hieu nang vs gia
# thanh" theo dung ten de tai - khac hoan toan muc dich cua Mo hinh A (chi phan loai cau hinh).
#
# `discount_percent` va `sales_score`: mo phong hanh vi mua sam THUC TE - mot may GIA GOC cao
# hon nhung dang GIAM GIA SAU va DA BAN NHIEU van co the duoc uu tien hon may khac gia thap
# hon nhung khong khuyen mai/it nguoi mua (giong cach cac san TMDT that xep hang san pham).
MODEL_B_FEATURES = MODEL_A_FEATURES + [
    "price_vnd", "brand_tier", "value_index", "discount_percent", "sales_score",
]

# Tu khoa nhan dien GPU RIME (dedicated/card roi) tu TEN khi khong co san du lieu benchmark
# ro rang - vd "NVIDIA GeForce RTX 4060" chua "geforce" nen duoc coi la co card roi.
DEDICATED_GPU_MARKERS = ("geforce", "radeon rx", "rtx", "quadro", "arc a")


def normalize_name(name: str) -> str:
    """Chuan hoa TEN CPU/GPU de so khop duoc du viet hoa/thuong hay them ky hieu ban quyen
    khac nhau. Vi du: "Intel Core i5-12500H", "Intel(R) Core(TM) i5-12500H Processor" va
    "intel core i5-12500h" deu tro ve CUNG mot chuoi sau khi qua ham nay."""
    name = str(name).lower()
    for token in ("(r)", "(tm)", "processor"):
        name = name.replace(token, "")
    return re.sub(r"\s+", " ", name).strip()


def build_bench_lookup(bench_df: pd.DataFrame) -> dict[str, float]:
    """Doc bang benchmark (cpu_benchmark.csv / gpu_benchmark.csv) va dung MOT TU DIEN TRA CUU
    "ten CPU/GPU (da chuan hoa) -> diem so (thang 0-100)".

    Diem goc trong file CSV la diem PassMark THO (vd 21800 cho i5-12500H) - con so nay khong
    co gioi han tren co dinh nen KHONG dung truc tiep de so sanh giua cac lan huan luyen khac
    nhau. Vi vay o day QUY DOI ve thang 0-100 bang cach chia cho diem CAO NHAT trong bang: may
    manh nhat trong bang benchmark luon duoc 100 diem, cac may khac ti le theo do.
    """
    max_raw = bench_df["raw_score"].max()
    lookup: dict[str, float] = {}
    for _, row in bench_df.iterrows():
        score = 100.0 * row["raw_score"] / max_raw
        # Luu ca theo `pattern` (ma ngan, vd "i5-12500h") lan `display_name" (ten day du,
        # vd "intel core i5-12500h") de tang kha nang khop voi ten ghi trong catalog
        lookup[normalize_name(row["pattern"])] = score
        lookup[normalize_name(row["display_name"])] = score
    return lookup


def match_score(model_name: str, lookup: dict[str, float]) -> float | None:
    """Tra diem benchmark cho MOT ten CPU/GPU cu the, dung tu dien da dung o build_bench_lookup.

    Thu khop CHINH XAC truoc (nhanh, chac chan dung). Neu khong co, thu khop MOT PHAN: ten
    trong catalog co CHUA pattern trong bang, hoac nguoc lai (vd catalog ghi "Intel Core
    i5-12500H (2.5GHz)" van khop voi pattern "i5-12500h" du co them phan "(2.5GHz)" du thua).

    Tra ve None neu khong tim thay - noi goi ham nay (enrich_catalog) se COI DAY LA LOI va bao
    ro danh sach ten khong khop, thay vi tu doan mo (docs/03 §4 yeu cau "khong tu doan").
    """
    norm = normalize_name(model_name)
    if norm in lookup:
        return lookup[norm]
    for key, score in lookup.items():
        if key in norm or norm in key:
            return score
    return None


def is_gpu_dedicated(gpu_model: str) -> int:
    """Doan GPU co phai la CARD ROI (dedicated, co bo nho rieng, manh hon) hay CARD TICH HOP
    (integrated, dung chung bo nho voi CPU, yeu hon) - CHI dua vao tu khoa trong TEN, dung khi
    bang benchmark chua co san cot `dedicated` ro rang (xem enrich_catalog ben duoi, uu tien
    dung cot that neu co)."""
    norm = normalize_name(gpu_model)
    return int(any(marker in norm for marker in DEDICATED_GPU_MARKERS))


def compute_ppi(resolution: str, screen_inch: float) -> float:
    """Tinh PPI (Pixels Per Inch - mat do diem anh) tu do phan giai (vd "1920x1080") va kich
    thuoc man hinh theo inch. Cong thuc: duong cheo man hinh tinh bang PIXEL (Pythagoras: can
    bac hai cua rong^2 + cao^2) chia cho duong cheo tinh bang INCH. PPI cang cao, man hinh
    cang SAC NET (nhieu diem anh tren cung mot don vi do dai vat ly)."""
    w, h = (int(x) for x in str(resolution).lower().split("x"))
    return float(np.sqrt(w**2 + h**2) / screen_inch)


def enrich_catalog(catalog: pd.DataFrame, cpu_bench: pd.DataFrame, gpu_bench: pd.DataFrame) -> pd.DataFrame:
    """Ham CHINH cua file nay: nhan catalog THO (tu CSV, chi co ten CPU/GPU dang chuoi) va bang
    benchmark, tra ve catalog DA LAM GIAU them cac cot so hoc can cho mo hinh:
    cpu_score, gpu_score, gpu_dedicated, ppi, performance_index, value_index.

    Day la buoc BAT BUOC phai chay TRUOC khi dua du lieu vao bat ky mo hinh kNN nao (Mo hinh A
    hay B) - ca train.py, evaluate.py, va main.py (luc dong bo catalog tu backend) deu goi ham
    nay dau tien.
    """
    df = catalog.copy()
    cpu_lookup = build_bench_lookup(cpu_bench)
    gpu_lookup = build_bench_lookup(gpu_bench)

    # Doi CHIEU TUNG DONG trong catalog voi bang benchmark de lay diem CPU/GPU tuong ung.
    # Neu co ten khong khop duoc, GOM LAI de bao loi MOT LAN (khong bao loi tung dong rieng le,
    # se rat kho doc neu co hang tram dong loi).
    cpu_scores, gpu_scores, unmatched_cpu, unmatched_gpu = [], [], [], []
    for _, row in df.iterrows():
        cs = match_score(row["cpu_model"], cpu_lookup)
        gs = match_score(row["gpu_model"], gpu_lookup)
        if cs is None:
            unmatched_cpu.append(row["cpu_model"])
            cs = 0.0
        if gs is None:
            unmatched_gpu.append(row["gpu_model"])
            gs = 0.0
        cpu_scores.append(cs)
        gpu_scores.append(gs)

    if unmatched_cpu or unmatched_gpu:
        raise ValueError(
            f"Khong khop bang benchmark. CPU: {sorted(set(unmatched_cpu))} "
            f"GPU: {sorted(set(unmatched_gpu))}"
        )

    df["cpu_score"] = cpu_scores
    df["gpu_score"] = gpu_scores

    # Uu tien cot `dedicated` THAT trong bang benchmark (chinh xac hon); chi doan tu ten
    # (is_gpu_dedicated) khi bang benchmark cu KHONG co cot nay (tuong thich nguoc)
    if "dedicated" in gpu_bench.columns:
        ded_map = {normalize_name(r["display_name"]): int(r["dedicated"]) for _, r in gpu_bench.iterrows()}
        df["gpu_dedicated"] = df["gpu_model"].apply(
            lambda g: ded_map.get(normalize_name(g), is_gpu_dedicated(g))
        )
    else:
        df["gpu_dedicated"] = df["gpu_model"].apply(is_gpu_dedicated)

    # Catalog cu (truoc khi co cot brand_tier) se duoc gan gia tri TRUNG BINH (3/5) de khong
    # loi khi chay lai code cu tren du lieu cu
    if "brand_tier" not in df.columns:
        df["brand_tier"] = 3

    df["ppi"] = df.apply(lambda r: compute_ppi(r["resolution"], r["screen_inch"]), axis=1)
    # Thieu du lieu (NaN): tan so quet mac dinh 60Hz (chuan pho thong); pin thieu thi lay
    # TRUNG VI CUNG PHAN KHUC (may Gaming pin trung binh khac may Van phong, lay trung vi
    # theo tung nhom hop ly hon lay trung vi chung ca catalog)
    df["refresh_hz"] = df["refresh_hz"].fillna(60)
    df["battery_wh"] = df.groupby("segment")["battery_wh"].transform(
        lambda s: s.fillna(s.median())
    )

    # performance_index: CHI SO HIEN THI cho nguoi dung (khac voi cpu_score/gpu_score dung
    # NOI BO cho mo hinh) - gop CPU+GPU+RAM+SSD thanh MOT con so 0-100 de de hinh dung
    # "may nay manh co 75/100 diem" thay vi phai nhin 4 con so rieng le. Trong so 0.5/0.35/
    # 0.1/0.05 phan anh CPU va GPU quan trong hon nhieu so voi dung luong RAM/SSD khi noi ve
    # "hieu nang" thuan tuy.
    ram_norm = df["ram_gb"] / df["ram_gb"].max()
    ssd_norm = df["ssd_gb"] / df["ssd_gb"].max()
    df["performance_index"] = (
        0.5 * df["cpu_score"] + 0.35 * df["gpu_score"] + 0.1 * (100 * ram_norm) + 0.05 * (100 * ssd_norm)
    )
    # value_index: "hieu nang tren MOI TRIEU DONG bo ra" - con so cang cao nghia la may cang
    # DANG TIEN (nhieu hieu nang voi gia thap). Dung lam huy hieu "Dang tien nhat" o frontend
    # VA la mot dac trung THAT trong Mo hinh B (xem MODEL_B_FEATURES o tren).
    df["value_index"] = df["performance_index"] / (df["price_vnd"] / 1_000_000)

    # discount_percent: % giam gia so voi gia niem yet goc. May khong khuyen mai (originalPrice
    # rong/NaN) mac dinh = 0 (khong giam). Thang 0-100 giong % hien thi cho nguoi dung.
    if "original_price_vnd" in df.columns:
        has_discount = df["original_price_vnd"].notna() & (df["original_price_vnd"] > 0)
        df["discount_percent"] = np.where(
            has_discount,
            (df["original_price_vnd"] - df["price_vnd"]) / df["original_price_vnd"].replace(0, np.nan) * 100,
            0.0,
        )
        df["discount_percent"] = df["discount_percent"].fillna(0.0).clip(lower=0)
    else:
        df["discount_percent"] = 0.0

    # sales_score: quy doi so luot ban THO ve thang 0-100 bang LOG (giong cach chuan hoa
    # cpu_score/gpu_score) - vi luot ban thuong lech phai manh (vai may ban rat chay, da so
    # con lai it hon nhieu), lay log giup "500 luot vs 50 luot" va "50 luot vs 5 luot" co
    # y nghia gan tuong duong nhau ve mat khoang cach, thay vi 500 lan at hoan toan moi thu khac.
    if "sales_count" in df.columns:
        sales = df["sales_count"].fillna(0).clip(lower=0)
        log_sales = np.log1p(sales)
        max_log = log_sales.max()
        df["sales_score"] = 100.0 * log_sales / max_log if max_log > 0 else 0.0
    else:
        df["sales_score"] = 0.0

    return df


def build_model_a_preprocessor() -> ColumnTransformer:
    """Dung buoc TIEN XU LY cho Mo hinh A: moi nhom dac trung duoc xu ly KHAC NHAU truoc khi
    dua vao kNN, vi kNN rat nhay cam voi THANG DO cua du lieu (mot dac trung co gia tri hang
    nghin se "lan at" hoan toan dac trung co gia tri hang don vi khi tinh khoang cach, du dac
    trung do khong he quan trong hon).

    - Nhom NUMERIC_LOG (ram_gb, ssd_gb): DIEN gia tri thieu bang trung vi -> lay LOG2 -> chuan
      hoa z-score (tru trung binh, chia do lech chuan - dua ve thang trung binh 0, phuong sai 1)
    - Nhom NUMERIC (cpu_score, gpu_score,...): dien gia tri thieu -> chuan hoa z-score truc tiep
    - Nhom BINARY (gpu_dedicated, srgb_100): GIU NGUYEN (passthrough), khong xu ly gi them vi
      da o dang 0/1 san, chuan hoa them se khong co y nghia
    """
    return ColumnTransformer([
        (
            "log",
            Pipeline([
                ("impute", SimpleImputer(strategy="median")),
                ("log", FunctionTransformer(np.log2, feature_names_out="one-to-one")),
                ("sc", StandardScaler()),
            ]),
            NUMERIC_LOG,
        ),
        (
            "num",
            Pipeline([
                ("impute", SimpleImputer(strategy="median")),
                ("sc", StandardScaler()),
            ]),
            NUMERIC,
        ),
        ("bin", "passthrough", BINARY),
    ])
