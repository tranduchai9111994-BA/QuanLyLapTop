# 01 — Phân tích đề tài và ánh xạ tiêu chí môn học

## 1. Bài toán

Thị trường laptop có hàng trăm mẫu, thông số kỹ thuật dày đặc (CPU, GPU, RAM, SSD, tần số quét, độ phủ màu, trọng lượng, pin). Người mua phổ thông — đặc biệt sinh viên — khó quy đổi "tôi cần máy học lập trình, chơi game nhẹ, dưới 20 triệu" thành cấu hình cụ thể. Nhân viên tư vấn thì mỗi người tư vấn một kiểu, thiếu nhất quán.

**Mục tiêu có ý nghĩa (C1):** giúp người dùng tìm được laptop phù hợp nhu cầu và ngân sách trong dưới 2 phút, với lời giải thích dễ hiểu, và hệ thống tốt dần lên theo phản hồi.

## 2. Vì sao bài toán cần hệ thống thông minh (C1, C3)

Đối chiếu với các dạng bài toán trong slide C1/C3:

| Dạng bài toán (giáo trình) | Thể hiện trong đề tài |
|---|---|
| Vấn đề lớn | Không gian ~300 mẫu × 12 đặc trưng × vô số tổ hợp nhu cầu; luật if-else không bao phủ nổi |
| Vấn đề mở | "Máy phù hợp" không có đáp án duy nhất; phụ thuộc mức ưu tiên từng người |
| Thay đổi theo thời gian | Mẫu mới ra liên tục, giá thay đổi hàng tuần, CPU thế hệ mới đẩy mặt bằng hiệu năng lên |
| Khó nội tại | Ranh giới phân khúc mờ: một máy có thể vừa gaming vừa đồ họa |

Vì sao **không** giải bằng lọc truyền thống: bộ lọc cứng (RAM ≥ 16, giá ≤ 20 tr) trả về hoặc 0 kết quả, hoặc 80 kết quả không xếp hạng. kNN xếp hạng theo **độ gần** với nhu cầu nên luôn trả về các lựa chọn tốt nhất có thể, kể cả khi không máy nào thỏa hoàn toàn.

## 3. Vì sao chọn kNN (C2)

| Tiêu chí | kNN | Ghi chú so sánh |
|---|---|---|
| Có trong danh mục thầy ưu tiên | Có (slide C2 mục "Học máy cổ điển") | |
| Tự nhiên với bài toán khuyến nghị | Rất cao — "tìm sản phẩm gần nhất" chính là kNN | SVM/Naïve Bayes chỉ phân lớp, không xếp hạng |
| Giải thích được | Cao — chỉ ra được các láng giềng và đặc trưng gây khoảng cách | Deep learning khó giải thích |
| Dữ liệu nhỏ (~300 mẫu) | Phù hợp, không cần huấn luyện nặng | Deep learning cần nhiều dữ liệu hơn |
| Cập nhật khi có máy mới | Chỉ cần thêm điểm vào tập, không cần huấn luyện lại tham số | |

Hệ thống dùng kNN theo **hai vai trò**:
- **Mô hình A — kNN phân lớp (`KNeighborsClassifier`)**: gán phân khúc cho laptop mới nhập và suy ra phân khúc từ nhu cầu người dùng. Là học có giám sát đúng nghĩa, đánh giá bằng accuracy / macro-F1.
- **Mô hình B — kNN truy hồi (`NearestNeighbors`)**: tìm top-N laptop gần "hồ sơ lý tưởng" với khoảng cách Euclidean có trọng số. Đây là khuyến nghị dựa trên nội dung (content-based), dạng hybrid theo phân loại của Burke (2002).

## 4. Ánh xạ tiêu chí C0–C4

