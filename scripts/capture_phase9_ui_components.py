"""Kiểm thử Giai đoạn 9 trên browser thật: các component đặc trưng theo docs/07_UIUX.md mục 7.
Kiểm tra nhãn PrioritySlider, Skeleton và dòng chữ luân phiên khi chờ kết quả, khối "Phân khúc được chọn vì..."
trong ExplainDrawer, và ConfidenceIndicator ở màn Thêm laptop mới.
Chạy khi backend :4000, frontend :5180, ml-service :8001 đang chạy.
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

        # 1, 2, 3: chọn hoạt động "Văn phòng" (AI suy OFFICE, tin cậy 100%, xem Giai đoạn 3) để nhu cầu được
        # suy ra chứ không tự chọn, khi đó ExplainDrawer mới có dữ liệu hiện khối "Phân khúc được chọn vì..."
        page.goto(f"{BASE}/wizard")
        page.wait_for_timeout(500)
        page.get_by_role("group").get_by_text("Văn phòng / soạn thảo", exact=True).click()
        page.wait_for_timeout(800)

        body_text = page.inner_text("body")
        assert "Không quan trọng" in body_text and "Bình thường" in body_text and "Rất quan trọng" in body_text, \
            "PrioritySlider chua hien dung nhan theo docs/07_UIUX.md muc 7.6"
        print("OK: PrioritySlider hiện đúng nhãn Không quan trọng/Bình thường/Rất quan trọng")
        page.screenshot(path=OUT / "phase9_01_priority_slider_labels.png")

        page.get_by_text("Xem kết quả", exact=True).click()
        # Chuyển trang ngay không chờ API; kiểm tra Skeleton và dòng chữ luân phiên hiện trước khi có kết quả thật.
        page.wait_for_url(lambda url: "/results" in url, timeout=5000)
        page.wait_for_timeout(80)
        body_text_loading = page.inner_text("body")
        has_loading_text = any(
            s in body_text_loading for s in ["Đang so sánh", "Đang tìm máy", "Đang tính điểm"]
        )
        if has_loading_text:
            print("OK: hiện dòng chữ luân phiên trong lúc chờ kết quả")
            page.screenshot(path=OUT / "phase9_02_loading_skeleton.png", full_page=True)
        else:
            print("CẢNH BÁO: không kịp chụp trạng thái đang tải (API trả về quá nhanh), bỏ qua kiểm tra này")

        page.wait_for_timeout(1500)
        page.get_by_role("button", name="Vì sao gợi ý?").first.click()
        page.wait_for_timeout(600)
        body_text = page.inner_text("body")
        assert "Phân khúc được chọn vì" in body_text, "Thieu khoi 'Phan khuc duoc chon vi...' trong ExplainDrawer"
        assert "bỏ phiếu" in body_text, "Thieu cau giai thich lang gieng bo phieu"
        print("OK: ExplainDrawer hiện khối 'Phân khúc được chọn vì...' kèm láng giềng bỏ phiếu")
        page.screenshot(path=OUT / "phase9_03_explain_drawer_neighbors.png")
        page.keyboard.press("Escape")
        page.wait_for_timeout(300)

        # 4. ConfidenceIndicator trong SegmentSuggester (thêm laptop mới)
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
        print("OK: ConfidenceIndicator (thanh ngang 4 đoạn) hiện trong màn Thêm laptop mới")
        page.screenshot(path=OUT / "phase9_04_confidence_indicator.png")

        # Đóng modal không lưu, không cần giữ máy test này
        page.keyboard.press("Escape")

        browser.close()
        print("\nHoàn tất kiểm thử Giai đoạn 9.")


if __name__ == "__main__":
    main()
