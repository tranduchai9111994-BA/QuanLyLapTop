"""Chup anh man hinh chuc nang phuc vu bao cao do an. Chay khi frontend (5180) va backend (4000)
dang chay: python scripts/capture_screenshots.py
"""
from pathlib import Path
from playwright.sync_api import sync_playwright

OUT = Path(__file__).resolve().parent.parent / "screenshots"
OUT.mkdir(exist_ok=True)
BASE = "http://localhost:5180"


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": 1360, "height": 900})

        page.goto(f"{BASE}/")
        page.wait_for_timeout(600)
        page.screenshot(path=OUT / "01_trang_chu.png")

        page.get_by_text("Tìm laptop cho tôi").click()
        page.wait_for_url("**/wizard")
        page.wait_for_timeout(400)
        page.screenshot(path=OUT / "02_wizard_nhu_cau.png")

        # Mo hinh C: nhap nhu cau bang CAU TU DO (diem moi quan trong nhat - tieu chi 2)
        page.get_by_placeholder('Ví dụ: "con học kế toán, cần máy bền, rẻ"').fill(
            "con học kế toán, cần máy bền, rẻ"
        )
        page.get_by_text("Phân tích nhu cầu").click()
        page.wait_for_timeout(1500)
        page.get_by_text("Vì sao hệ thống hiểu như vậy?").click()
        page.wait_for_timeout(400)
        page.screenshot(path=OUT / "02b_cau_tu_do_tfidf_knn.png")

        page.get_by_text("Chơi game", exact=True).click()
        page.get_by_text("Lập trình", exact=True).click()
        page.wait_for_timeout(200)
        page.screenshot(path=OUT / "03_wizard_da_chon.png")

        page.get_by_text("Xem kết quả").click()
        page.wait_for_url("**/results", timeout=15000)
        page.wait_for_timeout(800)
        page.screenshot(path=OUT / "04_ket_qua_goi_y.png", full_page=True)

        page.get_by_text("Vì sao gợi ý?").first.click()
        page.wait_for_timeout(400)
        page.screenshot(path=OUT / "05_vi_sao_goi_y.png")
        page.keyboard.press("Escape")
        page.wait_for_timeout(300)

        page.get_by_text("Chi tiết").first.click()
        page.wait_for_url("**/laptop/**", timeout=10000)
        page.wait_for_timeout(600)
        page.screenshot(path=OUT / "06_chi_tiet_laptop.png", full_page=True)

        page.go_back()
        page.wait_for_url("**/results")
        page.wait_for_timeout(400)
        buttons = page.get_by_text("+ So sánh")
        buttons.nth(0).click()
        buttons.nth(1).click()
        page.wait_for_timeout(300)
        page.get_by_text("So sánh", exact=False).last.click()
        page.wait_for_url("**/compare**", timeout=10000)
        page.wait_for_timeout(500)
        page.screenshot(path=OUT / "07_so_sanh.png", full_page=True)

        browser.close()
        print(f"Da luu anh vao {OUT}")


if __name__ == "__main__":
    main()
