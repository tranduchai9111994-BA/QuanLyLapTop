"""Biến dữ liệu laptop THÔ (tên CPU dạng chuỗi, độ phân giải "1920x1080"...) thành các ĐẶC TRƯNG SỐ
mà kNN tính khoảng cách được (xem docs/03 SS3, SS5).

kNN không biết "Intel Core i5" mạnh hay yếu hơn "AMD Ryzen 5", nên mọi thứ phải được quy đổi về
con số so sánh được (điểm hiệu năng, tỷ lệ, 0/1,...). File này lo đúng việc đó.
"""
from __future__ import annotations

import re

import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import FunctionTransformer, StandardScaler

# ram_gb, ssd_gb: lấy LOG2 trước khi chuẩn hóa (xem build_model_a_preprocessor), vì 8GB->16GB và
# 16GB->32GB đều là "gấp đôi" nên phải có khoảng cách bằng nhau.
NUMERIC_LOG = ["ram_gb", "ssd_gb"]  # nhóm 1 (2 cột): lấy log2 rồi mới chuẩn hóa

# Đặc trưng số bình thường, chuẩn hóa z-score trực tiếp
NUMERIC = ["cpu_score", "gpu_score", "screen_inch", "ppi", "refresh_hz", "weight_kg", "battery_wh"]  # nhóm 2 (7 cột): chuẩn hóa thẳng

# Đặc trưng nhị phân (0/1), giữ nguyên vì đã ở thang 0-1
BINARY = ["gpu_dedicated", "srgb_100"]  # nhóm 3 (2 cột): giữ nguyên 0/1

# Đặc trưng đầu vào của MÔ HÌNH A (phân lớp phân khúc). price_vnd cố ý KHÔNG có (quyết định D-04):
# nếu có, mô hình sẽ học phân khúc theo GIÁ thay vì CẤU HÌNH THẬT.
MODEL_A_FEATURES = NUMERIC_LOG + NUMERIC + BINARY  # ★ 11 cột = 2 + 7 + 2: đầu vào Mô hình A

# Đặc trưng đầu vào của MÔ HÌNH B (truy hồi/xếp hạng). Ngược với Mô hình A, giá và độ "đáng tiền"
# (value_index) PHẢI có vì mục đích của Mô hình B là cân bằng hiệu năng và giá.
#
# `discount_percent` và `sales_score` mô phỏng hành vi mua sắm thực tế: máy giảm giá sâu và bán
# chạy có thể được ưu tiên hơn máy rẻ hơn nhưng ít khuyến mãi/ít người mua.
MODEL_B_FEATURES = MODEL_A_FEATURES + [  # ★ Mô hình B = 11 cột của A + 5 cột dưới = 16 cột
    "price_vnd", "brand_tier", "value_index", "discount_percent", "sales_score",
]

# Từ khóa nhận diện GPU RỜI từ TÊN khi không có dữ liệu benchmark rõ ràng
DEDICATED_GPU_MARKERS = ("geforce", "radeon rx", "rtx", "quadro", "arc a")


def normalize_name(name: str) -> str:
    """Chuẩn hóa tên CPU/GPU để so khớp được dù khác hoa/thường hay ký hiệu bản quyền. Vd
    "Intel(R) Core(TM) i5-12500H Processor" và "intel core i5-12500h" cho cùng một chuỗi."""
    name = str(name).lower()
    for token in ("(r)", "(tm)", "processor"):
        name = name.replace(token, "")
    return re.sub(r"\s+", " ", name).strip()


def build_bench_lookup(bench_df: pd.DataFrame) -> dict[str, float]:
    """Đọc bảng benchmark và dựng từ điển "tên CPU/GPU (đã chuẩn hóa) -> điểm (thang 0-100)".

    Điểm gốc PassMark thô không có giới hạn trên, nên quy đổi bằng cách chia cho điểm CAO NHẤT
    trong bảng: máy mạnh nhất luôn được 100 điểm.
    """
    max_raw = bench_df["raw_score"].max()
    lookup: dict[str, float] = {}
    for _, row in bench_df.iterrows():
        score = 100.0 * row["raw_score"] / max_raw
        # Lưu cả `pattern` (mã ngắn, vd "i5-12500h") lẫn `display_name` (tên đầy đủ) để dễ khớp hơn
        lookup[normalize_name(row["pattern"])] = score
        lookup[normalize_name(row["display_name"])] = score
    return lookup


def match_score(model_name: str, lookup: dict[str, float]) -> float | None:
    """Tra điểm benchmark cho một tên CPU/GPU: thử khớp CHÍNH XÁC trước, rồi khớp MỘT PHẦN (tên
    chứa pattern hoặc ngược lại, vd "Intel Core i5-12500H (2.5GHz)" khớp "i5-12500h").

    Trả None nếu không thấy; enrich_catalog coi đây là LỖI và báo rõ, không tự đoán (docs/03 §4).
    """
    norm = normalize_name(model_name)
    if norm in lookup:
        return lookup[norm]
    for key, score in lookup.items():
        if key in norm or norm in key:
            return score
    return None


