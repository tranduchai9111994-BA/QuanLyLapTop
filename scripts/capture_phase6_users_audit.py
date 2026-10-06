"""Kiểm thử Giai đoạn 6 trên browser thật: UC-16 (quản lý người dùng, nhật ký).
Các bước: tạo tài khoản mới ở tab "Tài khoản nội bộ", đổi vai trò và khóa tài khoản, kiểm tra ADMIN đang đăng nhập
không tự sửa được mình, rồi xem tab "Nhật ký hệ thống".
Chạy khi backend :4000, frontend :5180, ml-service :8001 đang chạy.
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

        # 1. Tạo tài khoản mới
        page.get_by_role("button", name="Thêm tài khoản").click()
        page.wait_for_timeout(400)
        page.locator("#fullName").fill("Nhan Vien Kiem Thu Giai Doan 6")
        page.locator("#email").fill(email)
        page.locator("#password").fill("Demo@123")
        page.get_by_role("button", name="Tạo", exact=True).click()
        page.wait_for_timeout(1000)
        body_text = page.inner_text("body")
        assert email in body_text, "Khong thay tai khoan vua tao trong danh sach"
        print("OK: tạo tài khoản mới thành công")
        page.screenshot(path=OUT / "phase6_02_da_tao_tai_khoan.png", full_page=True)

        # 2. Đổi vai trò
        row = page.locator("tr", has_text=email)
        row.scroll_into_view_if_needed()
        page.wait_for_timeout(300)
        # antd v5 bản mới dùng class "ant-select-content" thay cho "ant-select-selector".
        row.locator(".ant-select").click()
        page.wait_for_timeout(500)
        page.locator(".ant-select-item-option", has_text="Quản trị").click()
        page.wait_for_timeout(600)
        print("OK: đổi vai trò không lỗi")

        # 3. Khóa tài khoản (Switch)
        row.locator(".ant-switch").click()
        page.wait_for_timeout(600)
        print("OK: khóa tài khoản không lỗi")
        page.screenshot(path=OUT / "phase6_03_sau_khi_sua.png", full_page=True)

        # 4. Dòng ADMIN đang đăng nhập phải bị khóa sửa (disabled)
        admin_row = page.locator("tr", has_text="admin@smartlap.vn")
        assert admin_row.locator(".ant-switch.ant-switch-disabled").count() == 1, "Dong ADMIN dang dang nhap phai bi khoa khong cho tu sua"
        print("OK: không thể tự sửa chính tài khoản đang đăng nhập")

        # 5. Nhật ký hệ thống
        page.get_by_text("Nhật ký hệ thống", exact=True).click()
        page.wait_for_timeout(800)
        body_text = page.inner_text("body")
        assert "Tạo tài khoản" in body_text and "Sửa tài khoản" in body_text, "Khong thay cac hanh dong vua lam trong nhat ky"
        print("OK: nhật ký hệ thống hiện đủ các hành động")
        page.screenshot(path=OUT / "phase6_04_audit_log.png", full_page=True)

        browser.close()
        print(f"\nHoàn tất kiểm thử Giai đoạn 6. Tài khoản test: {email}")


if __name__ == "__main__":
    main()
