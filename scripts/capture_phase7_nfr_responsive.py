"""Kiểm thử Giai đoạn 7 trên browser thật: kiểm chứng NFR-04 (responsive 375px đến 1920px).
Kiểm tra không tràn ngang (scrollWidth <= clientWidth) ở 375px (các trang khách hàng và quản trị, đăng nhập ADMIN)
và 1920px (Home, Catalog, Dashboard). Kịch bản này từng phát hiện 6 lỗi tràn ngang (TopNav, Segmented, Pagination,
Card grid quản trị, Space inline-flex trong 2 form, min-width mặc định của grid-item trong RecommendationCard).
Chạy khi backend :4000, frontend :5180, ml-service :8001 đang chạy: python scripts/capture_phase7_nfr_responsive.py
"""
from pathlib import Path

from playwright.sync_api import sync_playwright

BASE = "http://localhost:5180"
OUT = Path(__file__).resolve().parent.parent / "crud_test_screenshots"
OUT.mkdir(exist_ok=True)


def check_no_overflow(page, label):
    page.wait_for_timeout(500)
    sw = page.evaluate("document.documentElement.scrollWidth")
    cw = page.evaluate("document.documentElement.clientWidth")
    status = "OK" if sw <= cw + 1 else "LOI"
    print(f"{status}: {label} - scrollWidth={sw} clientWidth={cw}")
    assert sw <= cw + 1, f"{label}: tran ngang ({sw} > {cw})"


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch()

        # 375px: khách hàng
        page = browser.new_page(viewport={"width": 375, "height": 812})
        page.goto(f"{BASE}/")
        check_no_overflow(page, "375px /")
        page.screenshot(path=OUT / "phase7_01_mobile_home.png")

        page.goto(f"{BASE}/laptops")
        check_no_overflow(page, "375px /laptops")
        page.screenshot(path=OUT / "phase7_02_mobile_catalog.png")

        page.goto(f"{BASE}/wizard")
        check_no_overflow(page, "375px /wizard")

        page.get_by_text("Chơi game", exact=True).click()
        page.get_by_text("25–40 tr", exact=True).click()
        page.get_by_text("Xem kết quả", exact=True).click()
        page.wait_for_url(lambda url: "/results" in url, timeout=10000)
        check_no_overflow(page, "375px /results (co du lieu)")
        page.screenshot(path=OUT / "phase7_03_mobile_results.png", full_page=True)

        page.get_by_text("Chi tiết", exact=True).first.click()
        page.wait_for_timeout(500)
        check_no_overflow(page, "375px /laptop/:id")

        page.goto(f"{BASE}/login")
        check_no_overflow(page, "375px /login")

        page.goto(f"{BASE}/compare")
        check_no_overflow(page, "375px /compare")

        # 375px: quản trị (đăng nhập ADMIN)
        page.goto(f"{BASE}/admin/login")
        page.get_by_role("button", name="Đăng nhập").click()
        page.wait_for_url(lambda url: "/admin/login" not in url and "/admin" in url, timeout=10000)
        check_no_overflow(page, "375px /admin/dashboard")
        page.screenshot(path=OUT / "phase7_04_mobile_admin_dashboard.png")

        for path, label in [
            ("/admin/models", "Quản lý mô hình"),
            ("/admin/knowledge", "Cấu hình tri thức"),
            ("/admin/users", "Người dùng & nhật ký"),
            ("/admin/feedback", "Phân tích phản hồi"),
            ("/admin/review-queue", "Duyệt nhãn"),
            ("/admin/laptops", "Laptop"),
            ("/admin/prices", "Quản lý giá"),
        ]:
            page.goto(f"{BASE}{path}")
            check_no_overflow(page, f"375px {path} ({label})")

        page.goto(f"{BASE}/admin/knowledge")
        page.wait_for_timeout(500)
        for tab in ["Ngưỡng & mặc định", "Trọng số theo phân khúc", "Ngưỡng cảnh báo"]:
            page.get_by_text(tab, exact=True).click()
            check_no_overflow(page, f"375px /admin/knowledge tab '{tab}'")
        page.screenshot(path=OUT / "phase7_05_mobile_admin_weights_tab.png")

        page.close()

        # 1920px
        page2 = browser.new_page(viewport={"width": 1920, "height": 1080})
        page2.goto(f"{BASE}/")
        check_no_overflow(page2, "1920px /")
        page2.goto(f"{BASE}/laptops")
        check_no_overflow(page2, "1920px /laptops")
        page2.screenshot(path=OUT / "phase7_06_desktop_1920_catalog.png")

        page2.goto(f"{BASE}/admin/login")
        page2.get_by_role("button", name="Đăng nhập").click()
        page2.wait_for_url(lambda url: "/admin/login" not in url and "/admin" in url, timeout=10000)
        check_no_overflow(page2, "1920px /admin/dashboard")
        page2.screenshot(path=OUT / "phase7_07_desktop_1920_admin_dashboard.png")

        page2.close()
        browser.close()
        print("\nHoàn tất kiểm thử Giai đoạn 7 - NFR-04 (responsive 375px-1920px).")


if __name__ == "__main__":
    main()
