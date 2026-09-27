# Tổng hợp thay đổi trong phiên làm việc này

> File này tóm tắt TẤT CẢ những gì đã sửa/thêm trong phiên làm việc vừa qua (từ sáng đến khi hoàn
> tất), để bạn xem lại nhanh trước khi bảo vệ hoặc commit. Chi tiết đầy đủ hơn (từng gạch đầu dòng,
> đối chiếu từng yêu cầu) nằm ở [CHECKLIST_PHIEN_LAM_VIEC.md](CHECKLIST_PHIEN_LAM_VIEC.md) — file
> này là bản rút gọn, đọc nhanh.

## 1. Bối cảnh: phiên này giải quyết 2 nhóm yêu cầu

**Nhóm A** — 11 yêu cầu kỹ thuật kNN gốc từ giảng viên (khoảng cách một phía, phân khúc chồng
lấn, PassMark thật, giá vào metric xếp hạng, đánh giá P@5/nDCG@5...) — đã hoàn tất từ phần đầu
phiên, số liệu tại [KET_QUA_THUC_NGHIEM.md](KET_QUA_THUC_NGHIEM.md).

**Nhóm B** — 8 góp ý UX/nghiệp vụ bạn liệt kê lại (empty state, bố cục trống, lọc đa điều kiện,
test độ nhạy ưu tiên, form quản lý giá, chuẩn hóa dropdown, tốc độ khởi chạy + logo, snapshot ảnh)
— đã rà lại từng mục, cộng thêm 3 yêu cầu phát sinh giữa phiên: comment code đầy đủ, tài liệu giải
thích kNN, và tính năng khuyến mãi/lượt bán ảnh hưởng xếp hạng.

---

## 2. Tính năng mới quan trọng nhất: Khuyến mãi + lượt bán ảnh hưởng xếp hạng thật

Yêu cầu gốc: *"máy giá gốc cao hơn nhưng đang giảm giá tốt hơn, đang có số lượt bán tốt hơn thì
vẫn có thể sẽ được chọn nhiều hơn"*.

- Thêm 2 cột dữ liệu: `originalPriceVnd` (giá gốc trước giảm) và `salesCount` (lượt bán) —
  schema Prisma, migrate, sinh lại 1000 dòng dữ liệu (35% máy đang giảm giá 5–25%).
- Đưa vào **thẳng metric của kNN Mô hình B** (không phải chỉ hiển thị): nhóm đặc trưng mới
  `"popularity"` trong [ml-service/app/retriever.py](../ml-service/app/retriever.py), trọng số cố
  định 0,12, hướng "càng cao càng tốt, không phạt khi vượt" — đúng tinh thần khoảng cách một phía
  đã áp dụng cho các đặc trưng khác.
- Toàn bộ chuỗi đồng bộ: schema → generator → seed → `features.py` → `retriever.py` →
  `snapshotSync.ts` → `main.py` (ml-service) đều đã cập nhật khớp nhau.
- Giao diện: component dùng chung `DiscountBadge` (giá gốc gạch ngang + % giảm + "Đã bán N")
  hiển thị ở Catalog, Kết quả gợi ý, Chi tiết máy. Form Quản lý giá thêm 2 cột sửa trực tiếp.
- Đã retrain (macro-F1 Model A = 0,787, Model C = 0,7725), chạy 34/34 test pytest pass (gồm 19
  test độ nhạy ưu tiên), chạy `evaluate` lấy số liệu P@5/nDCG@5 mới, và **kiểm thử trực tiếp trên
  browser** toàn bộ luồng (Catalog → Wizard → Kết quả → Chi tiết → Admin Quản lý giá), xác nhận
  qua network log rằng API cập nhật giá/khuyến mãi trả về 200 OK.

## 3. Rà soát và sửa 8 góp ý UX/nghiệp vụ

