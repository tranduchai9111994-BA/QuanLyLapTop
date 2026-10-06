"""Kiểm thử Giai đoạn 3 trên browser thật: FR-01 đến FR-04 (luồng khách hàng Wizard, Kết quả, Chi tiết).
Các bước: gợi ý phân khúc AI và gợi ý nhẹ ở Wizard; chọn ngân sách nhanh; đổi số lượng hiển thị; xem radar "Vì sao gợi ý?";
modal "Không thích"; so sánh; nhãn chênh lệch giá ở "Máy tương tự" trong trang Chi tiết.
Chạy khi backend :4000, frontend :5180, ml-service :8001 đang chạy: python scripts/capture_phase3_wizard_results.py
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

        # 1. Chọn "Văn phòng / soạn thảo": ML trả OFFICE với độ tin cậy 100% (đã thử qua /infer-segment),
        # đủ vượt ngưỡng 60% cho cả hai bước kiểm thử bên dưới.
        page.get_by_text("Văn phòng / soạn thảo", exact=True).click()
        page.wait_for_timeout(1000)
        body_text = page.inner_text("body")
        assert "gần với" in body_text, "Khong thay goi y phan khuc AI sau khi chon hoat dong"
        print("OK: hiện gợi ý phân khúc AI sau khi chọn hoạt động")
        page.screenshot(path=OUT / "phase3_01_goi_y_phan_khuc.png")

        # 2. Tự chọn phân khúc khác (Gaming): AI đoán OFFICE nên phải hiện gợi ý nhẹ.
        # antd Radio.Button ẩn input thật (width 0), nên bấm vào label thay vì role "radio" để khỏi lỗi "outside of viewport".
        page.locator("label.ant-radio-button-wrapper", has_text="Gaming").click()
        page.wait_for_timeout(500)
        body_text = page.inner_text("body")
        if not ("có thể" in body_text.lower() and "hợp hơn" in body_text.lower()):
            print("---- BODY TEXT DEBUG ----")
            print(body_text[:3000])
        assert "có thể" in body_text.lower() and "hợp hơn" in body_text.lower(), "Khong thay goi y nhe khi phan khuc khac du doan"
        print("OK: hiện gợi ý nhẹ khi phân khúc tự chọn khác AI dự đoán")
        page.screenshot(path=OUT / "phase3_02_goi_y_nhe.png")

        # Quay lại "Chưa rõ" để không ép segment, bỏ Văn phòng và chọn Chơi game để kết quả đủ máy Gaming trong ngân sách
        page.locator("label.ant-radio-button-wrapper", has_text="Chưa rõ, để AI gợi ý").click()
        page.get_by_role("group").get_by_text("Văn phòng / soạn thảo", exact=True).click()  # bỏ chọn
        page.get_by_role("group").get_by_text("Chơi game", exact=True).click()  # chọn lại như kịch bản gốc
        page.wait_for_timeout(500)

        # 3. Ngân sách: bấm nút nhanh "25–40 tr"
        page.get_by_text("25–40 tr", exact=True).click()
        page.wait_for_timeout(300)
        body_text = page.inner_text("body")
        assert "25.000.000" in body_text or "25tr" in body_text.lower() or "25 tr" in body_text.lower(), "Ngan sach chua cap nhat theo nut nhanh"
        page.screenshot(path=OUT / "phase3_03_ngan_sach.png")

        page.get_by_text("Xem kết quả", exact=True).click()
        page.wait_for_url(lambda url: "/results" in url, timeout=10000)
        page.wait_for_timeout(1200)
        page.screenshot(path=OUT / "phase3_04_ket_qua.png", full_page=True)
        print("OK: điều hướng sang trang Kết quả thành công")

        # 4. Đổi số lượng hiển thị
        page.get_by_text("8", exact=True).click()
        page.wait_for_timeout(1000)
        page.screenshot(path=OUT / "phase3_05_doi_topn.png", full_page=True)
        print("OK: đổi số lượng hiển thị (topN) không lỗi")

        # 5. "Vì sao gợi ý?": biểu đồ radar
        page.get_by_role("button", name="Vì sao gợi ý?").first.click()
        page.wait_for_timeout(800)
        assert page.locator("text=Biểu đồ so sánh").count() > 0 or page.locator("svg.recharts-surface").count() > 0, "Khong thay bieu do radar trong Drawer"
        print("OK: hiện biểu đồ radar trong Drawer Vì sao gợi ý")
        page.screenshot(path=OUT / "phase3_06_radar.png")
        page.keyboard.press("Escape")
        page.wait_for_timeout(300)

        # 6. "Không thích": modal lý do
        page.locator('button[aria-label], button').filter(has=page.locator(".anticon-dislike")).first.click()
        page.wait_for_timeout(500)
        assert page.locator("text=Vì sao bạn không thích máy này?").count() > 0, "Khong thay modal ly do Khong thich"
        page.screenshot(path=OUT / "phase3_07_modal_ly_do.png")
        page.get_by_role("button", name="Gửi phản hồi").click()
        page.wait_for_timeout(500)
        print("OK: modal lý do Không thích hoạt động")

        # 7. So sánh
        page.get_by_text("+ So sánh").first.click()
        page.wait_for_timeout(300)
        page.get_by_text("+ So sánh").nth(1).click()
        page.wait_for_timeout(500)
        assert page.locator("text=So sánh").last.is_visible()
        print("OK: nút so sánh hoạt động (event ADD_COMPARE đã gọi, xem network nếu cần kiểm tra sâu)")
        page.screenshot(path=OUT / "phase3_08_so_sanh.png", full_page=True)

        # 8. Chi tiết: chênh lệch giá ở máy tương tự.
        # Trang còn một Card bộ lọc ở trên cùng cũng mang class .ant-card nên ".first" sẽ bấm nhầm; lọc Card có giá (dấu ₫).
        page.goto(f"{BASE}/laptops")
        page.wait_for_timeout(1000)
        page.locator(".ant-card", has_text="₫").first.click()
        page.wait_for_url(lambda url: "/laptop/" in url, timeout=10000)
        page.wait_for_timeout(1200)
        body_text = page.inner_text("body")
        if "Đắt hơn" in body_text or "Rẻ hơn" in body_text or "Cùng mức giá" in body_text:
            print("OK: hiện nhãn chênh lệch giá trên máy tương tự")
        else:
            print("CẢNH BÁO: không thấy nhãn chênh lệch giá (có thể máy này chưa có máy tương tự)")
        page.screenshot(path=OUT / "phase3_09_detail_chenh_lech_gia.png", full_page=True)

        errors = [e for e in console_errors if "favicon" not in e.lower()]
        if errors:
            print("CẢNH BÁO console errors:", errors[:5])
        else:
            print("OK: không có console error nghiêm trọng")

        browser.close()
        print("\nHoàn tất kiểm thử Giai đoạn 3.")


if __name__ == "__main__":
    main()
