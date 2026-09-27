# Checklist & tổng hợp thay đổi các phiên làm việc

> File **duy nhất** theo dõi mọi yêu cầu đã giao và những gì đã thay đổi (trước đây tách thành 2
> file `CHECKLIST_PHIEN_LAM_VIEC.md` + `TONG_HOP_THAY_DOI_PHIEN_NAY.md` bị trùng nội dung — đã
> gộp). Chỉ đánh dấu ✅ khi đã làm **và** đã kiểm thử thật, không chỉ viết code.
>
> Số liệu thực nghiệm (macro-F1, nDCG@5…) và hạn chế của đồ án **không chép lại ở đây** — nguồn
> duy nhất là [KET_QUA_THUC_NGHIEM.md](KET_QUA_THUC_NGHIEM.md).

## 1. Trạng thái tổng quan

| Nhóm | Số mục | Trạng thái |
|---|---|---|
| Yêu cầu kỹ thuật kNN gốc từ giảng viên | 14 | ✅ tất cả |
| Góp ý UX / nghiệp vụ và yêu cầu phát sinh | 16 | ✅ tất cả |
| Lỗi thật phát hiện qua kiểm thử & rà soát code | 13 | ✅ đã sửa tất cả |
| Kiểm tra cuối (tsc, pytest, browser, ảnh chụp) | — | ✅ sạch |

**Không còn mục tồn đọng.**

## 2. Yêu cầu kỹ thuật kNN gốc (từ giảng viên)

- [x] 1. Ô nhập nhu cầu bằng câu tự do (Mô hình C: TF-IDF + kNN)
- [x] 2. Sinh lại dữ liệu ~1000 dòng có logic (không random thuần)
- [x] 3. Bỏ cặp CPU–GPU không thể có trên thị trường
- [x] 4. Giá phụ thuộc cấu hình + thương hiệu + nhiễu
- [x] 5. Phân khúc chồng lấn tự nhiên
- [x] 6. Dùng điểm PassMark thật
- [x] 7. kNN là lõi (không phải luật if-else) — vượt baseline luật, xem KET_QUA mục 2
- [x] 8. Hàm khoảng cách một phía (không phạt máy mạnh hơn/rẻ hơn nhu cầu)
- [x] 9. Giá nằm trong metric xếp hạng của kNN
- [x] 10. Thuộc tính uy tín thương hiệu (`brand_tier`)
- [x] 11. Bỏ lọc cứng phân khúc → lọc mềm
- [x] 12. Match % dùng mốc cố định (so sánh được giữa các lần truy vấn)
- [x] 13. Tiêu chí 3: máy mới tự gán nhãn + học từ phản hồi
- [x] 14. Đánh giá P@5/nDCG@5 so baseline + đo công sức tìm kiếm

Giải thích chi tiết từng mục: [GIAI_THICH_THUAT_TOAN_KNN.md](GIAI_THICH_THUAT_TOAN_KNN.md).

## 3. Góp ý UX / nghiệp vụ và yêu cầu phát sinh

