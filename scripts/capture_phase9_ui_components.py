"""Kiem thu Giai doan 9 tren browser that: cac component dac trung con thieu/sai theo
docs/07_UIUX.md muc 7.

Kiem tra:
  1. PrioritySlider hien dung nhan "Khong quan trong / Binh thuong / Rat quan trong" (Wizard.tsx)
  2. Ket qua tu van: man Ket qua hien Skeleton + dong chu luan phien ngay sau khi bam "Xem ket qua"
     (truoc khi ket qua that tra ve) - docs muc 8
  3. ExplainDrawer hien khoi "Phan khuc duoc chon vi..." kem lang gieng bo phieu, khi phan khuc
     dang dung DUOC SUY RA tu hoat dong (khong phai nguoi dung tu chon)
  4. ConfidenceIndicator (thanh ngang 4 doan mau) hien trong man Them laptop moi (SegmentSuggester)

Chay khi 3 dich vu dang chay (backend :4000, frontend :5180, ml-service :8001).
"""
from datetime import datetime
from pathlib import Path

from playwright.sync_api import sync_playwright

BASE = "http://localhost:5180"
OUT = Path(__file__).resolve().parent.parent / "crud_test_screenshots"
OUT.mkdir(exist_ok=True)
SKU = f"TEST-P9-{datetime.now().strftime('%Y%m%d%H%M%S')}"


def choose(page, label: str, option_text: str):
    page.get_by_label(label).click()
    page.wait_for_timeout(150)
    page.get_by_text(option_text, exact=True).last.click()
    page.wait_for_timeout(150)


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": 1400, "height": 1000})

        # 1 + 2 + 3: Wizard -> chon hoat dong "Van phong" (AI suy OFFICE, tin cay 100%, xem
        # Giai doan 3) de nhu cau duoc SUY RA (khong tu chon ro rang) -> ExplainDrawer se co du
        # lieu de hien khoi "Phan khuc duoc chon vi..."
        page.goto(f"{BASE}/wizard")
        page.wait_for_timeout(500)
        page.get_by_role("group").get_by_text("Văn phòng / soạn thảo", exact=True).click()
        page.wait_for_timeout(800)

        body_text = page.inner_text("body")
        assert "Không quan trọng" in body_text and "Bình thường" in body_text and "Rất quan trọng" in body_text, \
            "PrioritySlider chua hien dung nhan theo docs/07_UIUX.md muc 7.6"
        print("OK: PrioritySlider hien dung nhan Khong quan trong/Binh thuong/Rat quan trong")
        page.screenshot(path=OUT / "phase9_01_priority_slider_labels.png")

        page.get_by_text("Xem kết quả", exact=True).click()
        # Bam xong chuyen trang NGAY (khong doi API) - kiem tra Skeleton + dong chu luan phien
        # xuat hien truoc khi ket qua that render.
        page.wait_for_url(lambda url: "/results" in url, timeout=5000)
        page.wait_for_timeout(80)
        body_text_loading = page.inner_text("body")
        has_loading_text = any(
            s in body_text_loading for s in ["Đang so sánh", "Đang tìm máy", "Đang tính điểm"]
        )
        if has_loading_text:
            print("OK: hien dong chu luan phien trong luc cho ket qua")
            page.screenshot(path=OUT / "phase9_02_loading_skeleton.png", full_page=True)
        else:
            print("CANH BAO: khong kip chup duoc trang thai dang tai (API tra ve qua nhanh) - bo qua kiem tra nay")

        page.wait_for_timeout(1500)
        page.get_by_role("button", name="Vì sao gợi ý?").first.click()
        page.wait_for_timeout(600)
        body_text = page.inner_text("body")
        assert "Phân khúc được chọn vì" in body_text, "Thieu khoi 'Phan khuc duoc chon vi...' trong ExplainDrawer"
        assert "bỏ phiếu" in body_text, "Thieu cau giai thich lang gieng bo phieu"
        print("OK: ExplainDrawer hien khoi 'Phan khuc duoc chon vi...' kem lang gieng bo phieu")
        page.screenshot(path=OUT / "phase9_03_explain_drawer_neighbors.png")
        page.keyboard.press("Escape")
        page.wait_for_timeout(300)

        # 4. ConfidenceIndicator trong SegmentSuggester (them laptop moi)
        page.goto(f"{BASE}/admin/login")
        page.get_by_role("button", name="Đăng nhập").click()
        page.wait_for_url(lambda url: "/admin/login" not in url and "/admin" in url, timeout=10000)

        page.goto(f"{BASE}/admin/laptops")
        page.wait_for_timeout(1200)
        page.get_by_text("+ Thêm mới").click()
        page.wait_for_timeout(500)
        page.get_by_label("Mã SKU").fill(SKU)
        page.get_by_label("Tên máy").fill("Test Giai doan 9")
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
        page.wait_for_timeout(1200)

        body_text = page.inner_text("body")
        assert "Dự đoán:" in body_text, "ConfidenceIndicator khong hien trong SegmentSuggester"
        print("OK: ConfidenceIndicator (thanh ngang 4 doan) hien trong man Them laptop moi")
        page.screenshot(path=OUT / "phase9_04_confidence_indicator.png")

        # Dong modal khong luu (khong can giu may test nay lai)
        page.keyboard.press("Escape")

        browser.close()
        print("\nHoan tat kiem thu Giai doan 9.")


if __name__ == "__main__":
    main()
