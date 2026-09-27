# 11 — Kịch bản demo và bộ câu hỏi hội đồng

## 1. Chuẩn bị
- Chạy local cả 3 dịch vụ + SQL Server; đã `seed` và `seed:telemetry`.
- Mở sẵn tab: trang chủ, `/admin/models` (Quản lý mô hình), `/admin/feedback` (Phân tích phản hồi),
  `/admin/dashboard` (KPI + cảnh báo), terminal ML service.
- Có sẵn 1 laptop "mới" chưa nhập (thông số ghi giấy) để demo gợi ý phân khúc.

## 2. Kịch bản 10 phút

| Phút | Việc | Lời dẫn chính | Tiêu chí thể hiện |
|---|---|---|---|
| 0–1 | Trang chủ | "Người mua khó quy đổi nhu cầu thành cấu hình; bộ lọc cứng thì trả về 0 hoặc 80 kết quả." | C1 mục tiêu |
| 1–3 | Wizard, chọn "Chưa rõ" + Lập trình, Chơi game; ngân sách 18–22 tr | "Mô hình kNN phân lớp đang so nhu cầu với hàng trăm máy đã gán nhãn — 5/7 láng giềng là Gaming." | C2, trải nghiệm thông minh |
| 3–5 | Kết quả, mở "Vì sao gợi ý?" | "Điểm phù hợp tính từ khoảng cách Euclidean có trọng số; đây là đóng góp của từng đặc trưng." | Giải thích được |
| 5 | Kéo ưu tiên Di động lên 5, chạy lại | "Trọng số đổi → máy nặng tụt hạng. Cùng dữ liệu, khác người dùng, khác kết quả." | Cá nhân hóa |
| 5–6 | 👎 "Quá nặng"; mở Chi tiết → Laptop tương tự | "Phản hồi được ghi lại; máy tương tự dùng kNN item-item." | Telemetry |
| 6–7 | Quản trị → Thêm laptop mới → Gợi ý bằng AI | "Nhân viên không cần tự phân loại; tin cậy thấp thì vào hàng đợi duyệt." | Human-in-the-loop |
| 7–8 | Màn Mô hình: đường cong k, confusion matrix, baseline | "k chọn bằng 5-fold CV theo macro-F1; kNN vượt luật if-else X điểm." | C2 đánh giá |
| 8–9 | Màn Phản hồi: đề xuất tăng trọng số Di động cho Gaming → Áp dụng | "Tri thức mới sinh từ tương tác, con người duyệt trước khi áp dụng." | C3 tạo & ghi đè tri thức |
| 9–10 | Tắt ML service (Ctrl+C), tư vấn lại | "Hệ thống không sập — chế độ dự phòng, dashboard bật cảnh báo." | C3 giảm nhẹ sai lầm |

## 3. Câu hỏi thường gặp và gợi ý trả lời

**H1. kNN là "học lười", vậy "học" ở đâu?**
kNN không ước lượng tham số nhưng vẫn là học có giám sát: tri thức nằm ở tập mẫu có nhãn và các siêu tham số (k, độ đo, cách bỏ phiếu) được chọn từ dữ liệu bằng cross-validation. Nhóm có giai đoạn huấn luyện thật (grid search), có đánh giá trên tập test tách riêng, có phiên bản mô hình.

**H2. Vì sao chọn k = …?**
Chỉ đường cong macro-F1 theo k: k nhỏ thì overfit (train cao, validation thấp), k lớn thì làm mờ ranh giới lớp. Chọn đỉnh validation; hòa thì chọn k lớn hơn cho mượt.

**H3. Không chuẩn hóa thì sao?**
Mở bảng ablation: giá và dung lượng SSD lấn át trọng lượng, macro-F1 giảm rõ. Đây là lý do scaler nằm trong pipeline và có test chặn.

**H4. Nhãn phân khúc ở đâu ra? Có phải nhóm tự đặt luật rồi cho mô hình học lại?**
Không. Nhãn lấy từ danh mục nhà bán lẻ, có kiểm tra độ đồng thuận giữa hai người gán (kappa = …). Dữ liệu tổng hợp chỉ dùng kiểm thử, không dùng huấn luyện. Ngoài ra nhóm chạy lại cùng phương pháp trên dataset Kaggle công khai.

**H5. Vì sao Mô hình A không dùng giá?**
Phân khúc do cấu hình quyết định; giá biến động theo thời gian và khuyến mãi, đưa vào sẽ gây trôi dữ liệu. Giá được dùng ở Mô hình B, nơi nó là nhu cầu của người dùng.

**H6. Lớp Đồ họa ít mẫu xử lý thế nào?**
Dùng macro-F1 thay accuracy, so 3 cách: không xử lý, bỏ phiếu theo khoảng cách, oversampling chỉ trong fold train. Báo cáo recall từng lớp.

**H7. Đánh giá khuyến nghị thế nào khi không có "đáp án đúng"?**
Ba lớp: kiểm tra đồng nhất và leave-one-out segment precision@5 (ngoại tuyến), 30 persona có ràng buộc kiểm chứng được, và tỷ lệ 👍 / tương tác thực tế (trực tuyến).

**H8. Hệ thống tốt lên theo thời gian bằng cách nào?**
Ba đường: máy mới làm giàu tập mẫu ngay (lazy learning), nhãn được nhân viên xác nhận → huấn luyện challenger → so golden test → duyệt, và phản hồi 👎 sinh đề xuất chỉnh trọng số.

**H9. Vì sao không tự động promote mô hình mới?**
Sai lầm của mô hình ảnh hưởng trực tiếp người mua. Quy tắc định lượng lọc trước, con người duyệt sau; có rollback một chạm.

**H10. Sao không dùng collaborative filtering?**
Người mua laptop mua rất thưa (vài năm một lần), ma trận người dùng–sản phẩm cực thưa và gặp vấn đề khởi đầu lạnh. Content-based dùng được ngay từ người dùng đầu tiên. Collaborative là hướng phát triển khi có đủ dữ liệu tương tác.

**H11. Khi catalog lên hàng chục nghìn máy?**
Brute force O(n·d) mỗi truy vấn; chuyển sang KD-tree / Ball-tree hoặc thư viện ANN. Với ~300 máy, brute force < 5 ms.

**H12. Lời nguyền số chiều?**
Chỉ 11–12 đặc trưng liên tục đã chuẩn hóa, không one-hot hãng — khoảng cách vẫn có ý nghĩa phân biệt.

**H13. Điểm "phù hợp 91%" có phải xác suất?**
Không — đó là biến đổi `exp(−d/τ)` của khoảng cách để dễ đọc, τ hiệu chỉnh trên persona. Giao diện ghi "độ phù hợp", không ghi "xác suất".

## 4. Hạn chế nên chủ động nêu
- Catalog nhỏ và là ảnh chụp giá tại thời điểm thu thập.
- Điểm benchmark là một chỉ số tổng hợp, không phản ánh hết tản nhiệt, độ bền, chất lượng bàn phím.
- Ranh giới Gaming – Đồ họa vốn mờ, một máy thực tế có thể thuộc cả hai.
- Phản hồi trong demo phần lớn là giả lập; cần triển khai thật để đo tiêu chí thành công.

**Hướng phát triển:** học trọng số từ phản hồi (metric learning), kết hợp collaborative khi đủ dữ liệu, cập nhật giá tự động qua API đối tác, đa nhãn phân khúc.