| # | Yêu cầu | Đã làm | Bằng chứng |
|---|---|---|---|
| 1 | Không để trạng thái rỗng "cụt lủn" | Catalog, Results, Detail (máy tương tự), Compare đều nêu rõ lý do + nút hành động; Wizard có thông báo lỗi | ảnh `09b_danh_muc_rong`, `09c_so_sanh_rong` |
| 2 | Bố cục thừa khoảng trắng | Mở rộng Home/Catalog/Results/Detail/Compare (1200–1400px), Wizard sang 2 cột; trang admin đã full-width | ảnh `screenshots/` |
| 3 | "Sắp xếp" cho chọn nhiều để kết hợp | Checkbox đa chọn, thứ tự chọn = ưu tiên; 2 chiều cùng tiêu chí giá loại trừ nhau; backend sắp đa cấp thật (Prisma `orderBy` mảng) | curl + browser, ảnh `08_danh_muc` |
| 4 | Test kỹ độ nhạy mức ưu tiên | 19 ca test tự động (4 nhóm × 4 phân khúc + 81 tổ hợp cực trị) | `pytest` |
| 5 | Form quản lý giá (giá nhà cung cấp thay đổi) | Lịch sử giá + biểu đồ, điều chỉnh hàng loạt % có xem trước, lọc theo dòng máy (`series`), khuyến mãi, lượt bán | ảnh `12b_quan_ly_gia_khuyen_mai`, `crud_test_screenshots/15-16` |
| 6 | Tham số chuẩn phải chọn từ danh sách | RAM/SSD/màn hình/độ phân giải/tần số quét/mức uy tín hãng là dropdown; backend validate lại bằng zod | CRUD test |
| 7 | Khởi chạy chậm, thiếu logo | Chạy song song 3 dịch vụ, đo lại thật **4,27 giây**; logo ở header/sidebar/favicon/icon Desktop | đo bằng Stopwatch |
| 8 | Chụp lại toàn bộ ảnh giao diện | 19 ảnh chức năng (`screenshots/`) + 16 ảnh bằng chứng CRUD (`crud_test_screenshots/`) | 2 script chụp ảnh |
| 9 | Comment code đầy đủ để đọc hiểu ngay | Toàn bộ FE (~30 file) và BE (~25 file) + ml-service có docstring/comment mức "làm gì" | `git log b3cab4b`, `b542d25` |
| 10 | Khuyến mãi + lượt bán ảnh hưởng xếp hạng | `discount_percent`/`sales_score` là đặc trưng thật trong metric Mô hình B (nhóm `popularity`, trọng số 0,12); hiển thị giá gạch ngang/% giảm/"Đã bán N" | KET_QUA mục 4.4 |
| 11 | File giải thích kNN đầy đủ | [GIAI_THICH_THUAT_TOAN_KNN.md](GIAI_THICH_THUAT_TOAN_KNN.md): lịch sử, nguyên lý, ví dụ tính tay, 3 mô hình kèm `file:dòng`, cách kiểm tra, hỏi đáp bảo vệ | — |
| 12 | File lưu tài khoản đăng nhập | [TAI_KHOAN_DANG_NHAP.md](TAI_KHOAN_DANG_NHAP.md) | — |
| 13 | Ảnh sản phẩm thật qua API mẫu | [scripts/fetch_brand_photos.py](../scripts/fetch_brand_photos.py) gọi thật DummyJSON (API chỉ có đúng 5 laptop → 5 hãng có ảnh thật, 7 hãng còn lại dùng minh hoạ) | chạy lại script, nội dung trùng khớp |
| 14 | CRUD lại toàn bộ trên browser | Thủ công + script Playwright [scripts/capture_crud_test.py](../scripts/capture_crud_test.py) lưu ảnh từng thao tác; phát hiện 3 lỗi (xem mục 4) | `crud_test_screenshots/` |
| 15 | Cập nhật toàn bộ file `.md` cho khớp thực tế | Viết lại README và 4 README thành phần (trước đó còn số liệu mô phỏng cũ, frontend còn template Vite) | — |
| 16 | Gom `.md` vào `docs/`, bỏ trùng lặp | Sửa toàn bộ link tương đối sau khi chuyển; gộp 2 tài liệu kNN thành 1, gộp checklist + tổng hợp thành file này | — |

## 4. Lỗi thật phát hiện qua kiểm thử & rà soát (đều đã sửa)

