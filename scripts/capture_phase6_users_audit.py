"""Kiem thu Giai doan 6 tren browser that: UC-16 (Quan ly nguoi dung, nhat ky).

Kiem tra:
  1. Man /admin/users hien 2 tab, tab "Tai khoan noi bo" hien danh sach + tao moi thanh cong
  2. Doi vai tro / khoa tai khoan vua tao qua Select/Switch tren bang
  3. Tai khoan ADMIN dang dang nhap KHONG sua duoc chinh minh (Select/Switch dong o dong do)
  4. Tab "Nhat ky he thong" hien cac hanh dong vua thuc hien (tao/sua tai khoan)

Chay khi 3 dich vu dang chay (backend :4000, frontend :5180, ml-service :8001).
"""
from datetime import datetime
from pathlib import Path

from playwright.sync_api import sync_playwright

BASE = "http://localhost:5180"
OUT = Path(__file__).resolve().parent.parent / "crud_test_screenshots"
OUT.mkdir(exist_ok=True)


def main():
    email = f"phase6.staff.{datetime.now().strftime('%Y%m%d%H%M%S')}@smartlap.vn"

    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": 1400, "height": 1000})

        page.goto(f"{BASE}/admin/login")
        page.get_by_role("button", name="Đăng nhập").click()
        page.wait_for_url(lambda url: "/admin/login" not in url and "/admin" in url, timeout=10000)
        page.wait_for_timeout(800)

        page.goto(f"{BASE}/admin/users")
        page.wait_for_timeout(1000)
        body_text = page.inner_text("body")
        assert "Tài khoản nội bộ" in body_text and "Nhật ký hệ thống" in body_text
        page.screenshot(path=OUT / "phase6_01_users_list.png", full_page=True)

        # 1. Tao tai khoan moi
        page.get_by_role("button", name="Thêm tài khoản").click()
        page.wait_for_timeout(400)
        page.locator("#fullName").fill("Nhan Vien Kiem Thu Giai Doan 6")
        page.locator("#email").fill(email)
        page.locator("#password").fill("Demo@123")
        page.get_by_role("button", name="Tạo", exact=True).click()
        page.wait_for_timeout(1000)
        body_text = page.inner_text("body")
        assert email in body_text, "Khong thay tai khoan vua tao trong danh sach"
        print("OK: tao tai khoan moi thanh cong")
        page.screenshot(path=OUT / "phase6_02_da_tao_tai_khoan.png", full_page=True)

        # 2. Doi vai tro
        row = page.locator("tr", has_text=email)
        row.scroll_into_view_if_needed()
        page.wait_for_timeout(300)
        # antd v5 (ban moi) dung class "ant-select-content" thay vi "ant-select-selector".
        row.locator(".ant-select").click()
        page.wait_for_timeout(500)
        page.locator(".ant-select-item-option", has_text="Quản trị").click()
        page.wait_for_timeout(600)
        print("OK: doi vai tro khong loi")

        # 3. Khoa tai khoan (Switch)
        row.locator(".ant-switch").click()
        page.wait_for_timeout(600)
        print("OK: khoa tai khoan khong loi")
        page.screenshot(path=OUT / "phase6_03_sau_khi_sua.png", full_page=True)

        # 4. Kiem tra dong ADMIN dang dang nhap bi khoa sua (disabled)
        admin_row = page.locator("tr", has_text="admin@smartlap.vn")
        assert admin_row.locator(".ant-switch.ant-switch-disabled").count() == 1, "Dong ADMIN dang dang nhap phai bi khoa khong cho tu sua"
        print("OK: khong the tu sua chinh tai khoan dang dang nhap")

        # 5. Nhat ky he thong
        page.get_by_text("Nhật ký hệ thống", exact=True).click()
        page.wait_for_timeout(800)
        body_text = page.inner_text("body")
        assert "Tạo tài khoản" in body_text and "Sửa tài khoản" in body_text, "Khong thay cac hanh dong vua lam trong nhat ky"
        print("OK: nhat ky he thong hien du cac hanh dong")
        page.screenshot(path=OUT / "phase6_04_audit_log.png", full_page=True)

        browser.close()
        print(f"\nHoan tat kiem thu Giai doan 6. Tai khoan test: {email}")


if __name__ == "__main__":
    main()
