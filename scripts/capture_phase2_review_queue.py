"""Kiểm thử Giai đoạn 2 trên browser thật: UC-10 hàng đợi "Cần xác minh".
Tạm đặt ngưỡng tin cậy 1.01 (lớn hơn mọi xác suất) để máy mới tạo qua API luôn vào NEEDS_REVIEW, rồi dùng browser để:
  1. xem huy hiệu số máy chờ ở menu "Duyệt nhãn"; 2. vào màn Duyệt nhãn xem máy vừa tạo; 3. duyệt (giữ nhãn AI).
Cuối script trả ngưỡng về giá trị cũ và xóa máy test. Chạy khi 3 dịch vụ đang chạy: python scripts/capture_phase2_review_queue.py
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
    print("Máy test:", laptop["id"], sku, "| trạng thái nhãn:", laptop["segmentLabel"]["status"])
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
        # Dọn dẹp: xóa máy test và các bảng phụ thuộc, kể cả khi script lỗi giữa chừng
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

    print(f"Đã lưu ảnh phase2_* vào {OUT}")


if __name__ == "__main__":
    main()