| # | Góp ý | Đã làm gì |
|---|---|---|
| 1 | Empty state không được để trống | Rà lại toàn bộ trang có thể rỗng: Catalog, Results (đã sửa từ trước), **Detail** (máy tương tự rỗng → nút "Xem toàn bộ danh mục"), **Compare** (chưa chọn máy → nút "Chọn máy trong danh mục"), Wizard (đã có thông báo lỗi từ trước) |
| 2 | Bố cục trống nhiều khoảng | Mở rộng thêm **Compare** (`maxWidth` 1000→1200); xác nhận các trang admin (CrudTable) không bị giới hạn chiều rộng, không cần sửa |
| 3 | Sort → checkbox đa chọn? | **Đã làm đúng yêu cầu gốc** (sau khi bạn xác nhận): chuyển "Sắp xếp" sang checkbox đa chọn, kết hợp được nhiều tiêu chí (thứ tự chọn = ưu tiên), 2 chiều của cùng 1 tiêu chí giá vẫn loại trừ nhau. Backend đổi `sort` sang mảng, dùng `orderBy` đa cấp thật của Prisma. Đã test qua browser + curl xác nhận sắp đa cấp đúng |
| 4 | Test kỹ độ nhạy ưu tiên | 19 test tự động chạy lại sau khi đổi dữ liệu — 19/19 pass |
| 5 | Thiếu form quản lý giá | Đã có từ trước; phiên này mở rộng thêm 2 cột khuyến mãi/lượt bán (mục 2) |
| 6 | Tham số phải load từ danh sách | Rà soát lại kỹ hơn qua CRUD test thật: phát hiện **Hãng máy thiếu hẳn trường `tier`** (mức uy tín) trong cả frontend lẫn backend dù đây là đặc trưng thật của Mô hình B — đã thêm dropdown + validate. Các trường khác (RAM/SSD/màn hình/độ phân giải/tần số quét) đã đúng dropdown từ trước |
| 7 | Tốc độ khởi chạy + logo + khoảng trắng | Đo lại THẬT trong phiên này (không chỉ tin số cũ): 4,27 giây (số cũ 3,8s là lần đo trước phiên này). Logo/khoảng trắng đã có từ trước |
| 8 | Snapshot lại toàn bộ ảnh giao diện | Đã chụp lại 16 ảnh mới (xoá ảnh cũ), sửa script chụp ảnh cho khớp UI dropdown mới, thêm ảnh màn Quản lý giá |

## 3b. CRUD test thật trên browser — phát hiện và sửa 3 lỗi thật

Theo yêu cầu "CRUD lại trên browser theo checklist để đảm bảo hệ thống đang chạy đúng", đã làm cả
thủ công lẫn viết script Playwright tự động
([scripts/capture_crud_test.py](../scripts/capture_crud_test.py)) lưu ảnh bằng chứng từng thao tác
chính vào [crud_test_screenshots/](../crud_test_screenshots/) (16 ảnh). Quá trình này phát hiện và
sửa được **3 lỗi thật đang tồn tại trong code**, không phải giả định:

1. **Hãng máy thiếu trường `tier`** — xem mục 3 bảng trên.
2. **Sửa laptop có sẵn báo "Dữ liệu gửi lên không hợp lệ"** khi trường optional đang `null` (vd
   `batteryWh` — Prisma trả `null` cho cột nullable, nhưng zod `.optional()` chỉ chấp nhận
   `undefined`). Lỗi này ảnh hưởng **bất kỳ laptop nào có trường optional null** — tức là có thể
   ảnh hưởng nhiều bản ghi thật trong catalog. Đã sửa `series`/`batteryWh`/`imageUrl`/`sourceUrl`
   sang `.nullable().optional()` trong `laptopInputSchema` (`backend/src/modules/laptops/laptops.routes.ts`).
3. **"AI gợi ý phân khúc" (tiêu chí 3 của đồ án) báo thiếu dữ liệu dù đã điền đủ** khi TẠO MỚI
   laptop — regression thật từ lúc gộp độ phân giải thành 1 dropdown: `SegmentSuggester.tsx` kiểm
   tra thẳng `resWidth`/`resHeight`, nhưng 2 trường này chỉ có giá trị lúc bấm Lưu. Đã sửa: tự
   tách từ field `resolution` ngay trong hàm `suggest()`.

Cả 3 lỗi đã được xác nhận sửa xong bằng ảnh chụp thật (không chỉ code): AI gợi ý ra "Gaming 71%"
khi tạo máy mới, sửa tên máy có `batteryWh=null` thành công, sửa lượt bán ở Quản lý giá thành công.

## 4. Tài liệu mới

- **[GIAI_THICH_THUAT_TOAN_KNN.md](GIAI_THICH_THUAT_TOAN_KNN.md)** — giải thích kNN từ gốc: lịch
  sử (Fix & Hodges 1951, Cover & Hart 1967), cách người ta giải quyết bài toán trước khi có kNN
  (luật if-else), nguyên tắc cốt lõi, ví dụ tính tay, giải thích cả 3 mô hình (A/B/C) trong đồ án
  kèm trích dẫn file:dòng, và mục lục đọc sâu hơn. File
  [HUONG_DAN_THUAT_TOAN_KNN.md](HUONG_DAN_THUAT_TOAN_KNN.md) (viết từ đầu đồ án) được giữ lại làm
  tham khảo bổ sung, đã thêm cảnh báo ở đầu file về 2 chỗ lỗi thời (không dùng khi bảo vệ).
- **[TAI_KHOAN_DANG_NHAP.md](TAI_KHOAN_DANG_NHAP.md)** — thông tin 3 tài khoản demo
  (admin/staff/khách, mật khẩu `Demo@123`).
