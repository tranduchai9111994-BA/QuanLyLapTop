"""Kiem tra chat luong du lieu catalog VN (xem docs/03 §7).

Chay: python -m app.data.data_check  (tu thu muc ml-service)
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[3]
CATALOG_PATH = ROOT / "data" / "processed" / "catalog_vn.csv"
CPU_BENCH_PATH = ROOT / "data" / "processed" / "cpu_benchmark.csv"
GPU_BENCH_PATH = ROOT / "data" / "processed" / "gpu_benchmark.csv"

VALID_RAM = {4, 8, 12, 16, 24, 32, 64}
PRICE_RANGE = (5_000_000, 150_000_000)
WEIGHT_RANGE = (0.8, 4.5)

# Cột bắt buộc để huấn luyện và 4 nhãn phân khúc hợp lệ
REQUIRED_COLUMNS = [
    "sku", "brand", "brand_tier", "name", "cpu_model", "gpu_model", "ram_gb", "ssd_gb", "screen_inch",
    "resolution", "refresh_hz", "srgb_100", "weight_kg", "battery_wh", "price_vnd", "original_price_vnd",
    "sales_count", "segment",
]
NUMERIC_COLUMNS = ["ram_gb", "ssd_gb", "screen_inch", "refresh_hz", "weight_kg", "battery_wh", "price_vnd", "brand_tier"]
VALID_SEGMENTS = {"OFFICE", "ULTRABOOK", "GAMING", "CREATOR"}


def check_catalog_format(catalog: pd.DataFrame) -> list[str]:
    """Kiểm tra file catalog (đặc biệt khi người dùng sửa bằng Excel) và trả về danh sách lỗi bằng tiếng Việt."""
    missing = [c for c in REQUIRED_COLUMNS if c not in catalog.columns]
    if missing:
        return [
            f"Thiếu cột: {missing}. Nếu cả file chỉ có 1 cột thì Excel đã lưu bằng dấu chấm phẩy (;) thay vì "
            "dấu phẩy (,): hãy lưu bằng 'CSV UTF-8 (Comma delimited)' và mở bằng VS Code kiểm tra dòng đầu "
            "phải ngăn cách bằng dấu phẩy. Cũng không được đổi tên hoặc xóa dòng tiêu đề."
        ]
    errors = []
    for col in NUMERIC_COLUMNS:
        if not pd.api.types.is_numeric_dtype(catalog[col]):
            bad = catalog.loc[pd.to_numeric(catalog[col], errors="coerce").isna(), col].head(3).tolist()
            errors.append(
                f"Cột {col} có giá trị không phải số, ví dụ {bad}. Số thập phân phải dùng dấu chấm (2.51), "
                "không dùng dấu phẩy (2,51); không có khoảng trắng hay chữ."
            )
    bad_seg = sorted(set(catalog["segment"].dropna().astype(str)) - VALID_SEGMENTS)
    if bad_seg or catalog["segment"].isna().any():
        errors.append(
            f"Cột segment phải là một trong {sorted(VALID_SEGMENTS)} (viết HOA, không để trống); "
            f"đang có giá trị lạ: {bad_seg}, ô trống: {int(catalog['segment'].isna().sum())}"
        )
    return errors


def normalize_name(name: str) -> str:
    name = name.lower()
    for token in ("(r)", "(tm)", "processor", "nvidia", "geforce", "amd", "intel"):
        name = name.replace(token, "")
    name = re.sub(r"\s+", " ", name).strip()
    return name


def build_lookup(bench_df: pd.DataFrame) -> dict[str, str]:
    lookup: dict[str, str] = {}
    for _, row in bench_df.iterrows():
        lookup[normalize_name(str(row["pattern"]))] = row["pattern"]
        lookup[normalize_name(str(row["display_name"]))] = row["pattern"]
    return lookup


def match_bench(model_name: str, lookup: dict[str, str]) -> str | None:
    norm = normalize_name(model_name)
    if norm in lookup:
        return lookup[norm]
    for key, pattern in lookup.items():
        if key in norm or norm in key:
            return pattern
    return None


def main() -> int:
    errors: list[str] = []
    warnings: list[str] = []

    catalog = pd.read_csv(CATALOG_PATH)
    format_errors = check_catalog_format(catalog)
    if format_errors:  # sai định dạng thì các kiểm tra sau không còn ý nghĩa
        print("\n=== Loi ===")
        for e in format_errors:
            print("-", e)
        return 1
    cpu_bench = pd.read_csv(CPU_BENCH_PATH)
    gpu_bench = pd.read_csv(GPU_BENCH_PATH)

    dup_sku = catalog[catalog["sku"].duplicated(keep=False)]
    if not dup_sku.empty:
        errors.append(f"Trung sku: {sorted(dup_sku['sku'].unique().tolist())}")

    cpu_lookup = build_lookup(cpu_bench)
    gpu_lookup = build_lookup(gpu_bench)
    unmatched_cpu = sorted({
        m for m in catalog["cpu_model"].unique() if match_bench(m, cpu_lookup) is None
    })
    unmatched_gpu = sorted({
        m for m in catalog["gpu_model"].unique() if match_bench(m, gpu_lookup) is None
    })
    if unmatched_cpu:
        errors.append(f"CPU khong khop bang benchmark: {unmatched_cpu}")
    if unmatched_gpu:
        errors.append(f"GPU khong khop bang benchmark: {unmatched_gpu}")

    out_of_price = catalog[~catalog["price_vnd"].between(*PRICE_RANGE)]
    if not out_of_price.empty:
        warnings.append(f"{len(out_of_price)} may co gia ngoai khoang {PRICE_RANGE}")

    out_of_weight = catalog[~catalog["weight_kg"].between(*WEIGHT_RANGE)]
    if not out_of_weight.empty:
        warnings.append(f"{len(out_of_weight)} may co trong luong ngoai khoang {WEIGHT_RANGE}")

    invalid_ram = catalog[~catalog["ram_gb"].isin(VALID_RAM)]
    if not invalid_ram.empty:
        warnings.append(f"{len(invalid_ram)} may co ram_gb khong thuoc {sorted(VALID_RAM)}")

    optional_cols = {"retailer_category_2", "image_url", "label_note"}
    check_cols = [c for c in catalog.columns if c not in optional_cols]
    missing_pct = catalog[check_cols].isna().mean() * 100
    over_10pct = missing_pct[missing_pct > 10]
    if not over_10pct.empty:
        errors.append(f"Cot thieu qua 10%: {over_10pct.to_dict()}")

    print("=== Phan bo mau theo phan khuc ===")
    print(catalog["segment"].value_counts())
    print()

    under_50 = catalog["segment"].value_counts()
    under_50 = under_50[under_50 < 50]
    if not under_50.empty:
        warnings.append(f"Lop duoi 50 mau: {under_50.to_dict()}")

    if warnings:
        print("=== Canh bao ===")
        for w in warnings:
            print(f"- {w}")
        print()

    if errors:
        print("=== Loi ===")
        for e in errors:
            print(f"- {e}")
        return 1

    print(f"OK: {len(catalog)} mau, khong co loi.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