def is_gpu_dedicated(gpu_model: str) -> int:
    """Đoán GPU là card RỜI hay TÍCH HỢP, chỉ dựa vào từ khóa trong TÊN. Dùng khi bảng benchmark
    chưa có cột `dedicated` (enrich_catalog ưu tiên cột thật nếu có)."""
    norm = normalize_name(gpu_model)
    return int(any(marker in norm for marker in DEDICATED_GPU_MARKERS))


def compute_ppi(resolution: str, screen_inch: float) -> float:
    """Tính PPI (mật độ điểm ảnh) = đường chéo tính bằng pixel (Pythagoras) chia đường chéo tính
    bằng inch. PPI càng cao màn hình càng sắc nét."""
    w, h = (int(x) for x in str(resolution).lower().split("x"))
    return float(np.sqrt(w**2 + h**2) / screen_inch)


def enrich_catalog(catalog: pd.DataFrame, cpu_bench: pd.DataFrame, gpu_bench: pd.DataFrame) -> pd.DataFrame:
    """Hàm CHÍNH của file: nhận catalog THÔ và bảng benchmark, trả catalog đã làm giàu các cột số:
    cpu_score, gpu_score, gpu_dedicated, ppi, performance_index, value_index.

    Phải chạy TRƯỚC khi đưa dữ liệu vào Mô hình A/B (train.py, evaluate.py, main.py đều gọi đầu tiên).
    """
    df = catalog.copy()
    cpu_lookup = build_bench_lookup(cpu_bench)
    gpu_lookup = build_bench_lookup(gpu_bench)

    # Đối chiếu từng dòng với bảng benchmark; tên không khớp thì gom lại báo lỗi MỘT lần cho dễ đọc
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

    # Ưu tiên cột `dedicated` thật trong bảng benchmark; chỉ đoán từ tên khi bảng cũ không có cột này
    if "dedicated" in gpu_bench.columns:
        ded_map = {normalize_name(r["display_name"]): int(r["dedicated"]) for _, r in gpu_bench.iterrows()}
        df["gpu_dedicated"] = df["gpu_model"].apply(
            lambda g: ded_map.get(normalize_name(g), is_gpu_dedicated(g))
        )
    else:
        df["gpu_dedicated"] = df["gpu_model"].apply(is_gpu_dedicated)

    # Catalog cũ chưa có brand_tier thì gán trung bình (3/5) để không lỗi
    if "brand_tier" not in df.columns:
        df["brand_tier"] = 3

    df["ppi"] = df.apply(lambda r: compute_ppi(r["resolution"], r["screen_inch"]), axis=1)
    # Thiếu dữ liệu: tần số quét mặc định 60Hz; pin thiếu thì lấy TRUNG VỊ CÙNG PHÂN KHÚC
    df["refresh_hz"] = df["refresh_hz"].fillna(60)
    df["battery_wh"] = df.groupby("segment")["battery_wh"].transform(
        lambda s: s.fillna(s.median())
    )

    # performance_index: chỉ số HIỂN THỊ (khác cpu_score/gpu_score dùng nội bộ), gộp CPU+GPU+RAM+SSD
    # thành một số 0-100. Trọng số 0.5/0.35/0.1/0.05 vì CPU và GPU quan trọng hơn RAM/SSD.
    ram_norm = df["ram_gb"] / df["ram_gb"].max()
    ssd_norm = df["ssd_gb"] / df["ssd_gb"].max()
    df["performance_index"] = (
        0.5 * df["cpu_score"] + 0.35 * df["gpu_score"] + 0.1 * (100 * ram_norm) + 0.05 * (100 * ssd_norm)
    )
    # value_index: hiệu năng trên mỗi triệu đồng, càng cao càng ĐÁNG TIỀN. Dùng cho huy hiệu
    # "Đáng tiền nhất" ở frontend và là đặc trưng thật của Mô hình B (MODEL_B_FEATURES).
    df["value_index"] = df["performance_index"] / (df["price_vnd"] / 1_000_000)

    # discount_percent: % giảm so với giá niêm yết gốc (thang 0-100); không khuyến mãi thì = 0
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

    # sales_score: lượt bán THÔ quy về 0-100 bằng LOG, vì lượt bán lệch phải mạnh; log giúp
    # "500 vs 50" và "50 vs 5" có ý nghĩa tương đương thay vì một vài máy át hết phần còn lại.
    if "sales_count" in df.columns:
        sales = df["sales_count"].fillna(0).clip(lower=0)
        log_sales = np.log1p(sales)
        max_log = log_sales.max()
        df["sales_score"] = 100.0 * log_sales / max_log if max_log > 0 else 0.0
    else:
        df["sales_score"] = 0.0

    return df


def build_model_a_preprocessor() -> ColumnTransformer:
    """Dựng bước TIỀN XỬ LÝ cho Mô hình A. kNN rất nhạy với THANG ĐO nên mỗi nhóm đặc trưng được
    xử lý khác nhau trước khi tính khoảng cách:

    - NUMERIC_LOG (ram_gb, ssd_gb): điền thiếu bằng trung vị -> LOG2 -> z-score
    - NUMERIC (cpu_score, gpu_score,...): điền thiếu -> z-score trực tiếp
    - BINARY (gpu_dedicated, srgb_100): giữ nguyên (passthrough) vì đã là 0/1
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
