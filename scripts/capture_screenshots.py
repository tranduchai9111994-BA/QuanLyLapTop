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

        # --- 08: Danh muc voi tab phan khuc + anh dai dien ---
        page.goto(f"{BASE}/laptops")
        page.wait_for_timeout(1200)
        page.screenshot(path=OUT / "08_danh_muc.png")

        page.get_by_text("Gaming (", exact=False).first.click()
        page.wait_for_timeout(1000)
        page.screenshot(path=OUT / "09_danh_muc_loc_gaming.png")

        # --- 09b: TRANG THAI RONG - Danh muc khi bo loc chan het ket qua (yeu cau C0.1: khong
        # duoc de trang rong cut lun, phai neu ro dieu kien dang chan + nut thoat) ---
        page.goto(f"{BASE}/laptops")
        page.wait_for_timeout(800)
        page.get_by_placeholder("Ví dụ: Legion, ThinkPad...").fill("khong-co-may-nao-ten-nay-xyz123")
        page.wait_for_timeout(600)
        page.screenshot(path=OUT / "09b_danh_muc_rong.png")

        # --- 09c: TRANG THAI RONG - So sanh khi chua chon may nao ---
        page.goto(f"{BASE}/compare")
        page.wait_for_timeout(500)
        page.screenshot(path=OUT / "09c_so_sanh_rong.png")

        # --- 10+: Khu quan tri ---
        page.goto(f"{BASE}/admin/login")
        page.wait_for_timeout(600)
        page.screenshot(path=OUT / "10_dang_nhap_quan_tri.png")
        page.get_by_role("button", name="Đăng nhập").click()
        page.wait_for_url(lambda url: "/admin/login" not in url and "/admin" in url, timeout=10000)
        page.wait_for_timeout(1500)

        # --- 10b: Hang may (co cot "Muc uy tin" - dac trung that cua Mo hinh B, moi bo sung) ---
        page.goto(f"{BASE}/admin/brands")
        page.wait_for_timeout(1000)
        page.screenshot(path=OUT / "10b_quan_tri_hang_may.png")

        page.goto(f"{BASE}/admin/laptops")
        page.wait_for_timeout(2500)
        page.screenshot(path=OUT / "11_quan_tri_crud_laptop.png")

        # Tim kiem trong CRUD
        page.get_by_placeholder("Tìm kiếm...").fill("RTX 4070")
        page.wait_for_timeout(800)
        page.screenshot(path=OUT / "12_quan_tri_tim_kiem.png")
        page.get_by_placeholder("Tìm kiếm...").fill("")

        # --- Man Quan ly gia: khuyen mai (gia goc gach ngang) + luot ban - tinh nang MOI ---
        page.goto(f"{BASE}/admin/prices")
        page.wait_for_timeout(1500)
        page.screenshot(path=OUT / "12b_quan_ly_gia_khuyen_mai.png", full_page=True)

        # Quay lai man CRUD laptop cho cac buoc tiep theo (tao may moi)
        page.goto(f"{BASE}/admin/laptops")
        page.wait_for_timeout(1500)
        page.wait_for_timeout(500)

        # --- TIEU CHI 3: AI goi y phan khuc cho may moi ---
        page.get_by_text("+ Thêm mới").click()
        page.wait_for_timeout(800)
        page.screenshot(path=OUT / "13_them_laptop_form.png")

        # RAM/SSD/Man hinh/Do phan giai/Tan so quet la du lieu CHUAN nen la dropdown (Select),
        # khong con o nhap tu do - phai click mo dropdown roi chon dung option (xem
        # constants/laptopSpecs.ts va checklist muc C0.6: chan nhap sai kieu RAM=-2).
        def choose(label: str, option_text: str):
            page.get_by_label(label).click()
            page.get_by_title(option_text).click()

        choose("RAM (GB)", "32")
        choose("SSD (GB)", "1024")
        choose("Màn hình (inch)", '16"')
        choose("Độ phân giải", "2560 x 1440 (QHD)")
        choose("Tần số quét (Hz)", "240 Hz")
        page.get_by_label("Trọng lượng (kg)").fill("2.6")

        page.get_by_label("CPU").click()
        page.keyboard.type("i9-13900H")
        page.wait_for_timeout(500)
        page.keyboard.press("Enter")
        page.get_by_label("GPU").click()
        page.keyboard.type("RTX 4070")
        page.wait_for_timeout(500)
        page.keyboard.press("Enter")

        page.get_by_text("AI gợi ý phân khúc từ cấu hình").click()
        page.wait_for_timeout(1500)
        page.screenshot(path=OUT / "14_ai_goi_y_phan_khuc.png")

        browser.close()
        print(f"Da luu anh vao {OUT}")
        for f in sorted(OUT.glob("*.png")):
            print(f"  {f.name}")


if __name__ == "__main__":
    main()
