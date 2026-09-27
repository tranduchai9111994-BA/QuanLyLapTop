"""Kiem thu Giai doan 2 tren browser that: UC-10 hang doi 'Can xac minh'.

Tam ha nguong tin cay xuong 1.01 (luon > moi xac suat thuc, ep MOI may moi tao roi vao trang
thai NEEDS_REVIEW), tao 1 may test qua API (nhanh hon dien form), roi dung browser THAT de:
  1. Xem menu "Duyet nhan" hien so dang cho (huy hieu)
  2. Vao man Duyet nhan, thay may vua tao kem phan bo xac suat
  3. Duyet (giu nguyen nhan AI) -> may bien khoi hang doi

Tra nguong ve 0.6 va xoa may test o cuoi. Chay khi 3 dich vu dang chay:
    python scripts/capture_phase2_review_queue.py
"""
from datetime import datetime

import requests
from playwright.sync_api import sync_playwright

API = "http://localhost:4000/api"
BASE = "http://localhost:5180"
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "crud_test_screenshots"
OUT.mkdir(exist_ok=True)


def main():
    token = requests.post(f"{API}/auth/login", json={"email": "admin@smartlap.vn", "password": "Demo@123"}).json()["data"]["token"]
    headers = {"Authorization": f"Bearer {token}"}

    old_threshold = requests.get(f"{API}/knowledge/config/confidence_threshold", headers=headers).json()["data"]["valueJson"]
    requests.put(f"{API}/knowledge/config/confidence_threshold", json={"value": 1.01}, headers=headers)

    sku = f"TEST-P2-{datetime.now().strftime('%Y%m%d%H%M%S')}"
    laptop = requests.post(
        f"{API}/laptops",
        headers=headers,
        json={
            "sku": sku, "name": "Test Giai doan 2", "brandId": 61, "cpuId": 169, "gpuId": 128,
            "ramGb": 32, "ssdGb": 1024, "screenInch": 16, "resWidth": 2560, "resHeight": 1440,
            "refreshHz": 240, "weightKg": 2.6, "priceVnd": 35000000,
        },
    ).json()["data"]
    print("May test:", laptop["id"], sku, "| trang thai nhan:", laptop["segmentLabel"]["status"])
    assert laptop["segmentLabel"]["status"] == "NEEDS_REVIEW", "Nguong chua duoc ha, may khong vao hang doi"

    requests.put(f"{API}/knowledge/config/confidence_threshold", json={"value": old_threshold}, headers=headers)

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch()
            page = browser.new_page(viewport={"width": 1400, "height": 1000})
            page.goto(f"{BASE}/admin/login")
            page.get_by_role("button", name="Đăng nhập").click()
            page.wait_for_url(lambda url: "/admin/login" not in url and "/admin" in url, timeout=10000)
            page.wait_for_timeout(800)
            page.screenshot(path=OUT / "phase2_01_menu_co_huy_hieu.png")

            page.goto(f"{BASE}/admin/review-queue")
            page.wait_for_timeout(1200)
            page.screenshot(path=OUT / "phase2_02_hang_doi_can_xac_minh.png", full_page=True)

            page.get_by_role("button", name="Duyệt (giữ nhãn AI)").first.click()
            page.wait_for_timeout(1000)
            page.screenshot(path=OUT / "phase2_03_da_duyet_het_hang_doi.png")

            browser.close()
    finally:
        # Don dep: xoa may test that (kem cac bang phu thuoc) du script co loi giua chung hay khong
        import subprocess
        subprocess.run(
            ["node", "-e", f"""
const {{ PrismaClient }} = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {{
  const w = {{ laptopId: {laptop['id']} }};
  await prisma.$transaction([
    prisma.recommendationItem.deleteMany({{ where: w }}),
    prisma.interactionEvent.deleteMany({{ where: w }}),
    prisma.favorite.deleteMany({{ where: w }}),
    prisma.laptopPin.deleteMany({{ where: w }}),
    prisma.priceHistory.deleteMany({{ where: w }}),
    prisma.segmentLabel.deleteMany({{ where: w }}),
    prisma.laptop.deleteMany({{ where: {{ id: {laptop['id']} }} }}),
  ]);
  console.log('Da xoa may test {laptop['id']}');
  await prisma.$disconnect();
}})();
"""],
            cwd=str(Path(__file__).resolve().parent.parent / "backend"),
            check=True,
        )

    print(f"Da luu anh phase2_* vao {OUT}")


if __name__ == "__main__":
    main()
