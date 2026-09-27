"""Tich hop THAT voi API cong khai DummyJSON de tai anh san pham that (khong phai tai tay 1 lan
roi bo vao repo khong ai kiem chung lai duoc).

Boi canh: DummyJSON (https://dummyjson.com) la API mau (sample REST API, tham khao tu
https://publicapis.io/rest-api-examples) chi co DUNG 5 san pham trong category "laptops"
(Apple/Asus/Huawei/Lenovo/Dell) - KHONG PHAI loi cua script, ma la gioi han that su cua nguon du
lieu mien phi nay. Vi vay he thong chi co the dung anh THAT cho 5 hang nay; 7 hang con lai
(Acer/HP/MSI/LG/Gigabyte/Masstel/Avita) dung minh hoa ve tay (xem
frontend/src/components/smart/LaptopThumbnail.tsx) vi KHONG CO nguon anh that mien phi nao cho
cac hang do trong pham vi do an.

Chay lai script nay bat cu luc nao muon lam moi anh (vd API doi anh, hoac muon chung minh cho
hoi dong rang day la GOI API THAT chu khong phai anh tai tay khong ro nguon goc):

    python scripts/fetch_brand_photos.py
"""
from __future__ import annotations

import urllib.request
from pathlib import Path

OUT_DIR = Path(__file__).resolve().parent.parent / "frontend" / "public" / "brand-photos"
API_URL = "https://dummyjson.com/products/category/laptops?limit=0&select=title,brand,thumbnail"

# Anh xa ten hang theo dung API (co the viet hoa/thuong khac voi ten hang trong catalog cua ta,
# vd DummyJSON tra ve "Asus" nhung catalog cua ta dung "ASUS") -> chuan hoa ve dung ten file dang
# dung trong BRAND_PHOTO cua LaptopThumbnail.tsx.
BRAND_FILENAME = {
    "apple": "apple.webp",
    "asus": "asus.webp",
    "huawei": "huawei.webp",
    "lenovo": "lenovo.webp",
    "dell": "dell.webp",
}


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    # DummyJSON tra ve 403 Forbidden neu thieu User-Agent (chan request "khong giong trinh
    # duyet"/khong co UA mac dinh cua thu vien urllib) - phai tu dat header nay.
    req = urllib.request.Request(API_URL, headers={"User-Agent": "Mozilla/5.0 (SmartLap data script)"})
    with urllib.request.urlopen(req, timeout=15) as resp:
        import json

        data = json.load(resp)

    products = data.get("products", [])
    print(f"DummyJSON tra ve {data.get('total', len(products))} san pham trong category 'laptops'")

    saved = 0
    for p in products:
        brand_key = (p.get("brand") or "").strip().lower()
        filename = BRAND_FILENAME.get(brand_key)
        if not filename:
            print(f"  BO QUA (khong co trong BRAND_FILENAME): {p.get('brand')} - {p.get('title')}")
            continue

        thumb_url = p["thumbnail"]
        dest = OUT_DIR / filename
        img_req = urllib.request.Request(thumb_url, headers={"User-Agent": "Mozilla/5.0 (SmartLap data script)"})
        with urllib.request.urlopen(img_req, timeout=15) as img_resp:
            dest.write_bytes(img_resp.read())
        size_kb = dest.stat().st_size / 1024
        print(f"  OK: {p.get('brand'):8s} <- {p.get('title'):45s} ({size_kb:.0f} KB) -> {dest.name}")
        saved += 1

    print(f"\nDa tai {saved}/{len(BRAND_FILENAME)} anh vao {OUT_DIR}")
    missing = set(BRAND_FILENAME) - {
        (p.get("brand") or "").strip().lower() for p in products if (p.get("brand") or "").strip().lower() in BRAND_FILENAME
    }
    if missing:
        print(f"CANH BAO: khong tim thay hang {missing} trong ket qua API (co the API da doi du lieu)")


if __name__ == "__main__":
    main()
