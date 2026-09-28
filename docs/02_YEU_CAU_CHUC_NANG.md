# 02 — Yêu cầu chức năng

## 1. Tác nhân

| Tác nhân | Mô tả | Quyền chính |
|---|---|---|
| Khách (chưa đăng nhập) | Người mua tìm máy | Tư vấn, xem danh mục, so sánh, gửi phản hồi ẩn danh |
| Khách hàng (đã đăng nhập) | Như trên + lưu | Yêu thích, lịch sử tư vấn |
| Nhân viên tư vấn (`STAFF`) | Dùng hệ thống tư vấn tại cửa hàng, đăng nhập ở `/admin/login` | Tư vấn hộ khách, xem/nhập/sửa laptop, hãng máy, benchmark CPU/GPU, quản lý giá, duyệt hàng đợi nhãn phân khúc (không sửa được benchmark/hãng máy — các thao tác ghi ở đây chỉ `ADMIN`) |
| Quản trị viên (`ADMIN`) | Vận hành hệ thống, đăng nhập ở `/admin/login` | Tất cả quyền của Staff + Dashboard, quản lý mô hình, cấu hình tri thức, phân tích phản hồi, quản lý người dùng & nhật ký hệ thống |

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
| UC-10 | Duyệt hàng đợi nhãn "Cần xác minh", khóa nhãn | Staff, Admin | ✅ (human-in-the-loop) |
| UC-11 | Quản lý danh mục kỹ thuật: hãng máy, bảng benchmark CPU / GPU | Staff (xem), Admin (sửa) | |
| UC-12 | Xem chỉ số mô hình, huấn luyện lại, duyệt / rollback phiên bản (champion/challenger) | Admin | ✅ |
| UC-13 | Cấu hình tri thức: trọng số mặc định, ghim / loại máy, ngưỡng | Admin | ✅ (ghi đè tri thức) |
| UC-14 | Dashboard giám sát + cảnh báo | Admin | ✅ |
| UC-15 | Xem phân tích phản hồi | Admin | ✅ |
| UC-16 | Quản lý người dùng, nhật ký | Admin | |
| UC-17 | Quản lý giá: sửa giá nhanh từng máy, xem lịch sử biến động, điều chỉnh giá hàng loạt theo % | Staff, Admin | |

## 3. Yêu cầu chức năng chi tiết

### FR-01 Wizard nhu cầu (UC-01)
- Ô mô tả nhu cầu bằng **câu tự do** (vd "mình học lập trình với xem phim, ngân sách khoảng 20 triệu") ở đầu wizard: Mô hình C (TF-IDF + kNN phân loại câu nhu cầu) đọc câu, tự điền sẵn hoạt động, ngân sách, mức ưu tiên vào các bước bên dưới; người dùng vẫn sửa lại được các trường đã điền.
- Bước 1 — Mục đích: chọn 1 trong 4 phân khúc **hoặc** "Chưa rõ, hãy gợi ý giúp tôi" (+ ô chọn nhiều hoạt động: văn phòng/soạn thảo, học tập, lập trình, chơi game, đồ họa/thiết kế, dựng video, di chuyển nhiều, xem phim/giải trí).
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
- Độ tin cậy < ngưỡng → tự vào hàng đợi "Cần xác minh" (UC-10).
- Cờ **"Khóa nhãn"**: khi bật, lần sửa laptop tiếp theo sẽ giữ nguyên nhãn đã duyệt thay vì để Mô hình A gán đè lại.

### FR-10 Duyệt hàng đợi nhãn "Cần xác minh" (UC-10)
- Danh sách máy có nhãn `NEEDS_REVIEW`, sắp xếp máy chờ lâu nhất lên trước, kèm xác suất từng phân khúc và độ tin cậy.
- Nhân viên/Admin giữ nguyên hoặc đổi sang phân khúc khác, có thể bật cờ "Khóa nhãn" khi duyệt.
- Sau khi duyệt, danh sách gợi ý (snapshot cho ML service) được đồng bộ lại ngay.

### FR-11 Quản lý danh mục kỹ thuật (UC-11)
- **Hãng máy**: thêm/sửa/xóa hãng, kèm chỉ số uy tín (`tier`, 1–5) — là một đặc trưng thật của Mô hình B.
- **Benchmark CPU / GPU**: thêm/sửa/xóa dòng chip kèm điểm PassMark đã quy đổi (0–100) và nguồn tra cứu — đầu vào của `cpu_score`/`gpu_score` cho cả Mô hình A và B.
- Xem (GET) không cần đăng nhập hoặc chỉ cần Staff/Admin tùy màn; thêm/sửa/xóa chỉ `ADMIN`.