| Lỗi | Hậu quả nếu không sửa | Cách sửa |
|---|---|---|
| sklearn gọi `metric(q, x)` ngược thứ tự công thức một phía | Hệ thống ưu tiên máy **yếu hơn** thay vì mạnh hơn | Đảo tham số trong `make_one_sided_metric`; thêm test chặn tái phát |
| Tên dòng máy gán **trước** nhãn phân khúc khi sinh dữ liệu | "MSI Prestige" (dòng văn phòng) bị gắn nhãn Gaming | Gán phân khúc trước, chọn tên dòng theo phân khúc |
| Chuẩn hoá câu tự do xoá dấu `.` giữa 2 chữ số | "1.4kg" đọc thành "1 4kg" | Chỉ xoá `.`/`,` khi không nằm giữa 2 chữ số |
| Nhiễu gán nhãn quá lớn khi sinh dữ liệu | Macro-F1 Mô hình A tụt xuống 0,665 (< 0,75) | Giảm nhiễu, thêm số hạng phạt cân nặng cho OFFICE |
| Route tĩnh `/price-changes` khai báo sau `/:id` | Express hiểu "price-changes" là id → lỗi | Khai báo route tĩnh trước |
| Lấy biến động giá theo N bản ghi mới nhất toàn cục | Danh sách biến động giá luôn rỗng | Lấy 2 bản ghi cuối theo **từng máy** |
| Truy vấn gợi ý thiếu `include: brand` | Thẻ kết quả hiện "LAP" thay vì tên hãng | Thêm `brand` vào `include` |
| Ảnh sản phẩm chỉ tải tay 1 lần, không có script | Không kiểm chứng/tái tạo được nguồn gốc ảnh | Viết script gọi thật API |
| Màn Hãng máy thiếu trường `tier` (cả FE lẫn BE) | Không chỉnh được đặc trưng `brand_tier` của Mô hình B | Thêm dropdown + validate zod |
| zod `.optional()` không nhận `null` từ cột nullable | Sửa laptop có `batteryWh = null` bị từ chối | Dùng `.nullable().optional()` |
| "AI gợi ý phân khúc" đọc `resWidth/resHeight` (chỉ có khi bấm Lưu) | Tính năng tiêu chí 3 luôn báo thiếu dữ liệu khi thêm máy mới | Tách từ field `resolution` ngay khi gợi ý |
| Nút ở Detail/Compare điều hướng tới `/catalog` (route thật là `/laptops`) | Bấm vào ra trang trắng | Sửa đường dẫn, test lại trên browser |
| `GIAI_THICH_THUAT_TOAN_KNN.md` trích sai code pipeline Mô hình A và ghi Mô hình A dùng giá | Tài liệu bảo vệ sai so với code thật | Sửa theo code thật khi gộp tài liệu |

## 5. Kiểm tra cuối

- ✅ `npx tsc --noEmit` backend + frontend: sạch
- ✅ `pytest` ml-service: 34/34 pass
- ✅ Retrain + `python -m app.evaluate`: số liệu mới nhất đã lưu vào KET_QUA_THUC_NGHIEM.md
- ✅ Browser: luồng khách hàng (Trang chủ → Wizard → Kết quả → Chi tiết → So sánh → Danh mục) và
  luồng quản trị (Hãng máy, Benchmark, Laptop, Quản lý giá) đều chạy đúng, có ảnh bằng chứng
- ✅ Đã push lên `origin/main`

## 6. Lịch sử commit (mới nhất trước)

| Commit | Nội dung |
|---|---|
| `b542d25` | Comment code FE+BE đầy đủ, sửa 2 lỗi điều hướng, sửa link sau khi chuyển `.md` vào `docs/` |
| `7ec1dc1` | Sắp xếp Catalog chuyển sang checkbox đa chọn, bổ sung ảnh trạng thái rỗng |
| `7f78e47` | CRUD test thật trên browser, sửa 3 lỗi, viết lại các README |
| `b3cab4b` | Hoàn tất comment code 4 file còn thiếu |
| `a176785` | Script tích hợp thật API DummyJSON |
| `0f7615d` | Khuyến mãi/lượt bán vào kNN, 8 góp ý UX, tài liệu kNN |
| `db42fec` | Tích hợp câu tự do (Mô hình C) vào UI, tiêu chí 3, báo cáo thực nghiệm |
| `196353c` | Dữ liệu 1000 dòng có logic, Mô hình C, metric một phía |

## 7. Ghi chú để không lặp lỗi

- Route Express: route **tĩnh** phải khai báo **trước** route động `/:id`.
- Đổi Prisma schema: `migrate dev` → `seed --reset` → restart ML service + backend (thiếu bước nào
  cũng ra dữ liệu lệch giữa DB và ML service).
- Nút "Xóa" trong quản trị là **xóa mềm** (`isActive = false`) — SKU cũ vẫn chiếm chỗ, không tạo lại
  được máy mới trùng SKU.
- Cột nullable trong Prisma trả về `null` → schema zod phải dùng `.nullable().optional()`.
- Ảnh trong `screenshots/` là sản phẩm bàn giao — chụp **lại** mỗi khi giao diện đổi
  (`python scripts/capture_screenshots.py`).
- Đường dẫn trong code (`navigate(...)`) phải khớp route khai báo trong `App.tsx`.
