"""Chụp ảnh màn hình chức năng cho báo cáo đồ án, lưu vào screenshots/.
Chạy khi frontend (5180) và backend (4000) đang chạy: python scripts/capture_screenshots.py
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

        # Mô hình C: nhập nhu cầu bằng câu tự do (tiêu chí 2)
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

        # 08: Danh mục với tab phân khúc và ảnh đại diện
        page.goto(f"{BASE}/laptops")
        page.wait_for_timeout(1200)
        page.screenshot(path=OUT / "08_danh_muc.png")

        page.get_by_text("Gaming (", exact=False).first.click()
        page.wait_for_timeout(1000)
        page.screenshot(path=OUT / "09_danh_muc_loc_gaming.png")

        # 09b: trạng thái rỗng của Danh mục khi bộ lọc chặn hết kết quả (yêu cầu C0.1: phải nêu rõ điều kiện đang chặn và có nút thoát)
        page.goto(f"{BASE}/laptops")
        page.wait_for_timeout(800)
        page.get_by_placeholder("Ví dụ: Legion, ThinkPad...").fill("khong-co-may-nao-ten-nay-xyz123")
        page.wait_for_timeout(600)
        page.screenshot(path=OUT / "09b_danh_muc_rong.png")

        # 09c: trạng thái rỗng của So sánh khi chưa chọn máy nào
        page.goto(f"{BASE}/compare")
        page.wait_for_timeout(500)
        page.screenshot(path=OUT / "09c_so_sanh_rong.png")

        # 10 trở đi: khu quản trị
        page.goto(f"{BASE}/admin/login")
        page.wait_for_timeout(600)
        page.screenshot(path=OUT / "10_dang_nhap_quan_tri.png")
        page.get_by_role("button", name="Đăng nhập").click()
        page.wait_for_url(lambda url: "/admin/login" not in url and "/admin" in url, timeout=10000)
        page.wait_for_timeout(1500)

        # 10b: Hãng máy (có cột "Mức uy tín", đặc trưng của Mô hình B)
        page.goto(f"{BASE}/admin/brands")
        page.wait_for_timeout(1000)
        page.screenshot(path=OUT / "10b_quan_tri_hang_may.png")

        page.goto(f"{BASE}/admin/laptops")
        page.wait_for_timeout(2500)
        page.screenshot(path=OUT / "11_quan_tri_crud_laptop.png")

        # Tìm kiếm trong CRUD
        page.get_by_placeholder("Tìm kiếm...").fill("RTX 4070")
        page.wait_for_timeout(800)
        page.screenshot(path=OUT / "12_quan_tri_tim_kiem.png")
        page.get_by_placeholder("Tìm kiếm...").fill("")

        # Màn Quản lý giá: khuyến mãi (giá gốc gạch ngang) và lượt bán
        page.goto(f"{BASE}/admin/prices")
        page.wait_for_timeout(1500)
        page.screenshot(path=OUT / "12b_quan_ly_gia_khuyen_mai.png", full_page=True)

        # Quay lại màn CRUD laptop để tạo máy mới
        page.goto(f"{BASE}/admin/laptops")
        page.wait_for_timeout(1500)
        page.wait_for_timeout(500)

        # Tiêu chí 3: AI gợi ý phân khúc cho máy mới
        page.get_by_text("+ Thêm mới").click()
        page.wait_for_timeout(800)
        page.screenshot(path=OUT / "13_them_laptop_form.png")

        # RAM, SSD, màn hình, độ phân giải, tần số quét là dropdown (không còn ô nhập tự do):
        # phải mở dropdown rồi chọn option (xem constants/laptopSpecs.ts, checklist C0.6).
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
        print(f"Đã lưu ảnh vào {OUT}")
        for f in sorted(OUT.glob("*.png")):
            print(f"  {f.name}")


if __name__ == "__main__":
    main()
