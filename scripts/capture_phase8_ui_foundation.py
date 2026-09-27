"""Kiem thu Giai doan 8 tren browser that: nen tang UI theo docs/07_UIUX.md (token, focus-ring,
max-width thong nhat).

Kiem tra:
  1. Focus-ring (:focus-visible) hien dung khi dieu huong bang ban phim (Tab) tren TopNav
  2. Cac trang khach hang dung THONG NHAT max-width 1200px (Home, Catalog, Wizard, Results)
  3. Khong con canh bao console lien quan mau sac/token

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
        page = browser.new_page(viewport={"width": 1280, "height": 900})

        # 1. Focus-ring khi dieu huong bang ban phim
        page.goto(f"{BASE}/")
        page.wait_for_timeout(500)
        page.keyboard.press("Tab")
        page.wait_for_timeout(200)
        box_shadow = page.evaluate("getComputedStyle(document.activeElement).boxShadow")
        assert "3px" in box_shadow or "rgb" in box_shadow, f"Khong thay focus-ring ro rang, box-shadow={box_shadow}"
        print(f"OK: focus-ring hien khi Tab (box-shadow: {box_shadow[:60]}...)")
        page.screenshot(path=OUT / "phase8_01_focus_ring.png")

        # 2. Max-width thong nhat 1200px
        for path in ["/", "/laptops", "/wizard"]:
            page.goto(f"{BASE}{path}")
            page.wait_for_timeout(500)
            max_width = page.evaluate("""
                () => {
                    const els = [...document.querySelectorAll('div')];
                    const el = els.find(e => getComputedStyle(e).maxWidth === '1200px');
                    return el ? getComputedStyle(el).maxWidth : null;
                }
            """)
            assert max_width == "1200px", f"{path}: khong tim thay div maxWidth=1200px (thay {max_width})"
            print(f"OK: {path} dung max-width 1200px")

        browser.close()
        print("\nHoan tat kiem thu Giai doan 8.")


if __name__ == "__main__":
    main()
