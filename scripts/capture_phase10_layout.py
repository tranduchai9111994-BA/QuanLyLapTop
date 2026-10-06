"""Kiểm thử Giai đoạn 10 trên browser thật: bố cục lớn theo docs/07_UIUX.md.
  1. TopNav luôn có icon yêu thích; chọn 2 máy ở Kết quả thì hiện link "So sánh (2)" (danh sách so sánh dùng chung toàn app).
  2. Sidebar quản trị chia 4 nhóm, nút thu gọn hoạt động.
  3. Kết quả tư vấn có lưới 2 cột + panel radar dính bên phải (>=992px), panel giữ máy vừa xem sau khi đóng Drawer.
Chạy khi backend :4000, frontend :5180, ml-service :8001 đang chạy.
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

        # 1. TopNav: icon tim luôn có, "So sánh (N)" hiện sau khi chọn 2 máy
        page.goto(f"{BASE}/wizard")
        page.wait_for_timeout(500)
        body_text = page.inner_text("body")
        assert page.locator('a[href="/favorites"]').count() > 0, "Thieu icon yeu thich (♡) tren TopNav"
        print("OK: TopNav luôn có icon yêu thích")

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
        print("OK: TopNav hiện 'So sánh (2)' sau khi chọn máy ở Kết quả")
        page.screenshot(path=OUT / "phase10_01_topnav_compare_favorite.png")

        # 3. Lưới 2 cột + panel radar dính, giữ focus sau khi đóng Drawer
        body_text = page.inner_text("body")
        assert "Hồ sơ lý tưởng vs" in body_text, "Thieu panel radar dinh o man rong (>=992px)"
        print("OK: hiện panel radar dính bên phải ở màn rộng")
        page.screenshot(path=OUT / "phase10_02_results_2col_panel.png", full_page=True)

        # Bấm "Vì sao gợi ý?" ở thẻ #2, đóng Drawer: panel phải giữ máy vừa xem
        buttons = page.get_by_text("Vì sao gợi ý?", exact=True)
        buttons.nth(1).click()
        page.wait_for_timeout(500)
        page.keyboard.press("Escape")
        page.wait_for_timeout(400)
        body_text = page.inner_text("body")
        assert 'Máy vừa xem "Vì sao gợi ý?" gần nhất' in body_text, \
            "Panel radar tro ve may #1 ngay sau khi dong Drawer thay vi giu may vua xem"
        print("OK: panel radar giữ nguyên máy vừa xem sau khi đóng Drawer (không trở về #1)")
        page.screenshot(path=OUT / "phase10_03_panel_focus_persisted.png", full_page=True)

        # 2. Sidebar quản trị: 4 nhóm + thu gọn
        page.goto(f"{BASE}/admin/login")
        page.get_by_role("button", name="Đăng nhập").click()
        page.wait_for_url(lambda url: "/admin/login" not in url and "/admin" in url, timeout=10000)
        page.wait_for_timeout(800)

        body_text = page.inner_text("body")
        for group_name in ["Tổng quan", "Dữ liệu", "Trí tuệ", "Hệ thống"]:
            assert group_name in body_text, f"Thieu nhom '{group_name}' trong sidebar quan tri"
        print("OK: sidebar quản trị chia đủ 4 nhóm có tên")
        page.screenshot(path=OUT / "phase10_04_sidebar_groups.png", full_page=True)

        sider_width_before = page.evaluate("document.querySelector('.ant-layout-sider').getBoundingClientRect().width")
        page.locator(".ant-layout-sider-trigger").click()
        page.wait_for_timeout(400)
        sider_width_after = page.evaluate("document.querySelector('.ant-layout-sider').getBoundingClientRect().width")
        assert sider_width_after < sider_width_before, "Nut thu gon sidebar khong hoat dong"
        print(f"OK: sidebar thu gọn từ {sider_width_before}px xuống {sider_width_after}px")
        page.screenshot(path=OUT / "phase10_05_sidebar_collapsed.png")
        # Mở lại để không đổi trạng thái localStorage của máy test
        page.locator(".ant-layout-sider-trigger").click()

        browser.close()
        print("\nHoàn tất kiểm thử Giai đoạn 10.")


if __name__ == "__main__":
    main()
