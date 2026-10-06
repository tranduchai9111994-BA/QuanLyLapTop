"""Tải ảnh sản phẩm thật từ API công khai DummyJSON (https://dummyjson.com) vào frontend/public/brand-photos/.
Category "laptops" của DummyJSON chỉ có 5 sản phẩm (Apple, Asus, Huawei, Lenovo, Dell), đó là giới hạn của nguồn miễn phí.
Vì vậy chỉ 5 hãng này có ảnh thật; 7 hãng còn lại (Acer, HP, MSI, LG, Gigabyte, Masstel, Avita) dùng minh họa vẽ tay
(xem frontend/src/components/smart/LaptopThumbnail.tsx). Chạy lại để làm mới ảnh hoặc chứng minh nguồn gốc ảnh:

    python scripts/fetch_brand_photos.py
"""
from __future__ import annotations

import urllib.request
from pathlib import Path

OUT_DIR = Path(__file__).resolve().parent.parent / "frontend" / "public" / "brand-photos"
API_URL = "https://dummyjson.com/products/category/laptops?limit=0&select=title,brand,thumbnail"

# Tên hãng theo API (khác hoa/thường với catalog, vd "Asus" so với "ASUS") ánh xạ sang tên file mà
# BRAND_PHOTO trong LaptopThumbnail.tsx đang dùng.
BRAND_FILENAME = {
    "apple": "apple.webp",
    "asus": "asus.webp",
    "huawei": "huawei.webp",
    "lenovo": "lenovo.webp",
    "dell": "dell.webp",
}


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    # DummyJSON trả 403 nếu thiếu User-Agent (chặn UA mặc định của urllib), nên phải tự đặt header này.
    req = urllib.request.Request(API_URL, headers={"User-Agent": "Mozilla/5.0 (SmartLap data script)"})
    with urllib.request.urlopen(req, timeout=15) as resp:
        import json

        data = json.load(resp)

    products = data.get("products", [])
    print(f"DummyJSON trả về {data.get('total', len(products))} sản phẩm trong category 'laptops'")

    saved = 0
    for p in products:
        brand_key = (p.get("brand") or "").strip().lower()
        filename = BRAND_FILENAME.get(brand_key)
        if not filename:
            print(f"  BỎ QUA (không có trong BRAND_FILENAME): {p.get('brand')} - {p.get('title')}")
            continue

        thumb_url = p["thumbnail"]
        dest = OUT_DIR / filename
        img_req = urllib.request.Request(thumb_url, headers={"User-Agent": "Mozilla/5.0 (SmartLap data script)"})
        with urllib.request.urlopen(img_req, timeout=15) as img_resp:
            dest.write_bytes(img_resp.read())
        size_kb = dest.stat().st_size / 1024
        print(f"  OK: {p.get('brand'):8s} <- {p.get('title'):45s} ({size_kb:.0f} KB) -> {dest.name}")
        saved += 1

    print(f"\nĐã tải {saved}/{len(BRAND_FILENAME)} ảnh vào {OUT_DIR}")
    missing = set(BRAND_FILENAME) - {
        (p.get("brand") or "").strip().lower() for p in products if (p.get("brand") or "").strip().lower() in BRAND_FILENAME
    }
    if missing:
        print(f"CẢNH BÁO: không tìm thấy hãng {missing} trong kết quả API (có thể API đã đổi dữ liệu)")


if __name__ == "__main__":
    main()
