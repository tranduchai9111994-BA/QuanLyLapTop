"""Kiem thu Giai doan 1 tren browser that: laptop them moi tu trang quan tri phai duoc GAN NHAN
PHAN KHUC va DUOC GOI Y cho khach (truoc day khong bao gio duoc goi y vi thieu nhan).

Chay khi 3 dich vu dang chay:  python scripts/capture_phase1_segment.py
Anh luu vao crud_test_screenshots/phase1_*.png. Script TAO 1 may test (SKU bat dau "TEST-P1-")
va KHONG tu xoa - can xoa sau khi xem anh de khong de rac trong catalog.
"""
from datetime import datetime
from pathlib import Path

from playwright.sync_api import sync_playwright

OUT = Path(__file__).resolve().parent.parent / "crud_test_screenshots"
OUT.mkdir(exist_ok=True)
BASE = "http://localhost:5180"
SKU = f"TEST-P1-{datetime.now().strftime('%Y%m%d%H%M%S')}"


def choose(page, label: str, option_text: str):
    page.get_by_label(label).click()
    page.wait_for_timeout(150)
    page.get_by_text(option_text, exact=True).last.click()
    page.wait_for_timeout(150)


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": 1400, "height": 1000})

        page.goto(f"{BASE}/admin/login")
        page.get_by_role("button", name="Đăng nhập").click()
        # CHU Y: "**/admin/**" khop CA "/admin/login" (chua "/admin/") nen wait_for_url voi mau
        # nay se thoa NGAY LAP TUC ma khong doi dang nhap xong that su - phai loai tru /login.
        page.wait_for_url(lambda url: "/admin/login" not in url and "/admin" in url, timeout=10000)

        # 1) Them may moi, bam AI goi y -> thay xac suat + k lang gieng da bo phieu
        page.goto(f"{BASE}/admin/laptops")
        page.wait_for_timeout(1500)
        page.get_by_text("+ Thêm mới").click()
        page.wait_for_timeout(500)
        page.get_by_label("Mã SKU").fill(SKU)
        page.get_by_label("Tên máy").fill("Test Giai doan 1")
        choose(page, "Hãng", "Acer")
        choose(page, "CPU", "Intel Core i9-13900H")
        choose(page, "GPU", "NVIDIA GeForce RTX 4070 Laptop")
        choose(page, "RAM (GB)", "32")
        choose(page, "SSD (GB)", "1024")
        choose(page, "Màn hình (inch)", '16"')
        choose(page, "Độ phân giải", "2560 x 1440 (QHD)")
        choose(page, "Tần số quét (Hz)", "240 Hz")
        page.get_by_label("Trọng lượng (kg)").fill("2.6")
        page.get_by_label("Giá (VND)").fill("35000000")
        page.get_by_text("AI gợi ý phân khúc từ cấu hình").click()
        page.wait_for_timeout(1500)
        page.screenshot(path=OUT / "phase1_01_ai_goi_y_kem_lang_gieng.png")

        # 2) O "Phan khuc" da tu dien nhan AI -> chon nhan KHAC de thay canh bao + nut "Dung nhan AI"
        page.get_by_label("Phân khúc").scroll_into_view_if_needed()
        choose(page, "Phân khúc", "Đồ họa – Kỹ thuật")
        page.wait_for_timeout(300)
        page.screenshot(path=OUT / "phase1_02_chon_nhan_khac_ai.png")
        page.get_by_role("button", name="Dùng nhãn AI").click()
        page.wait_for_timeout(300)

        # 3) Luu -> thong bao da gan phan khuc, cot "Phan khuc" hien tren bang
        page.get_by_role("button", name="Lưu").click()
        page.wait_for_timeout(1500)
        page.get_by_placeholder("Tìm kiếm...").fill(SKU)
        page.wait_for_timeout(600)
        page.screenshot(path=OUT / "phase1_03_da_luu_co_phan_khuc.png")

        # 4) Trang Chi tiet cua may moi: phai co "May tuong tu" (tuc may da vao catalog goi y)
        page.goto(f"{BASE}/laptops")
        page.wait_for_timeout(800)
        page.get_by_placeholder("Ví dụ: Legion, ThinkPad...").fill("Test Giai doan 1")
        page.wait_for_timeout(800)
        page.get_by_text("Test Giai doan 1").first.click()
        page.wait_for_url("**/laptop/**", timeout=10000)
        page.wait_for_timeout(1200)
        page.screenshot(path=OUT / "phase1_04_chi_tiet_co_may_tuong_tu.png", full_page=True)

        browser.close()
        print(f"Da luu anh phase1_* vao {OUT} (SKU test: {SKU})")


if __name__ == "__main__":
    main()
