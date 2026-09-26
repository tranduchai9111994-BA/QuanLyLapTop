# 02 — Yêu cầu chức năng

## 1. Tác nhân

| Tác nhân | Mô tả | Quyền chính |
|---|---|---|
| Khách (chưa đăng nhập) | Người mua tìm máy | Tư vấn, xem danh mục, so sánh, gửi phản hồi ẩn danh |
| Khách hàng (đã đăng nhập) | Như trên + lưu | Yêu thích, lịch sử tư vấn |
| Nhân viên tư vấn (`STAFF`) | Dùng hệ thống tư vấn tại cửa hàng | Tư vấn hộ khách, nhập/sửa laptop, duyệt nhãn phân khúc |
| Quản trị viên (`ADMIN`) | Vận hành hệ thống | Tất cả + quản lý mô hình, tri thức, người dùng |

## 2. Use case

| Mã | Tên | Tác nhân | Thông minh? |
|---|---|---|---|
| UC-01 | Tư vấn laptop theo nhu cầu (wizard) | Khách, KH, Staff | ✅ Mô hình A + B |
| UC-02 | Xem giải thích vì sao được gợi ý | Khách, KH | ✅ |
| UC-03 | Gửi phản hồi thích / không thích + lý do | Khách, KH | ✅ (thu tri thức) |
| UC-04 | Xem chi tiết laptop + laptop tương tự | Tất cả | ✅ Mô hình B (item-item) |
| UC-05 | So sánh tối đa 3 máy | Tất cả | |
| UC-06 | Duyệt danh mục có lọc | Tất cả | |
| UC-07 | Yêu thích, lịch sử tư vấn | KH | |
| UC-08 | Đăng nhập / đăng xuất | KH, Staff, Admin | |
| UC-09 | Thêm / sửa laptop, nhận gợi ý phân khúc tự động | Staff, Admin | ✅ Mô hình A |
| UC-10 | Duyệt hàng đợi nhãn "Cần xác minh" | Staff, Admin | ✅ (human-in-the-loop) |
| UC-11 | Quản lý bảng benchmark CPU / GPU | Admin | |
| UC-12 | Xem chỉ số mô hình, huấn luyện lại, duyệt / rollback phiên bản | Admin | ✅ |
| UC-13 | Cấu hình tri thức: trọng số mặc định, ghim / loại máy, ngưỡng | Admin | ✅ (ghi đè tri thức) |
| UC-14 | Dashboard giám sát + cảnh báo | Admin | ✅ |
| UC-15 | Xem phân tích phản hồi | Admin | ✅ |
| UC-16 | Quản lý người dùng, nhật ký | Admin | |

## 3. Yêu cầu chức năng chi tiết

### FR-01 Wizard nhu cầu (UC-01)
- Bước 1 — Mục đích: chọn 1 trong 4 phân khúc **hoặc** "Chưa rõ, hãy gợi ý giúp tôi" (+ ô chọn nhiều hoạt động: học tập, văn phòng, lập trình, chơi game, thiết kế đồ họa, dựng video, di chuyển nhiều).
- Bước 2 — Ngân sách: thanh trượt khoảng 8–80 triệu, bước 500.000 ₫; gợi ý nhanh: Dưới 15 tr, 15–25 tr, 25–40 tr, Trên 40 tr.
- Bước 3 — Ưu tiên: 4 thanh mức 1–5 (Hiệu năng, Di động & pin, Màn hình, Tiết kiệm chi phí) + yêu cầu bắt buộc tùy chọn (RAM tối thiểu, SSD tối thiểu, trọng lượng tối đa, hãng ưa thích).
- Nếu chọn "Chưa rõ": hệ thống ánh xạ hoạt động → hồ sơ đặc trưng → Mô hình A dự đoán phân khúc, hiển thị "Nhu cầu của bạn gần với **Gaming** (độ tin cậy 72%)" và cho phép đổi.
- Nếu người dùng chọn phân khúc nhưng Mô hình A dự đoán khác với độ tin cậy ≥ 0,6 → hiện gợi ý nhẹ: "Với ưu tiên bạn chọn, phân khúc Đồ họa có thể hợp hơn. Xem thử?" (không ép).

