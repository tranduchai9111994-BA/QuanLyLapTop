"""Kiem thu Giai doan 10 tren browser that: bo cuc lon theo docs/07_UIUX.md.

Kiem tra:
  1. TopNav hien icon "♡" yeu thich luon co mat; sau khi bam "+ So sanh" o 2 the ket qua, link
     "So sanh (2)" xuat hien tren TopNav (danh sach so sanh dung chung toan app, con nguyen khi
     chuyen trang - khong con la state cuc bo cua Results.tsx)
  2. Sidebar quan tri nhom thanh 4 nhom co ten ("Tổng quan", "Dữ liệu", "✨ Trí tuệ", "Hệ thống"),
     nut thu gon hoat dong (Sider co the thu xuong 72px)
  3. Man Ket qua tu van hien luoi 2 cot + panel radar dinh ben phai o man rong (>=992px); panel
     doi dung sang may vua bam "Vi sao goi y?" va GIU NGUYEN sau khi dong Drawer (khong tro ve
     may #1 ngay lap tuc)

Chay khi 3 dich vu dang chay (backend :4000, frontend :5180, ml-service :8001).
"""
from pathlib import Path

from playwright.sync_api import sync_playwright

BASE = "http://localhost:5180"
OUT = Path(__file__).resolve().parent.parent / "crud_test_screenshots"
OUT.mkdir(exist_ok=True)


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": 1400, "height": 1000})

        # ---- 1. TopNav: heart luon co, "So sanh (N)" xuat hien sau khi chon 2 may ----
        page.goto(f"{BASE}/wizard")
        page.wait_for_timeout(500)
        body_text = page.inner_text("body")
        # Kiem tra co it nhat 1 link toi /favorites tren thanh nav (icon tim)
        assert page.locator('a[href="/favorites"]').count() > 0, "Thieu icon yeu thich (♡) tren TopNav"
        print("OK: TopNav luon co icon yeu thich")

        page.get_by_role("group").get_by_text("Chơi game", exact=True).click()
        page.get_by_text("25–40 tr", exact=True).click()
        page.get_by_text("Xem kết quả", exact=True).click()
        page.wait_for_url(lambda url: "/results" in url, timeout=10000)
        page.wait_for_timeout(1500)

        page.get_by_text("+ So sánh", exact=True).first.click()
        page.wait_for_timeout(200)
        page.get_by_text("+ So sánh", exact=True).first.click()
        page.wait_for_timeout(400)
        body_text = page.inner_text("body")
        assert "So sánh (2)" in body_text, "TopNav chua hien 'So sanh (2)' sau khi chon 2 may"
        print("OK: TopNav hien 'So sanh (2)' sau khi chon may o Ket qua")
        page.screenshot(path=OUT / "phase10_01_topnav_compare_favorite.png")

        # ---- 3. Luoi 2 cot + panel radar dinh, giu nguyen focus sau khi dong Drawer ----
        body_text = page.inner_text("body")
        assert "Hồ sơ lý tưởng vs" in body_text, "Thieu panel radar dinh o man rong (>=992px)"
        print("OK: hien panel radar dinh ben phai o man rong")
        page.screenshot(path=OUT / "phase10_02_results_2col_panel.png", full_page=True)

        # Bam "Vi sao goi y?" o the #2 -> dong Drawer -> panel PHAI giu nguyen may vua xem
        buttons = page.get_by_text("Vì sao gợi ý?", exact=True)
        buttons.nth(1).click()
        page.wait_for_timeout(500)
        page.keyboard.press("Escape")
        page.wait_for_timeout(400)
        body_text = page.inner_text("body")
        assert 'Máy vừa xem "Vì sao gợi ý?" gần nhất' in body_text, \
            "Panel radar tro ve may #1 ngay sau khi dong Drawer thay vi giu may vua xem"
        print("OK: panel radar giu nguyen may vua xem sau khi dong Drawer (khong tro ve #1)")
        page.screenshot(path=OUT / "phase10_03_panel_focus_persisted.png", full_page=True)

        # ---- 2. Sidebar quan tri: 4 nhom + thu gon ----
        page.goto(f"{BASE}/admin/login")
        page.get_by_role("button", name="Đăng nhập").click()
        page.wait_for_url(lambda url: "/admin/login" not in url and "/admin" in url, timeout=10000)
        page.wait_for_timeout(800)

        body_text = page.inner_text("body")
        for group_name in ["Tổng quan", "Dữ liệu", "Trí tuệ", "Hệ thống"]:
            assert group_name in body_text, f"Thieu nhom '{group_name}' trong sidebar quan tri"
        print("OK: sidebar quan tri nhom du 4 nhom co ten")
        page.screenshot(path=OUT / "phase10_04_sidebar_groups.png", full_page=True)

        sider_width_before = page.evaluate("document.querySelector('.ant-layout-sider').getBoundingClientRect().width")
        page.locator(".ant-layout-sider-trigger").click()
        page.wait_for_timeout(400)
        sider_width_after = page.evaluate("document.querySelector('.ant-layout-sider').getBoundingClientRect().width")
        assert sider_width_after < sider_width_before, "Nut thu gon sidebar khong hoat dong"
        print(f"OK: sidebar thu gon tu {sider_width_before}px xuong {sider_width_after}px")
        page.screenshot(path=OUT / "phase10_05_sidebar_collapsed.png")
        # Mo lai de khong doi trang thai localStorage cua may test
        page.locator(".ant-layout-sider-trigger").click()

        browser.close()
        print("\nHoan tat kiem thu Giai doan 10.")


if __name__ == "__main__":
    main()