- **[CHECKLIST_PHIEN_LAM_VIEC.md](CHECKLIST_PHIEN_LAM_VIEC.md)** — nhật ký chi tiết toàn bộ công
  việc trong phiên, đối chiếu từng yêu cầu, dùng để tự kiểm trước khi báo hoàn tất.
- **[KET_QUA_THUC_NGHIEM.md](KET_QUA_THUC_NGHIEM.md)** — đã cập nhật số liệu mới nhất (sau khi
  thêm khuyến mãi/lượt bán và retrain lần cuối).
- **[scripts/fetch_brand_photos.py](../scripts/fetch_brand_photos.py)** (mới) — tích hợp THẬT API
  DummyJSON để tải ảnh sản phẩm (bạn phát hiện 5 ảnh cũ chỉ được tải tay 1 lần, không có script
  tái tạo được). Đã chạy và xác nhận nội dung file trùng khớp 100% với bản cũ.
- **[scripts/capture_crud_test.py](../scripts/capture_crud_test.py)** (mới) — script Playwright tự
  động CRUD toàn bộ màn quản trị, lưu ảnh bằng chứng từng thao tác vào `crud_test_screenshots/`.
- Đã viết lại toàn bộ file `.md` khác trong repo để khớp thực tế hiện tại: **README.md** gốc (rất
  lỗi thời, còn ghi macro-F1 dữ liệu mô phỏng 315 mẫu cũ), **ml-service/README.md** (số liệu
  0,957/9 test cũ), **frontend/README.md** (còn nguyên template Vite mặc định, chưa từng sửa),
  **data/README.md** (còn ghi tên script/số dòng cũ), **backend/README.md** (bổ sung phần CRUD
  test + 2 lỗi vừa sửa).

## 5. Code đã comment đầy đủ (yêu cầu "để code không ai đọc không hiểu")

Toàn bộ các file lõi thuật toán đã có docstring/comment mức "giải thích LÀM GÌ" (không chỉ "TẠI
SAO"), gồm: `retriever.py`, `classifier.py`, `text_classifier.py`, `features.py`,
`recommend.service.ts`, `price.service.ts`, `main.py` (ml-service), `AdminPrices.tsx`,
`CrudTable.tsx`, `DiscountBadge.tsx` (mới), `Compare.tsx`, `laptops.routes.ts`, `brands.routes.ts`.

## 6. Kiểm tra cuối cùng trước khi commit

- ✅ `npx tsc --noEmit` — backend: sạch, không lỗi (chạy lại nhiều lần sau mỗi lần sửa lỗi CRUD).
- ✅ `npx tsc --noEmit` — frontend: sạch, không lỗi.
- ✅ `pytest -q` (ml-service): 34/34 pass.
- ✅ `python -m app.evaluate`: đã chạy, số liệu đã lưu vào `KET_QUA_THUC_NGHIEM.md` và
  `ml-service/artifacts/evaluation.json`.
- ✅ Retrain Model A + Model C: đã chạy `python -m app.train`, artifact mới nhất được kích hoạt
  tự động (registry).
- ✅ Đã kiểm thử trực tiếp trên browser (không chỉ code, có test tay + script Playwright tự động
  qua UI thật) toàn bộ luồng người dùng + luồng admin, có ảnh bằng chứng lưu file cho từng thao
  tác chính (không chỉ tin lời nói).

## 7. Việc CHƯA làm / hạn chế cần nói rõ khi bảo vệ (trung thực, không giấu)

- Chưa chạy ablation study tách bạch được "khuyến mãi/lượt bán có thực sự cải thiện nDCG@5 hay
  không" một cách có kiểm soát (bật/tắt trên CÙNG một bộ dữ liệu) — số liệu hiện tại chỉ là đo
  trên bộ dữ liệu ĐÃ sinh lại (khác lần đo trước), nên chênh lệch không tách bạch được nguyên nhân
  (xem ghi chú ở [KET_QUA_THUC_NGHIEM.md](KET_QUA_THUC_NGHIEM.md) mục 4.1).
- Dữ liệu vẫn là dữ liệu tổng hợp có logic, không phải catalog thu thập thật từ thị trường.
- Mô hình C (câu tự do) mới có 132 câu huấn luyện — đủ cho demo, chưa đạt quy mô sản phẩm thật.
- "Công sức tìm kiếm" đo bằng code mô phỏng, chưa phải đo thời gian thật trên người dùng.

## 8. Bước tiếp theo (sau file này)

`git add -A && git commit && git push` — theo đúng yêu cầu "sau khi xong toàn bộ push lên git".
Lịch sử commit của phiên (mới nhất trước): `0f7615d` (tính năng khuyến mãi/lượt bán + 8 góp ý UX),
`5b767e3` (đánh dấu checklist), `b3cab4b` (hoàn tất comment code), và commit tiếp theo (sau file
này) cho phần CRUD test + 3 lỗi vừa sửa + cập nhật toàn bộ `.md`.
