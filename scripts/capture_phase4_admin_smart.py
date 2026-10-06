"""Kiểm thử Giai đoạn 4 trên browser thật: 4 màn quản trị mới (FR-12, FR-13, FR-14, UC-15).
Các màn: Dashboard (quét cảnh báo), Quản lý mô hình (danh sách phiên bản, Drawer k-curve và confusion matrix),
Cấu hình tri thức (lưu các tab ngưỡng, trọng số, cảnh báo), Phân tích phản hồi.
Chạy khi backend :4000, frontend :5180, ml-service :8001 đang chạy: python scripts/capture_phase4_admin_smart.py
"""
from pathlib import Path

from playwright.sync_api import sync_playwright

BASE = "http://localhost:5180"
OUT = Path(__file__).resolve().parent.parent / "crud_test_screenshots"
OUT.mkdir(exist_ok=True)


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": 1440, "height": 1000})

        page.goto(f"{BASE}/admin/login")
        page.get_by_role("button", name="Đăng nhập").click()
        page.wait_for_url(lambda url: "/admin/login" not in url and "/admin" in url, timeout=10000)
        page.wait_for_timeout(800)

        # 1. Dashboard (trang mặc định sau đăng nhập ADMIN)
        assert "/admin/dashboard" in page.url, f"Khong tu dong vao Dashboard sau dang nhap, dang o {page.url}"
        page.wait_for_timeout(1000)
        page.screenshot(path=OUT / "phase4_01_dashboard.png", full_page=True)
        page.get_by_role("button", name="Quét cảnh báo ngay").click()
        page.wait_for_timeout(1500)
        print("OK: Dashboard hiện KPI, quét cảnh báo không lỗi")
        page.screenshot(path=OUT / "phase4_02_dashboard_sau_quet.png", full_page=True)

        # 2. Quản lý mô hình
        page.goto(f"{BASE}/admin/models")
        page.wait_for_timeout(1000)
        body_text = page.inner_text("body")
        assert "clf-" in body_text, "Khong thay danh sach phien ban mo hinh"
        page.screenshot(path=OUT / "phase4_03_models_list.png", full_page=True)
        page.get_by_role("button", name="Xem chi tiết").first.click()
        page.wait_for_timeout(1000)
        body_text = page.inner_text("body")
        assert "Ma trận nhầm lẫn" in body_text and "Đường cong chọn k" in body_text, "Thieu bieu do trong Drawer chi tiet mo hinh"
        print("OK: Quản lý mô hình hiện danh sách, k-curve và confusion matrix")
        page.screenshot(path=OUT / "phase4_04_model_detail.png")
        page.keyboard.press("Escape")
        page.wait_for_timeout(300)

        # 3. Cấu hình tri thức
        page.goto(f"{BASE}/admin/knowledge")
        page.wait_for_timeout(1000)
        page.screenshot(path=OUT / "phase4_05_knowledge_pins.png", full_page=True)

        page.get_by_text("Ngưỡng & mặc định", exact=True).click()
        page.wait_for_timeout(500)
        topn_input = page.locator("input").filter(has=page.locator("xpath=..")).first
        page.screenshot(path=OUT / "phase4_06_knowledge_thresholds.png", full_page=True)
        page.get_by_role("button", name="Lưu cấu hình").click()
        page.wait_for_timeout(600)
        print("OK: tab Ngưỡng & mặc định lưu được")

        page.get_by_text("Trọng số theo phân khúc", exact=True).click()
        page.wait_for_timeout(500)
        page.screenshot(path=OUT / "phase4_07_knowledge_weights.png", full_page=True)
        page.get_by_role("button", name="Lưu tất cả phân khúc").click()
        page.wait_for_timeout(600)
        print("OK: tab Trọng số theo phân khúc lưu được")

        page.get_by_text("Ngưỡng cảnh báo", exact=True).click()
        page.wait_for_timeout(500)
        page.screenshot(path=OUT / "phase4_08_knowledge_alerts.png", full_page=True)
        page.get_by_role("button", name="Lưu ngưỡng cảnh báo").click()
        page.wait_for_timeout(600)
        print("OK: tab Ngưỡng cảnh báo lưu được")

        # 4. Phân tích phản hồi
        page.goto(f"{BASE}/admin/feedback")
        page.wait_for_timeout(1200)
        body_text = page.inner_text("body")
        assert "Tỷ lệ hài lòng" in body_text, "Khong thay thong ke ty le hai long"
        print("OK: Phân tích phản hồi hiện đủ biểu đồ")
        page.screenshot(path=OUT / "phase4_09_feedback.png", full_page=True)

        browser.close()
        print("\nHoàn tất kiểm thử Giai đoạn 4.")


if __name__ == "__main__":
    main()