| Chương | Yêu cầu giáo trình | Thiết kế đáp ứng | File |
|---|---|---|---|
| C1 | Mục tiêu có ý nghĩa | Tìm máy phù hợp < 2 phút, có đo đạc | 01 §1, 09 §6 |
| C1 | Trải nghiệm thông minh | Wizard 3 bước, gợi ý phân khúc, giải thích từng máy, laptop tương tự | 08 §3–5 |
| C1 | Trí tuệ cải thiện theo thời gian qua tương tác | Phản hồi thích/không thích → nhãn mới → huấn luyện lại | 09 §2 |
| C2 | Thuật toán học máy có giám sát | kNN phân lớp, chọn k bằng cross-validation | 04 §3–5 |
| C2 | Khoảng cách Euclidean / Manhattan | So sánh cả hai trong grid search | 04 §4 |
| C2 | Tiền xử lý, chuẩn hóa | StandardScaler, log, one-hot trong Pipeline | 03 §5 |
| C2 | Đánh giá mô hình | Tách train/test phân tầng, confusion matrix, baseline | 04 §6 |
| C3 | Quy trình xây dựng | 7 giai đoạn có tiêu chí nghiệm thu | 10 |
| C3 | Giám sát tiêu chí thành công | Dashboard KPI + cảnh báo ngưỡng | 09 §6 |
| C3 | Kiểm tra các tương tác (telemetry) | `RecommendationSession`, `InteractionEvent` | 05, 09 §5 |
| C3 | Cân bằng trải nghiệm | Ngưỡng tin cậy: dưới 0,6 thì hỏi lại thay vì khẳng định | 04 §7, 09 §3 |
| C3 | Ghi đè tri thức | Admin khóa nhãn, ghim / loại máy, chỉnh trọng số mặc định | 09 §3 |
| C3 | Tạo tri thức mới | Nhãn admin xác nhận + phản hồi → tập huấn luyện mới | 09 §2 |
| C3 | Giảm nhẹ sai lầm | Chế độ dự phòng khi ML lỗi, rollback phiên bản mô hình | 09 §4 |
| C4 | Phát triển ứng dụng | Kiến trúc 3 dịch vụ, API contract, frontend AntD | 06, 07, 08 |

## 5. Nhật ký quyết định

| Mã | Quyết định | Lý do | Phương án loại | Tiêu chí |
|---|---|---|---|---|
| D-01 | kNN hai vai trò (phân lớp + truy hồi) | Theo lựa chọn của nhóm; phân lớp cho chỉ số đánh giá rõ ràng, truy hồi là lõi khuyến nghị | Chỉ truy hồi (thiếu chỉ số có giám sát để bảo vệ) | C2 |
| D-02 | **Nguồn dữ liệu kết hợp** (xem 03 §1): catalog thị trường VN tự thu thập làm dữ liệu chính, Kaggle Laptop Prices làm thực nghiệm đối chứng, dữ liệu tổng hợp chỉ dùng cho kiểm thử persona và giả lập tương tác | Nhãn phân khúc lấy từ danh mục nhà bán lẻ → khách quan, không do nhóm tự đặt luật; cùng miền với demo | Chỉ Kaggle: máy đời 2015–2018, giá EUR, lệch miền. Chỉ dữ liệu tổng hợp: hội đồng hỏi "mô hình học lại luật của nhóm à?" | C2, C3 |
| D-03 | 4 phân khúc: Văn phòng – Học tập, Mỏng nhẹ – Di động, Gaming, Đồ họa – Kỹ thuật | Khớp danh mục của các nhà bán lẻ VN; tách Mỏng nhẹ vì trọng lượng/pin là nhu cầu phổ biến. Nếu thiếu dữ liệu, gộp Mỏng nhẹ vào Văn phòng (3 lớp) | 3 lớp cứng | C2 |
| D-04 | Mô hình A **không** dùng giá làm đặc trưng | Phân khúc do cấu hình quyết định; giá biến động theo thời gian gây trôi dữ liệu | Có giá | C2, C3 |
| D-05 | Tách train/test **phân tầng ngẫu nhiên** (stratified), không tách theo thời gian | Dữ liệu là danh mục sản phẩm, không phải chuỗi thời gian. (Khác đề tài kho đồ uống — ở đó dùng tách theo thời gian là đúng) | Tách theo thời gian | C2 |
| D-06 | Khoảng cách Euclidean có trọng số theo mức ưu tiên người dùng | Mỗi người ưu tiên khác nhau; cài bằng cách nhân cột với √w nên vẫn dùng được `NearestNeighbors` chuẩn | Cosine (mất thông tin độ lớn, không hợp đặc trưng giá) | C2 |
| D-07 | Ngưỡng tin cậy 0,6 cho Mô hình A | Dưới ngưỡng → gắn "Cần xác minh", người duyệt quyết định | Luôn tự gán | C3 |
| D-08 | Chuyển phiên bản mô hình phải có người bấm duyệt | An toàn, đúng tinh thần ghi đè tri thức | Tự động promote | C3 |
| D-09 | Giao diện sáng xanh dương – trắng, font Be Vietnam Pro | Công nghệ, tin cậy; font hiển thị dấu tiếng Việt chuẩn | Dark mode mặc định | C4 |

## 6. Phạm vi

**Trong phạm vi:** tư vấn theo nhu cầu, danh mục, so sánh, laptop tương tự, yêu thích, phản hồi, quản trị laptop / benchmark / mô hình / tri thức, dashboard.
**Ngoài phạm vi:** đặt hàng, thanh toán, tồn kho, cào dữ liệu tự động từ website bán lẻ.