### FR-12 Quản lý mô hình — vòng đời champion/challenger (UC-12)
- Danh sách phiên bản Mô hình A: trạng thái (Đang dùng / Ứng viên / Lưu trữ), tham số huấn luyện, macro-F1, accuracy, ngày huấn luyện.
- Chi tiết: confusion matrix, đường cong F1 theo k, bảng so sánh baseline, precision/recall từng lớp.
- Nút "Huấn luyện lại" (tạo phiên bản "Ứng viên" mới, không thay thế mô hình đang chạy), "Duyệt đưa vào sử dụng" (chỉ chấp nhận nếu macro-F1 trên tập test không thấp hơn phiên bản đang dùng quá 0,02 **và** F1 từng lớp ≥ 0,5 — không đạt thì bị từ chối kèm lý do), "Quay lại phiên bản trước" (rollback về bất kỳ phiên bản nào từng là "Đang dùng").

### FR-13 Cấu hình tri thức (UC-13)
Sửa được ngay qua UI, không cần deploy lại, gồm 4 tab:
- **Ghim / Cấm máy**: ghim máy (luôn xuất hiện nếu thỏa ràng buộc, tối đa 1 vị trí trong top) hoặc cấm máy (không bao giờ gợi ý) cho từng phân khúc, có lý do và ngày hết hạn tùy chọn.
- **Ngưỡng & mặc định**: ngưỡng tin cậy phân loại, số kết quả gợi ý mặc định, tỷ lệ nới ngân sách khi không đủ máy.
- **Trọng số theo phân khúc**: trọng số mặc định từng nhóm đặc trưng (hiệu năng, di động, màn hình, giá…) áp cho từng phân khúc trong Mô hình B.
- **Ngưỡng cảnh báo**: ngưỡng của cả 6 luật cảnh báo Dashboard (FR-14).

### FR-14 Dashboard (UC-14)
- KPI 30 ngày gần nhất: lượt tư vấn, tỷ lệ hài lòng (👍 / (👍+👎)), độ trễ trung bình, độ trễ p95 (đối chiếu NFR-01 < 800 ms), tỷ lệ dùng chế độ dự phòng, số nhãn đang chờ xác minh, tổng số phản hồi.
- Danh sách cảnh báo đang mở + nút "Quét ngay" để chạy lại 6 luật cảnh báo thủ công, và nút đánh dấu "Đã xử lý".
- 6 luật cảnh báo tự động (chạy định kỳ hằng giờ, cửa sổ 7 ngày trừ khi ghi chú khác): `LOW_SATISFACTION` (tỷ lệ hài lòng dưới ngưỡng), `FALLBACK_HIGH` (tỷ lệ dùng chế độ dự phòng vượt ngưỡng, cửa sổ 24 giờ), `LATENCY_HIGH` (độ trễ p95 vượt ngưỡng), `LOW_CONFIDENCE_RATE` (tỷ lệ máy mới nhập trong 30 ngày có độ tin cậy phân khúc thấp), `REVIEW_BACKLOG` (số nhãn chờ xác minh vượt ngưỡng), `RANK1_WEAK` (máy xếp hạng #1 có tỷ lệ thích thấp hơn các hạng còn lại — dấu hiệu trọng số Mô hình B cần xem lại). Ngưỡng của cả 6 luật chỉnh được qua Cấu hình tri thức (FR-13).

### FR-17 Quản lý giá (UC-17)
- Sửa nhanh giá bán, giá gốc (khuyến mãi) và lượt bán của từng máy ngay trong bảng, không cần mở form sửa laptop đầy đủ.
- Xem lịch sử biến động giá của từng máy (biểu đồ) và bảng "Biến động giá gần đây" toàn hệ thống.
- Điều chỉnh giá **hàng loạt** theo phần trăm (tăng/giảm), lọc theo hãng và/hoặc phân khúc, có chế độ xem trước (dry run) trước khi áp dụng thật.
- Mỗi lần đổi giá đều được ghi vào lịch sử giá (`PriceHistory`) và đồng bộ ngay sang ML service.

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