### FR-02 Kết quả khuyến nghị (UC-01, UC-02)
- Trả về top 5 (tùy chỉnh 3–10), mỗi thẻ: ảnh, tên, giá, điểm phù hợp %, huy hiệu phân khúc, 2 điểm mạnh, tối đa 2 lưu ý.
- Huy hiệu phụ: "Đáng tiền nhất" (chỉ số hiệu năng/giá cao nhất trong top), "Nhẹ nhất", "Mạnh nhất".
- Biểu đồ radar: hồ sơ lý tưởng so với máy đang chọn.
- Nếu không đủ máy trong ngân sách: nới 10% và thông báo rõ "Đã mở rộng ngân sách thêm 10% vì chỉ có 2 máy thỏa điều kiện".
- Nếu dịch vụ ML lỗi: kết quả xếp theo luật dự phòng + banner "Chế độ dự phòng".

### FR-03 Phản hồi (UC-03)
- Mỗi thẻ có 👍 / 👎. 👎 mở danh sách lý do: Quá đắt, Quá nặng, Hiệu năng yếu, Màn hình chưa tốt, Không thích hãng, Khác (ghi chú).
- Ghi nhận ngầm: xem chi tiết, thêm so sánh, thêm yêu thích.

### FR-04 Laptop tương tự (UC-04)
- 6 máy gần nhất theo đặc trưng (trọng số đều), loại chính nó, hiển thị chênh lệch giá "+2,5 tr" / "−1,2 tr".

### FR-09 Gợi ý phân khúc khi nhập laptop (UC-09)
- Khi nhập đủ đặc trưng, nút "Gợi ý phân khúc bằng AI" → nhãn dự đoán, xác suất từng lớp, danh sách k láng giềng đã bỏ phiếu.
- Nhân viên chấp nhận / chọn nhãn khác. Nhãn lưu với `source = ADMIN` nếu người sửa, `MODEL` nếu chấp nhận nguyên.
- Độ tin cậy < ngưỡng → tự vào hàng đợi "Cần xác minh".

### FR-12 Quản lý mô hình (UC-12)
- Danh sách phiên bản: trạng thái (Đang dùng / Ứng viên / Lưu trữ), k, metric, weights, macro-F1, accuracy, ngày huấn luyện.
- Chi tiết: confusion matrix, đường cong F1 theo k, bảng so sánh baseline, precision/recall từng lớp.
- Nút "Huấn luyện lại", "Duyệt đưa vào sử dụng" (chỉ bật khi đạt quy tắc promote), "Quay lại phiên bản trước".

### FR-13 Cấu hình tri thức (UC-13)
- Trọng số mặc định từng nhóm đặc trưng theo phân khúc.
- Ghim máy (luôn xuất hiện nếu thỏa ràng buộc, tối đa 1 vị trí trong top) / loại máy (không bao giờ gợi ý), có lý do và ngày hết hạn.
- Ngưỡng tin cậy, số kết quả mặc định, tỷ lệ nới ngân sách.

### FR-14 Dashboard (UC-14)
- KPI: lượt tư vấn, tỷ lệ 👍, tỷ lệ phiên có tương tác, thời gian phản hồi p95, tỷ lệ dự phòng, số nhãn chờ duyệt.
- Cảnh báo theo ngưỡng (09 §6).

## 4. Yêu cầu phi chức năng

| Mã | Yêu cầu | Ngưỡng |
|---|---|---|
| NFR-01 | Thời gian trả kết quả khuyến nghị | p95 < 800 ms |
| NFR-02 | Sẵn sàng khi ML lỗi | 100% yêu cầu vẫn có kết quả (dự phòng) |
| NFR-03 | Tái lập kết quả huấn luyện | Cùng dữ liệu + seed → cùng metric |
| NFR-04 | Ngôn ngữ | 100% chuỗi UI tiếng Việt có dấu |
| NFR-05 | Truy cập | Tương phản chữ ≥ 4,5:1 (WCAG AA) |
| NFR-06 | Responsive | Dùng tốt từ 375 px đến 1920 px |
| NFR-07 | Bảo mật | JWT, bcrypt, phân quyền theo vai trò ở cả route và UI |
