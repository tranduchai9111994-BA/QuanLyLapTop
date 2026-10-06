"""Kiểm thử Giai đoạn 1 trên browser thật: laptop thêm mới từ trang quản trị phải được gán nhãn phân khúc và được gợi ý cho khách.
Chạy khi 3 dịch vụ đang chạy: python scripts/capture_phase1_segment.py
Ảnh lưu vào crud_test_screenshots/phase1_*.png. Script tạo 1 máy test (SKU bắt đầu "TEST-P1-") và không tự xóa,
cần xóa tay sau khi xem ảnh.
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
        # Mẫu "**/admin/**" cũng khớp "/admin/login" nên sẽ thỏa ngay mà chưa đăng nhập xong; phải loại /login.
        page.wait_for_url(lambda url: "/admin/login" not in url and "/admin" in url, timeout=10000)

        # 1) Thêm máy mới, bấm AI gợi ý: thấy xác suất và k láng giềng đã bỏ phiếu
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

        # 2) Ô "Phân khúc" đã tự điền nhãn AI: chọn nhãn khác để thấy cảnh báo và nút "Dùng nhãn AI"
        page.get_by_label("Phân khúc").scroll_into_view_if_needed()
        choose(page, "Phân khúc", "Đồ họa – Kỹ thuật")
        page.wait_for_timeout(300)
        page.screenshot(path=OUT / "phase1_02_chon_nhan_khac_ai.png")
        page.get_by_role("button", name="Dùng nhãn AI").click()
        page.wait_for_timeout(300)

        # 3) Lưu: có thông báo đã gán phân khúc, cột "Phân khúc" hiện trên bảng
        page.get_by_role("button", name="Lưu").click()
        page.wait_for_timeout(1500)
        page.get_by_placeholder("Tìm kiếm...").fill(SKU)
        page.wait_for_timeout(600)
        page.screenshot(path=OUT / "phase1_03_da_luu_co_phan_khuc.png")

        # 4) Trang chi tiết máy mới phải có "Máy tương tự" (máy đã vào catalog gợi ý)
        page.goto(f"{BASE}/laptops")
        page.wait_for_timeout(800)
        page.get_by_placeholder("Ví dụ: Legion, ThinkPad...").fill("Test Giai doan 1")
        page.wait_for_timeout(800)
        page.get_by_text("Test Giai doan 1").first.click()
        page.wait_for_url("**/laptop/**", timeout=10000)
        page.wait_for_timeout(1200)
        page.screenshot(path=OUT / "phase1_04_chi_tiet_co_may_tuong_tu.png", full_page=True)

        browser.close()
        print(f"Đã lưu ảnh phase1_* vào {OUT} (SKU test: {SKU})")


if __name__ == "__main__":
    main()
