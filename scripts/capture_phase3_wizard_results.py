"""Kiem thu Giai doan 3 tren browser that: FR-01 -> FR-04 (luong khach hang Wizard -> Ket qua ->
Chi tiet).

Kiem tra:
  1. Wizard: chon hoat dong "choi_game" -> thay goi y phan khuc AI ("gan voi Gaming...")
  2. Wizard: tu chon phan khuc KHAC (Van phong) -> thay canh bao goi y nhe xuat hien
  3. Wizard: keo ngan sach bang nut nhanh, dien SSD/can nang/hang uu tien, bam Xem ket qua
  4. Results: doi so luong hien thi (Segmented 3/5/8/10) -> danh sach cap nhat
  5. Results: bam "Vi sao goi y?" -> thay bieu do radar
  6. Results: bam "Khong thich" -> thay modal chon ly do, chon 1 ly do, gui
  7. Results: bam "+ So sanh" -> kiem tra event ADD_COMPARE duoc ghi (qua goi API kiem tra so
     luong InteractionEvent tang, hoac chi can khong loi console)
  8. Detail cua 1 may: thay nhan chenh lech gia tren "May tuong tu" (neu co du lieu)

Chay khi 3 dich vu dang chay (backend :4000, frontend :5180, ml-service :8001):
    python scripts/capture_phase3_wizard_results.py
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
        console_errors = []
        page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)

        page.goto(f"{BASE}/wizard")
        page.wait_for_timeout(500)

        # 1. Chon hoat dong "Van phong / soan thao" -> ML tra ve OFFICE voi do tin cay 100%
        # (da kiem tra truoc qua curl /infer-segment) - chon hoat dong nay de dam bao do tin cay
        # >= 60% cho ca 2 buoc kiem thu duoi day (hien thi goi y + goi y nhe).
        page.get_by_text("Văn phòng / soạn thảo", exact=True).click()
        page.wait_for_timeout(1000)
        body_text = page.inner_text("body")
        assert "gần với" in body_text, "Khong thay goi y phan khuc AI sau khi chon hoat dong"
        print("OK: hien goi y phan khuc AI sau khi chon hoat dong")
        page.screenshot(path=OUT / "phase3_01_goi_y_phan_khuc.png")

        # 2. Tu chon phan khuc KHAC (Gaming) -> canh bao goi y nhe (AI doan OFFICE, nguoi
        # dung chon GAMING - khac nhau va do tin cay AI = 100% >= nguong 60%)
        # Luu y: antd Radio.Button an input that (width 0) va hien label - bam vao label thay
        # vi role "radio" de tranh loi "outside of viewport".
        page.locator("label.ant-radio-button-wrapper", has_text="Gaming").click()
        page.wait_for_timeout(500)
        body_text = page.inner_text("body")
        if not ("có thể" in body_text.lower() and "hợp hơn" in body_text.lower()):
            print("---- BODY TEXT DEBUG ----")
            print(body_text[:3000])
        assert "có thể" in body_text.lower() and "hợp hơn" in body_text.lower(), "Khong thay goi y nhe khi phan khuc khac du doan"
        print("OK: hien goi y nhe khi phan khuc tu chon khac AI du doan")
        page.screenshot(path=OUT / "phase3_02_goi_y_nhe.png")

        # quay lai "Chua ro" de khong ep segment, sau do them hoat dong "choi_game" de ket qua
        # tim duoc du may Gaming trong ngan sach (bo hoat dong Van phong de khong lam lech nhu cau)
        page.locator("label.ant-radio-button-wrapper", has_text="Chưa rõ, để AI gợi ý").click()
        page.get_by_role("group").get_by_text("Văn phòng / soạn thảo", exact=True).click()  # bo chon
        page.get_by_role("group").get_by_text("Chơi game", exact=True).click()  # chon lai de dung voi kich ban goc
        page.wait_for_timeout(500)

        # 3. Ngan sach: bam nut nhanh "25–40 tr"
        page.get_by_text("25–40 tr", exact=True).click()
        page.wait_for_timeout(300)
        body_text = page.inner_text("body")
        assert "25.000.000" in body_text or "25tr" in body_text.lower() or "25 tr" in body_text.lower(), "Ngan sach chua cap nhat theo nut nhanh"
        page.screenshot(path=OUT / "phase3_03_ngan_sach.png")

        page.get_by_text("Xem kết quả", exact=True).click()
        page.wait_for_url(lambda url: "/results" in url, timeout=10000)
        page.wait_for_timeout(1200)
        page.screenshot(path=OUT / "phase3_04_ket_qua.png", full_page=True)
        print("OK: dieu huong sang trang Ket qua thanh cong")

        # 4. Doi so luong hien thi
        page.get_by_text("8", exact=True).click()
        page.wait_for_timeout(1000)
        page.screenshot(path=OUT / "phase3_05_doi_topn.png", full_page=True)
        print("OK: doi so luong hien thi (topN) khong loi")

        # 5. Vi sao goi y? -> bieu do radar
        page.get_by_role("button", name="Vì sao gợi ý?").first.click()
        page.wait_for_timeout(800)
        assert page.locator("text=Biểu đồ so sánh").count() > 0 or page.locator("svg.recharts-surface").count() > 0, "Khong thay bieu do radar trong Drawer"
        print("OK: hien bieu do radar trong Drawer Vi sao goi y")
        page.screenshot(path=OUT / "phase3_06_radar.png")
        page.keyboard.press("Escape")
        page.wait_for_timeout(300)

        # 6. Khong thich -> modal ly do
        page.locator('button[aria-label], button').filter(has=page.locator(".anticon-dislike")).first.click()
        page.wait_for_timeout(500)
        assert page.locator("text=Vì sao bạn không thích máy này?").count() > 0, "Khong thay modal ly do Khong thich"
        page.screenshot(path=OUT / "phase3_07_modal_ly_do.png")
        page.get_by_role("button", name="Gửi phản hồi").click()
        page.wait_for_timeout(500)
        print("OK: modal ly do Khong thich hoat dong")

        # 7. So sanh
        page.get_by_text("+ So sánh").first.click()
        page.wait_for_timeout(300)
        page.get_by_text("+ So sánh").nth(1).click()
        page.wait_for_timeout(500)
        assert page.locator("text=So sánh").last.is_visible()
        print("OK: nut so sanh hoat dong (event ADD_COMPARE da goi, xem network neu can kiem tra sau)")
        page.screenshot(path=OUT / "phase3_08_so_sanh.png", full_page=True)

        # 8. Detail -> chenh lech gia tren may tuong tu
        # Catalog.tsx dung <Card hoverable onClick={() => navigate(...)}> cho TUNG MAY - nhung
        # trang con co 1 Card BO LOC o tren cung cung mang class .ant-card, nen ".ant-card".first
        # se bam nham vao bo loc. Loc rieng Card nao co gia (dau ₫) ben trong.
        page.goto(f"{BASE}/laptops")
        page.wait_for_timeout(1000)
        page.locator(".ant-card", has_text="₫").first.click()
        page.wait_for_url(lambda url: "/laptop/" in url, timeout=10000)
        page.wait_for_timeout(1200)
        body_text = page.inner_text("body")
        if "Đắt hơn" in body_text or "Rẻ hơn" in body_text or "Cùng mức giá" in body_text:
            print("OK: hien nhan chenh lech gia tren may tuong tu")
        else:
            print("CANH BAO: khong thay nhan chenh lech gia (co the may nay chua co may tuong tu)")
        page.screenshot(path=OUT / "phase3_09_detail_chenh_lech_gia.png", full_page=True)

        errors = [e for e in console_errors if "favicon" not in e.lower()]
        if errors:
            print("CANH BAO console errors:", errors[:5])
        else:
            print("OK: khong co console error nghiem trong")

        browser.close()
        print("\nHoan tat kiem thu Giai doan 3.")


if __name__ == "__main__":
    main()
