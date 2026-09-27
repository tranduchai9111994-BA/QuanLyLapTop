# data/ — Ghi chú nguồn dữ liệu

## Trạng thái hiện tại: dữ liệu tổng hợp CÓ LOGIC (không phải catalog thu thập thật)

`generate_catalog.py` sinh dữ liệu theo các ràng buộc thực tế (không phải random thuần):

- Chỉ ghép CPU–GPU **khả dĩ trên thị trường** (không Apple+RTX, không Celeron+card rời, không
  U-series+RTX 4070/4080).
- Giá = hàm của cấu hình (CPU/GPU/RAM/SSD/màn hình) × hệ số thương hiệu × nhiễu ngẫu nhiên.
- Phân khúc được gán bằng điểm số có trọng số + nhiễu (không phải luật if-else cứng) → phân khúc
  **chồng lấn tự nhiên** giữa các nhóm liền kề (đúng yêu cầu góp ý giảng viên).
- Thương hiệu có `tier` (1–5, uy tín) ảnh hưởng cả giá lẫn cấu hình được phép bán.
- 35% số máy đang giảm giá (`originalPriceVnd` cao hơn `priceVnd` hiện tại, giảm 5–25%),
  `salesCount` tương quan với độ "đáng tiền" + uy tín thương hiệu + có đang giảm giá hay không.
- `series` (dòng máy, vd "Gram Pro", "Legion") được gán SAU KHI đã có nhãn phân khúc, từ đúng
  nhóm dòng máy phù hợp phân khúc đó (tránh lỗi "MSI Prestige" — tên dòng văn phòng — bị gắn nhãn
  Gaming).

Các file:
- `raw/catalog_vn_raw.xlsx` — 1000 dòng, đúng cột theo `docs/03_DU_LIEU_VA_TIEN_XU_LY.md` §2.2.
- `processed/catalog_vn.csv` — bản đã gán `segment`, `discount_percent`/gốc, `sales_count`
  (dùng để huấn luyện Mô hình A và Mô hình B).
- `processed/cpu_benchmark.csv`, `processed/gpu_benchmark.csv` — điểm **PassMark tham chiếu thật**
  (từ kiến thức có sẵn, nhóm nên đối chiếu lại trên cpubenchmark.net/videocardbenchmark.net và ghi
  ngày tra — xem cột "Nguồn tra cứu"/"Ngày tra" trong màn Admin Benchmark CPU/GPU).
- `personas/personas.json` — 30 persona kiểm thử (viết tay, ngân sách theo phân vị thật của
  catalog, không dùng để huấn luyện).
- `need_phrases.json` — 132 câu tiếng Việt viết tay cho Mô hình C (TF-IDF + kNN câu tự do).

**Việc cần làm khi có dữ liệu thật:** thay các file trên bằng catalog thu thập thật từ nhà bán lẻ
(giữ nguyên tên cột/đường dẫn để không phải sửa code phía sau), tính lại Cohen's kappa với 2 người
gán nhãn độc lập.

## Phân bố mẫu theo phân khúc (dữ liệu hiện tại, 1000 dòng)

Xem số liệu cập nhật nhất (đổi mỗi lần `generate_catalog.py` chạy lại) tại
[`../docs/KET_QUA_THUC_NGHIEM.md`](../docs/KET_QUA_THUC_NGHIEM.md) mục 1 — không chép số cố định ở đây để
tránh lệch mỗi lần tái sinh dữ liệu. Mọi lớp đều được sinh ≥ 100 mẫu (vượt xa tiêu chí ≥ 50/lớp).

## Cohen's kappa

Chưa tính được — dữ liệu vẫn là tổng hợp có logic, không phải 2 người gán nhãn độc lập trên dữ
liệu thị trường thật. Mục này bắt buộc phải cập nhật khi thay bằng catalog VN thật thu thập thủ công.

## Kiểm tra chất lượng

Chạy `python -m app.data_check` (từ thư mục `ml-service/`) → xem `ml-service/app/data_check.py`.
