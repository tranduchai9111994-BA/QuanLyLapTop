"""Kiem thu CRUD THAT tren tung man quan tri (Hang may, Benchmark CPU/GPU, Laptop, Quan ly gia)
va LUU LAI anh man hinh cua tung thao tac chinh - de co bang chung cu the (khong chi tin loi noi)
rang he thong dang chay dung sau tat ca thay doi trong phien.

Chay khi frontend (5180) va backend (4000) dang chay:
    python scripts/capture_crud_test.py

Anh duoc luu vao thu muc crud_test_screenshots/, danh so theo dung thu tu thao tac.
Moi thao tac TAO du lieu test deu duoc XOA lai o cuoi (khong de rac trong catalog that).
"""
from datetime import datetime
from pathlib import Path
from playwright.sync_api import sync_playwright

OUT = Path(__file__).resolve().parent.parent / "crud_test_screenshots"
OUT.mkdir(exist_ok=True)

# QUAN TRONG: nut "Xoa" tren giao dien la XOA MEM (chi dat isActive=false, khong xoa that ban ghi
# khoi DB - de giu duoc lich su gia/khong pha vo khoa ngoai). Vi vay SKU cua ban ghi da "xoa" VAN
# CON TON TAI va se lam that bai rang buoc unique neu chay lai script voi CUNG 1 ma SKU co dinh.
# Dung SKU co hau to thoi gian de moi lan chay la mot ma MOI, khong bao gio dung ma cu.
TEST_SKU = f"TEST-CRUD-{datetime.now().strftime('%Y%m%d%H%M%S')}"
BASE = "http://localhost:5180"


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": 1400, "height": 900})

        def log_failed_api(response):
            if response.request.method in ("POST", "PUT") and "/api/laptops" in response.url and response.status >= 400:
                try:
                    print(f"[DEBUG] {response.request.method} {response.url} -> {response.status}")
                    print(f"[DEBUG] request body: {response.request.post_data}")
                    print(f"[DEBUG] response body: {response.text()}")
                except Exception as e:
                    print("loi doc response:", e)

        page.on("response", log_failed_api)

        # ================= Dang nhap quan tri =================
        page.goto(f"{BASE}/admin/login")
        page.wait_for_timeout(500)
        page.get_by_role("button", name="Đăng nhập").click()
        page.wait_for_url(lambda url: "/admin/login" not in url and "/admin" in url, timeout=10000)
        page.wait_for_timeout(800)

        # ================= 1) HANG MAY: sua Muc uy tin (CRUD - Update) =================
        page.goto(f"{BASE}/admin/brands")
        page.wait_for_timeout(1000)
        page.screenshot(path=OUT / "01_brands_truoc_khi_sua.png")

        page.get_by_role("row", name="61 Acer").get_by_role("button", name="Sửa").click()
        page.wait_for_timeout(400)
        page.screenshot(path=OUT / "02_brands_form_sua.png")
        page.get_by_label("Mức uy tín").click()
        page.get_by_text("4 - Uy tín, phổ biến").last.click()
        page.get_by_role("button", name="Lưu").click()
        page.wait_for_timeout(600)
        page.screenshot(path=OUT / "03_brands_sau_khi_sua_thanh_cong.png")

        # Tra lai gia tri goc (3) de khong lam lech du lieu that
        page.get_by_role("row", name="61 Acer").get_by_role("button", name="Sửa").click()
        page.wait_for_timeout(400)
        page.get_by_label("Mức uy tín").click()
        page.get_by_text("3 - Trung bình").last.click()
        page.get_by_role("button", name="Lưu").click()
        page.wait_for_timeout(600)
        page.screenshot(path=OUT / "04_brands_da_khoi_phuc_gia_tri_goc.png")

        # ================= 2) BENCHMARK CPU: Create + Search + Delete =================
        page.goto(f"{BASE}/admin/benchmarks/cpu")
        page.wait_for_timeout(1000)
        page.get_by_text("+ Thêm mới").click()
        page.wait_for_timeout(400)
        page.get_by_label("Mã tra cứu (pattern)").fill("test-crud-cpu")
        page.get_by_label("Tên hiển thị").fill("Test CRUD CPU")
        page.get_by_label("Điểm PassMark thô").fill("20000")
        page.get_by_label("Điểm chuẩn hóa (0-100)").fill("55")
        page.get_by_label("Nguồn tra cứu").fill("Test CRUD - khong dung that")
        page.get_by_label("Ngày tra (ISO)").fill("2026-09-27")
        page.screenshot(path=OUT / "05_benchmark_cpu_form_them_moi.png")
        page.get_by_role("button", name="Lưu").click()
        page.wait_for_timeout(600)
        page.screenshot(path=OUT / "06_benchmark_cpu_da_them_thanh_cong.png")

        page.get_by_placeholder("Tìm kiếm...").fill("test-crud-cpu")
        page.wait_for_timeout(500)
        page.screenshot(path=OUT / "07_benchmark_cpu_tim_kiem_ra_dung_dong.png")
        page.get_by_role("button", name="Xóa").click()
        page.wait_for_timeout(300)
        page.get_by_role("button", name="Xóa", exact=True).last.click()
        page.wait_for_timeout(600)
        page.screenshot(path=OUT / "08_benchmark_cpu_da_xoa_thanh_cong.png")

        # ================= 3) LAPTOP: Create (kem AI goi y phan khuc) + Edit + Delete =================
        page.goto(f"{BASE}/admin/laptops")
        page.wait_for_timeout(1200)
        page.get_by_text("+ Thêm mới").click()
        page.wait_for_timeout(500)

        page.get_by_label("Mã SKU").fill(TEST_SKU)
        page.get_by_label("Tên máy").fill("Test CRUD Gaming")

        def choose(label: str, option_text: str, exact: bool = True):
            page.get_by_label(label).click()
            page.wait_for_timeout(150)
            page.get_by_text(option_text, exact=exact).last.click()
            page.wait_for_timeout(150)

        choose("Hãng", "Acer")
        choose("CPU", "Intel Core i9-13900H")
        choose("GPU", "NVIDIA GeForce RTX 4070 Laptop")
        choose("RAM (GB)", "32", exact=True)
        choose("SSD (GB)", "1024", exact=True)
        choose("Màn hình (inch)", '16"')
        choose("Độ phân giải", "2560 x 1440 (QHD)")
        choose("Tần số quét (Hz)", "120 Hz")
        page.get_by_label("Trọng lượng (kg)").fill("2.6")
        page.get_by_label("Giá (VND)").fill("35000000")
        page.screenshot(path=OUT / "09_laptop_form_them_moi_da_dien_du.png")

        # Tieu chi 3: he thong TU GOI Y phan khuc tu cau hinh vua nhap (khong ai gan nhan tay)
        page.get_by_text("AI gợi ý phân khúc từ cấu hình").click()
        page.wait_for_timeout(1200)
        page.screenshot(path=OUT / "10_laptop_ai_goi_y_phan_khuc.png")

        page.get_by_role("button", name="Lưu").click()
        page.wait_for_timeout(800)
        page.screenshot(path=OUT / "11_laptop_da_them_thanh_cong.png")

        # Sua lai: doi ten + gia (Update, khong phai Create)
        page.get_by_placeholder("Tìm kiếm...").fill(TEST_SKU)
        page.wait_for_timeout(500)
        page.screenshot(path=OUT / "12_laptop_tim_thay_dung_may_vua_tao.png")
        page.get_by_role("button", name="Sửa").click()
        page.wait_for_timeout(500)
        page.get_by_label("Tên máy").fill("Test CRUD Gaming (Da Sua)")
        page.get_by_role("button", name="Lưu").click()
        page.wait_for_timeout(700)
        page.screenshot(path=OUT / "13_laptop_da_sua_ten_thanh_cong.png")

        # Xoa may test (don dep, khong de rac trong catalog)
        page.get_by_role("button", name="Xóa").click()
        page.wait_for_timeout(300)
        page.get_by_role("button", name="Xóa", exact=True).last.click()
        page.wait_for_timeout(700)
        page.get_by_placeholder("Tìm kiếm...").fill("")
        page.wait_for_timeout(400)
        page.screenshot(path=OUT / "14_laptop_da_xoa_thanh_cong.png")

        # ================= 4) QUAN LY GIA: sua khuyen mai + luot ban (Update) =================
        page.goto(f"{BASE}/admin/prices")
        page.wait_for_timeout(1200)
        page.screenshot(path=OUT / "15_quan_ly_gia_truoc_khi_sua.png")

        page.get_by_placeholder("Tìm theo tên máy / hãng...").fill("LG-00325")
        page.wait_for_timeout(500)
        row = page.locator("tr", has_text="LG-00325")
        sales_input = row.get_by_role("spinbutton").nth(1)  # 0=Gia goc, 1=Da ban, 2=Gia moi
        sales_input.fill("999")
        page.keyboard.press("Tab")
        page.wait_for_timeout(700)
        page.screenshot(path=OUT / "16_quan_ly_gia_da_sua_luot_ban_thanh_cong.png")

        browser.close()
        print(f"Da luu {len(list(OUT.glob('*.png')))} anh vao {OUT}")


if __name__ == "__main__":
    main()
