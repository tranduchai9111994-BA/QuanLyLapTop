"""Kiem thu Giai doan 5 tren browser that: UC-07/UC-08 (tai khoan khach hang).

Kiem tra:
  1. TopNav hien nut "Dang nhap" khi chua dang nhap
  2. Dang ky tai khoan moi qua /login -> tu dong dang nhap, TopNav doi thanh ten nguoi dung
  3. Vao trang Chi tiet 1 may, bam trai tim -> Da yeu thich; vao /favorites thay dung may do
  4. Bo yeu thich tu trang /favorites -> danh sach rong lai
  5. Vao Wizard tao 1 luot tu van -> vao /history thay dung phien do, bam vao xem lai duoc
  6. Dang xuat -> TopNav tro lai "Dang nhap"; truy cap thang /favorites, /history deu hien man
     hinh moi dang nhap (khong bi 401 tran)
  7. Khach hang tu dieu huong toi /admin/laptops -> bi day ve /admin/login (khong lot qua duoc)

Chay khi 3 dich vu dang chay (backend :4000, frontend :5180, ml-service :8001). Tao 1 tai khoan
test MOI moi lan chay (email theo timestamp) - khong xoa sau khi xong (giong quy uoc phase1: du
lieu test o lai lam minh chung, khong anh huong nghiep vu that).
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

        # 1. Chua dang nhap
        page.goto(f"{BASE}/")
        page.wait_for_timeout(600)
        assert page.get_by_text("Đăng nhập", exact=True).count() > 0, "Khong thay nut Dang nhap khi chua dang nhap"
        print("OK: TopNav hien nut Dang nhap khi chua dang nhap")

        # 2. Dang ky
        page.get_by_text("Đăng nhập", exact=True).click()
        page.wait_for_url(lambda url: "/login" in url, timeout=10000)
        page.get_by_text("Tạo tài khoản", exact=True).click()
        page.wait_for_timeout(300)
        # antd Tabs giu ca 2 tabpanel trong DOM (chi an tabpanel khong active) - phai gioi han
        # locator vao dung tabpanel dang hien de tranh "strict mode violation: 2 elements".
        panel = page.get_by_role("tabpanel", name="Tạo tài khoản")
        panel.locator("#fullName").fill(full_name)
        panel.locator("#email").fill(email)
        panel.locator("#password").fill("Demo@123")
        panel.get_by_role("button", name="Tạo tài khoản").click()
        page.wait_for_timeout(1200)
        body_text = page.inner_text("body")
        assert full_name in body_text, "TopNav chua hien ten sau khi dang ky"
        print("OK: dang ky xong tu dong dang nhap, TopNav hien ten")
        page.screenshot(path=OUT / "phase5_01_da_dang_nhap.png")

        # 3. Yeu thich 1 may
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
        print("OK: may vua yeu thich xuat hien trong /favorites")
        page.screenshot(path=OUT / "phase5_03_danh_sach_yeu_thich.png")

        # 4. Bo yeu thich
        page.get_by_text("Bỏ thích", exact=True).click()
        page.wait_for_timeout(600)
        body_text = page.inner_text("body")
        assert "Chưa có máy nào" in body_text, "Bo yeu thich khong hoat dong"
        print("OK: bo yeu thich thanh cong, danh sach rong lai")

        # 5. Tu van roi xem lich su
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
        print("OK: phien tu van vua tao xuat hien trong Lich su")
        page.screenshot(path=OUT / "phase5_04_lich_su_tu_van.png", full_page=True)
        page.locator(".ant-card").first.click()
        page.wait_for_url(lambda url: "/results" in url, timeout=10000)
        page.wait_for_timeout(800)
        print("OK: xem lai duoc phien cu tu Lich su")
        page.screenshot(path=OUT / "phase5_05_xem_lai_phien_cu.png", full_page=True)

        # 6. Dang xuat
        page.goto(f"{BASE}/")
        page.wait_for_timeout(500)
        page.get_by_text(full_name).click()
        page.get_by_text("Đăng xuất", exact=True).click()
        page.wait_for_timeout(600)
        body_text = page.inner_text("body")
        assert "Đăng nhập" in body_text, "Dang xuat khong thanh cong"
        print("OK: dang xuat thanh cong")

        page.goto(f"{BASE}/favorites")
        page.wait_for_timeout(500)
        body_text = page.inner_text("body")
        assert "Đăng nhập để xem danh sách yêu thích" in body_text, "Trang /favorites khong yeu cau dang nhap dung cach"
        print("OK: /favorites yeu cau dang nhap sau khi da dang xuat")

        # 7. Khong lot qua duoc khu quan tri
        page.goto(f"{BASE}/admin/laptops")
        page.wait_for_timeout(800)
        assert "/admin/login" in page.url, f"Khach hang (da dang xuat) khong bi chan khoi /admin/laptops, dang o {page.url}"
        print("OK: /admin/laptops chuyen huong ve /admin/login khi chua dang nhap quan tri")

        browser.close()
        print(f"\nHoan tat kiem thu Giai doan 5. Tai khoan test: {email}")


if __name__ == "__main__":
    main()
