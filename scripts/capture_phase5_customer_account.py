"""Kiểm thử Giai đoạn 5 trên browser thật: UC-07/UC-08 (tài khoản khách hàng).
Các bước: đăng ký và tự đăng nhập, yêu thích/bỏ yêu thích một máy, tư vấn rồi xem lại ở Lịch sử, đăng xuất,
và khách hàng không vào được khu /admin.
Chạy khi backend :4000, frontend :5180, ml-service :8001 đang chạy. Mỗi lần chạy tạo một tài khoản test mới
(email theo timestamp) và không xóa, giống quy ước phase1.
"""
from datetime import datetime
from pathlib import Path

from playwright.sync_api import sync_playwright

BASE = "http://localhost:5180"
OUT = Path(__file__).resolve().parent.parent / "crud_test_screenshots"
OUT.mkdir(exist_ok=True)


def main():
    email = f"phase5.{datetime.now().strftime('%Y%m%d%H%M%S')}@example.com"
    full_name = "Khach Kiem Thu Giai Doan 5"

    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": 1400, "height": 1000})

        # 1. Chưa đăng nhập
        page.goto(f"{BASE}/")
        page.wait_for_timeout(600)
        assert page.get_by_text("Đăng nhập", exact=True).count() > 0, "Khong thay nut Dang nhap khi chua dang nhap"
        print("OK: TopNav hiện nút Đăng nhập khi chưa đăng nhập")

        # 2. Đăng ký
        page.get_by_text("Đăng nhập", exact=True).click()
        page.wait_for_url(lambda url: "/login" in url, timeout=10000)
        page.get_by_text("Tạo tài khoản", exact=True).click()
        page.wait_for_timeout(300)
        # antd Tabs giữ cả 2 tabpanel trong DOM; phải giới hạn locator vào tabpanel đang hiện để tránh "strict mode violation".
        panel = page.get_by_role("tabpanel", name="Tạo tài khoản")
        panel.locator("#fullName").fill(full_name)
        panel.locator("#email").fill(email)
        panel.locator("#password").fill("Demo@123")
        panel.get_by_role("button", name="Tạo tài khoản").click()
        page.wait_for_timeout(1200)
        body_text = page.inner_text("body")
        assert full_name in body_text, "TopNav chua hien ten sau khi dang ky"
        print("OK: đăng ký xong tự đăng nhập, TopNav hiện tên")
        page.screenshot(path=OUT / "phase5_01_da_dang_nhap.png")

        # 3. Yêu thích 1 máy
        page.goto(f"{BASE}/laptops")
        page.wait_for_timeout(1000)
        page.locator(".ant-card", has_text="₫").first.click()
        page.wait_for_url(lambda url: "/laptop/" in url, timeout=10000)
        page.wait_for_timeout(800)
        laptop_name = page.locator("h1").inner_text()
        page.locator("button.ant-btn-circle").first.click()
        page.wait_for_timeout(600)
        page.screenshot(path=OUT / "phase5_02_da_yeu_thich.png")

        page.goto(f"{BASE}/favorites")
        page.wait_for_timeout(1000)
        body_text = page.inner_text("body")
        assert laptop_name in body_text, f"Khong thay '{laptop_name}' trong danh sach yeu thich"
        print("OK: máy vừa yêu thích xuất hiện trong /favorites")
        page.screenshot(path=OUT / "phase5_03_danh_sach_yeu_thich.png")

        # 4. Bỏ yêu thích
        page.get_by_text("Bỏ thích", exact=True).click()
        page.wait_for_timeout(600)
        body_text = page.inner_text("body")
        assert "Chưa có máy nào" in body_text, "Bo yeu thich khong hoat dong"
        print("OK: bỏ yêu thích thành công, danh sách rỗng lại")

        # 5. Tư vấn rồi xem lịch sử
        page.goto(f"{BASE}/wizard")
        page.wait_for_timeout(500)
        page.get_by_role("group").get_by_text("Chơi game", exact=True).click()
        page.get_by_text("25–40 tr", exact=True).click()
        page.get_by_text("Xem kết quả", exact=True).click()
        page.wait_for_url(lambda url: "/results" in url, timeout=10000)
        page.wait_for_timeout(1000)

        page.goto(f"{BASE}/history")
        page.wait_for_timeout(1000)
        body_text = page.inner_text("body")
        assert "Gaming" in body_text, "Khong thay phien tu van vua tao trong lich su"
        print("OK: phiên tư vấn vừa tạo xuất hiện trong Lịch sử")
        page.screenshot(path=OUT / "phase5_04_lich_su_tu_van.png", full_page=True)
        page.locator(".ant-card").first.click()
        page.wait_for_url(lambda url: "/results" in url, timeout=10000)
        page.wait_for_timeout(800)
        print("OK: xem lại được phiên cũ từ Lịch sử")
        page.screenshot(path=OUT / "phase5_05_xem_lai_phien_cu.png", full_page=True)

        # 6. Đăng xuất
        page.goto(f"{BASE}/")
        page.wait_for_timeout(500)
        page.get_by_text(full_name).click()
        page.get_by_text("Đăng xuất", exact=True).click()
        page.wait_for_timeout(600)
        body_text = page.inner_text("body")
        assert "Đăng nhập" in body_text, "Dang xuat khong thanh cong"
        print("OK: đăng xuất thành công")

        page.goto(f"{BASE}/favorites")
        page.wait_for_timeout(500)
        body_text = page.inner_text("body")
        assert "Đăng nhập để xem danh sách yêu thích" in body_text, "Trang /favorites khong yeu cau dang nhap dung cach"
        print("OK: /favorites yêu cầu đăng nhập sau khi đã đăng xuất")

        # 7. Không lọt qua được khu quản trị
        page.goto(f"{BASE}/admin/laptops")
        page.wait_for_timeout(800)
        assert "/admin/login" in page.url, f"Khach hang (da dang xuat) khong bi chan khoi /admin/laptops, dang o {page.url}"
        print("OK: /admin/laptops chuyển hướng về /admin/login khi chưa đăng nhập quản trị")

        browser.close()
        print(f"\nHoàn tất kiểm thử Giai đoạn 5. Tài khoản test: {email}")


if __name__ == "__main__":
    main()
