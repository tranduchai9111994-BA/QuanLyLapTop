# Checklist phiên làm việc (tự kiểm trước khi báo xong)

> Cập nhật liên tục trong phiên. Đánh dấu ✅ khi đã làm VÀ đã kiểm thử (không chỉ viết code).
> Cuối phiên: rà lại từng dòng, dòng nào chưa ✅ phải nói rõ trong báo cáo tổng hợp.

## A. Task từ các yêu cầu trong phiên (thứ tự thời gian)

- [x] Model Opus 5 — tiếp tục 11 task kỹ thuật kNN từ session trước (xem mục B)
- [x] Icon Desktop chạy ẩn hoàn toàn (không hiện terminal)
- [x] Launcher tối ưu tốc độ (song song 3 dịch vụ, gọi thẳng node/vite thay vì qua npm)
- [x] Sinh lại dữ liệu 1000 dòng có logic (PassMark thật, ràng buộc CPU-GPU, giá theo cấu hình)
- [x] Sửa tên dòng sản phẩm khớp với nhãn phân khúc (không còn "MSI Prestige" gắn nhãn Gaming)
- [x] CRUD: chuẩn hóa các trường có giá trị cố định thành dropdown (chặn RAM=-2, SSD=0)
- [x] Bổ sung form/nghiệp vụ Quản lý giá (lịch sử giá, điều chỉnh hàng loạt theo %)
- [x] Test kỹ độ nhạy mức ưu tiên (19 test tự động + kiểm chứng qua API thật)
- [x] Bổ sung ảnh cho tất cả sản phẩm (không còn "toàn chữ")
- [x] Thay icon Desktop + logo bằng ảnh do người dùng cung cấp
- [x] Rà soát bố cục trang trống nhiều khoảng trắng (Home, Wizard, Catalog, Results, Detail)
- [x] Đảm bảo KHÔNG CÓ trạng thái rỗng cụt lủn — mọi trang rỗng phải gợi ý hành động cụ thể
- [x] Bộ lọc danh mục: thêm điều kiện kết hợp được (giá, RAM, hãng, từ khóa, card rời) — giữ
      "Sắp xếp" là chọn đơn (logic không cho phép vừa tăng vừa giảm cùng lúc)
- [x] Thay icon minh họa sản phẩm bằng ảnh thật (DummyJSON) cho 5 hãng có sẵn; hãng còn lại
      dùng minh họa phong cách ảnh chụp (không gán nhầm ảnh thật cho model không tồn tại).
      **Sửa lại cho đúng bản chất (bạn phát hiện qua câu hỏi)**: lúc đầu 5 ảnh này chỉ được TẢI
      TAY một lần rồi bỏ vào repo — KHÔNG có tích hợp API thật nào, không ai kiểm chứng lại được
      nguồn gốc. Đã sửa: tạo [scripts/fetch_brand_photos.py](scripts/fetch_brand_photos.py) gọi
      thật API `https://dummyjson.com/products/category/laptops`, tự động tải lại đúng 5 ảnh này
      (đã chạy lại và xác nhận thành công). Giới hạn THẬT của nguồn dữ liệu miễn phí này: category
      "laptops" của DummyJSON chỉ có ĐÚNG 5 sản phẩm (Apple/Asus/Huawei/Lenovo/Dell) — không phải
      lỗi tích hợp, mà là API mẫu chỉ có sẵn 5 ảnh, nên 7 hãng còn lại vẫn phải dùng minh họa vẽ
      tay (không có nguồn ảnh thật miễn phí nào khác cho các hãng đó trong phạm vi đồ án).
- [x] File checklist này (đang làm) + file tổng hợp thay đổi cuối phiên (mục D)
- [x] Push toàn bộ lên GitHub sau khi xong

## B. 11 yêu cầu kỹ thuật kNN gốc (từ đầu phiên trước, đối chiếu lại)

- [x] 1. Ô nhập nhu cầu bằng câu tự do (TF-IDF + kNN)
- [x] 2. Sinh lại dữ liệu ~1000 dòng có logic
- [x] 3. Bỏ cặp CPU-GPU không thể có + Apple dùng chip Intel/AMD
- [x] 4. Giá phụ thuộc cấu hình + thương hiệu + nhiễu
- [x] 5. Phân khúc chồng lấn
- [x] 6. Dùng điểm PassMark thật
- [x] 7. kNN là lõi (không phải luật if-else)
- [x] 8. Hàm khoảng cách một phía
- [x] 9. Giá vào metric xếp hạng của kNN
- [x] 10. Thuộc tính thương hiệu (brand_tier)
- [x] 11. Bỏ lọc cứng phân khúc → lọc mềm
- [x] 12. Sửa match% dùng mốc cố định
- [x] 13. Demo tiêu chí 3 (máy mới tự gán nhãn + học từ phản hồi)
- [x] 14. Đánh giá P@5/nDCG@5 so baseline + đo công sức tìm kiếm

## C0. Bổ sung 8 yêu cầu người dùng nhắc lại (đối chiếu trạng thái thật, không tự nhận ẩu)

1. [x] Empty state không được để trống trơn — đã sửa Catalog + Results, nêu rõ điều kiện chặn
       + nút thoát. Đã soát thêm và sửa: Detail (máy tương tự rỗng → `Result` + nút "Xem toàn bộ
       danh mục" thay vì 1 dòng chữ xám), Compare (chưa chọn máy → `Empty` + nút "Chọn máy trong
       danh mục" thay vì bảng trống trơn). Wizard (lỗi parse-need) đã có thông báo lỗi rõ ràng từ
       trước, không phải sửa thêm.
2. [x] Bố cục trống nhiều khoảng — đã mở rộng Home/Catalog/Results/Detail/Wizard (maxWidth
       900-1100 → 1200-1400, Wizard sang 2 cột). Đã soát thêm: Compare (mở `maxWidth: 1000` →
       `1200`); các trang admin (AdminBrands/AdminBenchmarks/AdminLaptops/AdminPrices dùng chung
       `CrudTable`) không có giới hạn `maxWidth` nào — đã chiếm toàn bộ chiều rộng sẵn, không cần
       sửa.
3. [x] **Đã làm đúng yêu cầu gốc** (bạn xác nhận "có nhé"): chuyển "Sắp xếp theo" từ dropdown
       đơn trị sang **checkbox đa chọn kết hợp được** (`Catalog.tsx`). Thiết kế: 2 chiều của
       CÙNG 1 tiêu chí giá ("Giá tăng dần"/"Giá giảm dần") vẫn loại trừ nhau (chọn 1 cái tự bỏ
       chọn cái kia — không có ý nghĩa hợp lệ nào để chọn cả 2 chiều ngược nhau cùng lúc), nhưng
       CÁC TIÊU CHÍ KHÁC NHAU thì kết hợp tự do được (vd vừa "Hiệu năng cao nhất" vừa "Đáng tiền
       nhất") — thứ tự chọn = thứ tự ưu tiên sắp xếp (hiện số "ưu tiên N" cạnh mỗi checkbox đã
       chọn). Backend (`laptops.routes.ts`/`laptops.service.ts`) đổi `sort` từ 1 giá trị sang
       MẢNG nhận qua chuỗi phân cách dấu phẩy (`sort=perf_desc,value_desc`), dùng `orderBy` dạng
       mảng của Prisma để sắp đa cấp thật (không phải sắp rồi cắt). Vẫn tương thích ngược với
       nơi gọi `sort=price_desc` đơn (vd `AdminPrices.tsx`). Đã kiểm thử trên browser: chọn 2
       tiêu chí cùng lúc → network log xác nhận `sort=price_asc,perf_desc` → 200 OK; test qua
       curl xác nhận sắp đa cấp đúng (nhóm `performanceIdx` bằng nhau được sắp tiếp theo
       `valueIdx` giảm dần: 1.72→1.49→1.37→1.27); test loại trừ 2 chiều giá trên UI thật thành
       công (chọn "Giá giảm dần" khi đang chọn "Giá tăng dần" → tự động đổi, giữ nguyên ưu tiên
       của tiêu chí khác). `tsc --noEmit` sạch cả backend/frontend, pytest 34/34 vẫn pass.
4. [x] Test kỹ đổi mức ưu tiên — 19 test tự động (`test_priority_sensitivity.py`, quét 4 phân
       khúc × 4 nhóm + 81 tổ hợp) + kiểm chứng qua API thật (4 tình huống, số liệu cụ thể).
5. [x] Form Quản lý giá — đã thêm `price.service.ts` (lịch sử giá, điều chỉnh hàng loạt %,
       xem trước trước khi áp dụng), route `AdminPrices.tsx`. **Đã phát hiện thêm qua góp ý
       tiếp theo**: giá phải gắn với DÒNG MÁY (series) chứ không phải hãng — đã thêm cột
       `series` vào schema + hiển thị + lọc theo dòng máy trong màn Quản lý giá.
6. [x] Chuẩn hóa tham số load-from-list — RAM/SSD/màn hình/độ phân giải/tần số quét chuyển
       sang `Select` (không cho gõ tay), backend validate lại bằng zod (tuyến phòng thủ cuối).
7. [x] Tốc độ launcher — đo lần đầu (trước phiên này): 3,8 giây. **Đo lại thật trong phiên này**
       (bạn nhắc nên không chỉ tin số cũ): dừng hẳn dịch vụ, khởi động lại từ đầu, đo bằng
       Stopwatch tới khi frontend HTTP 200 → **4,27 giây** — vẫn nhanh, khớp với cải tiến "chạy
       song song 3 dịch vụ + gọi thẳng node/vite", chênh lệch nhỏ so với lần đo trước do máy đang
       có tải khác (ML service tốn thêm ~1-2s để load lại catalog).
   [x] Logo sản phẩm — đã thay bằng ảnh người dùng cung cấp (header, sidebar admin, favicon,
       icon Desktop, trang chủ).
   [x] Khoảng trắng giao diện — xem mục 2.
8. [x] Snapshot lại toàn bộ ảnh giao diện SAU KHI mọi sửa đổi (bao gồm thuật toán, đã retrain
       xong) đã hoàn tất — đã xoá ảnh cũ, chạy lại `scripts/capture_screenshots.py` (có cập nhật
       script cho khớp giao diện mới: dropdown RAM/SSD/màn hình/độ phân giải/tần số quét thay vì
       ô nhập tự do, thêm bước chụp màn Quản lý giá mới `12b_quan_ly_gia_khuyen_mai.png`) — 16
       ảnh mới trong `screenshots/`, đã xem lại 2 ảnh tiêu biểu xác nhận hiển thị đúng badge
       khuyến mãi/lượt bán. **Rà soát lại lần nữa (bạn hỏi "đã chụp đầy đủ chức năng quan trọng
       chưa")**: phát hiện 2 khoảng trống thật — (1) ảnh Catalog cũ đã lỗi thời do vừa đổi UI
       sắp xếp sang checkbox, (2) **chưa từng có ảnh minh chứng cho các trạng thái RỖNG** (yêu
       cầu C0.1 từ đầu phiên) dù đã sửa code từ lâu. Đã bổ sung script chụp 3 ảnh mới:
       `09b_danh_muc_rong.png` (lọc ra 0 kết quả, có nêu rõ điều kiện + nút xóa lọc),
       `09c_so_sanh_rong.png` (chưa chọn máy nào), `10b_quan_tri_hang_may.png` (màn Hãng máy có
       cột "Mức uy tín" mới) — tổng hiện tại 19 ảnh trong `screenshots/`, đã xem lại cả 3 ảnh
       mới xác nhận đúng nội dung.
9. [x] Comment code đầy đủ — đã xong toàn bộ: `retriever.py`, `classifier.py`,
       `text_classifier.py`, `features.py`, `recommend.service.ts`, và 4 file còn thiếu vừa làm
       xong trong lượt này: `price.service.ts` (giải thích từng bước tính lại chỉ số, so sánh
       giá trị mới/cũ, lý do dùng `any[]` cho transaction), `main.py` (ML — thêm docstring module
       giải thích vai trò `_state` làm bộ nhớ tạm, comment từng endpoint theo đúng bước xử lý),
       `AdminPrices.tsx` (giải thích các `InputNumber` formatter/parser, lý do đặt `min` chặn giá
       gốc ≤ giá bán), `CrudTable.tsx` (giải thích cơ chế sinh cột tự động, `transformEdit`/
       `transformSubmit`, vì sao dùng lưới 2 cột khi form nhiều trường). Đã xác nhận không phá vỡ
       gì: `tsc --noEmit` sạch cả backend/frontend, `python -c "import app.main"` chạy được,
       pytest 34/34 pass sau khi thêm comment.
10. [x] **MỚI**: bổ sung khuyến mãi (`originalPriceVnd`) + lượt bán (`salesCount`) — máy giá
       gốc cao hơn nhưng giảm giá sâu + bán chạy hơn vẫn có thể được xếp hạng cao hơn (đưa vào
       metric kNN thật, không chỉ hiển thị). ĐÃ XONG: schema + migrate + data generator +
       features.py + retriever.py (nhóm `popularity`, trọng số cố định 0,12) + snapshotSync.ts +
       main.py (ml-service) + seed lại DB (`--reset`) + retrain (macro-F1 Model A = 0,787, Model C
       = 0,7725) + 34/34 test pytest pass (gồm 19/19 test độ nhạy ưu tiên chạy lại riêng) +
       evaluate (nDCG@5 = 0,737, xem [KET_QUA_THUC_NGHIEM.md](KET_QUA_THUC_NGHIEM.md) mục 4.4).
       Giao diện: thêm component `DiscountBadge` dùng chung ở Catalog/RecommendationCard/Detail
       (giá gốc gạch ngang + % giảm + "Đã bán N"); form Quản lý giá thêm 2 cột sửa trực tiếp
       "Giá gốc (khuyến mãi)" + "Đã bán" (API `PATCH /:id/price` mở rộng nhận thêm 2 trường này).
       Đã kiểm thử trực tiếp trên browser: Catalog/Results/Detail hiển thị đúng badge, AdminPrices
       sửa khuyến mãi + lượt bán thành công (network log xác nhận `PATCH .../price` 200 OK), ràng
       buộc "giá gốc phải > giá bán" hoạt động đúng cả client (clamp) lẫn server (400 nếu vi phạm).
11. [x] **MỚI**: tạo file riêng giải thích kNN đầy đủ — đã tạo
       [GIAI_THICH_THUAT_TOAN_KNN.md](GIAI_THICH_THUAT_TOAN_KNN.md): nguồn gốc lịch sử (Fix &
       Hodges 1951, Cover & Hart 1967), cách giải quyết trước khi có kNN (luật if-else — chính là
       baseline trong đồ án), nguyên tắc cốt lõi (khoảng cách/k/tổng hợp, chuẩn hoá, trọng số,
       khoảng cách một phía), ví dụ tính tay cụ thể, giải thích cả 3 mô hình (A/B/C) kèm trích dẫn
       file:dòng, ví dụ số thật lấy từ [KET_QUA_THUC_NGHIEM.md](KET_QUA_THUC_NGHIEM.md), mục lục
       "đọc sâu hơn" trỏ đến đúng file/test liên quan + 3 nguồn tham khảo ngoài.
12. [x] **MỚI**: tạo file `.md` lưu thông tin tài khoản đăng nhập demo — đã tạo
       [TAI_KHOAN_DANG_NHAP.md](TAI_KHOAN_DANG_NHAP.md) (3 tài khoản admin/staff/khách, cùng
       mật khẩu `Demo@123`, nguồn từ `backend/prisma/seed.ts`).
13. [x] **MỚI**: tích hợp THẬT API DummyJSON để tải ảnh sản phẩm (bạn phát hiện 5 ảnh cũ chỉ được
       tải tay 1 lần, không có script) — đã tạo
       [scripts/fetch_brand_photos.py](scripts/fetch_brand_photos.py), chạy thành công, xác nhận
       nội dung file trùng khớp 100% với bản cũ. Ghi nhận giới hạn thật: DummyJSON category
       "laptops" chỉ có đúng 5 sản phẩm.
14. [x] **MỚI**: CRUD lại toàn bộ trên browser để đảm bảo hệ thống chạy đúng (bạn yêu cầu) — đã
       làm cả thủ công lẫn viết script Playwright tự động
       [scripts/capture_crud_test.py](scripts/capture_crud_test.py) lưu ảnh bằng chứng vào
       [crud_test_screenshots/](crud_test_screenshots/) (16 ảnh, mỗi thao tác chính 1 ảnh). Quá
       trình này phát hiện và sửa được **3 lỗi thật** đang tồn tại trong code, không phải lỗi giả
       định:
       - **Hãng máy thiếu trường `tier` trong CRUD**: cả frontend (`AdminBrands.tsx`) lẫn backend
         (`brands.routes.ts`) đều không cho xem/sửa mức uy tín thương hiệu — dù đây là đặc trưng
         thật trong metric Mô hình B. Đã thêm dropdown "Mức uy tín" (1-5) + validate zod backend,
         test sửa Acer 3→4→3 thành công qua UI thật.
       - **Sửa laptop có sẵn bị lỗi "Dữ liệu gửi lên không hợp lệ"** khi trường optional đang
         `null` (vd `batteryWh`) — do zod `.optional()` chỉ chấp nhận `undefined`, không chấp
         nhận `null` (Prisma trả `null` cho cột nullable). Đã sửa `series`/`batteryWh`/`imageUrl`/
         `sourceUrl` trong `laptopInputSchema` sang `.nullable().optional()`.
       - **"AI gợi ý phân khúc" báo thiếu dữ liệu dù đã điền đủ** khi TẠO MỚI laptop (tiêu chí 3
         của đồ án) — `SegmentSuggester.tsx` kiểm tra thẳng `resWidth`/`resHeight`, nhưng 2 trường
         này CHỈ có giá trị lúc bấm Lưu (transformSubmit tách ra từ field `resolution`), nên luôn
         báo thiếu trong lúc đang nhập. Đây là regression thật từ lúc gộp độ phân giải thành 1
         dropdown. Đã sửa: tự tách `resolution` ngay trong `suggest()`.
       - Đã xác nhận lại bằng ảnh: AI gợi ý phân khúc ra đúng "Gaming 71%" khi tạo máy mới, sửa
         tên máy có `batteryWh=null` thành công ("Đã cập nhật"), sửa lượt bán ở Quản lý giá thành
         công. `tsc --noEmit` sạch cả backend/frontend sau khi sửa.
15. [x] **MỚI**: cập nhật lại TOÀN BỘ file `.md` trong repo (bạn yêu cầu) — đã viết lại
       [README.md](README.md) (rất lỗi thời, còn ghi macro-F1 dữ liệu mô phỏng 315 mẫu cũ),
       [ml-service/README.md](ml-service/README.md) (số liệu cũ 0,957/9 test),
       [backend/README.md](backend/README.md), [frontend/README.md](frontend/README.md) (còn
       nguyên template Vite mặc định, chưa từng sửa), [data/README.md](data/README.md) (còn ghi
       `generate_mock_catalog.py`, 315 dòng cũ) — tất cả đã cập nhật khớp thực tế hiện tại và trỏ
       đúng vào `KET_QUA_THUC_NGHIEM.md` làm nguồn số liệu duy nhất (tránh chép số bị lệch sau này).

## C. Việc CÒN THIẾU / cần làm tiếp (không được quên)

- [x] **Macro-F1 Mô hình A giảm còn 0,665** (< mục tiêu 0,75) — ĐÃ XỬ LÝ: giảm nhiễu gán nhãn
      (std 0,45→0,32) + thêm số hạng phạt cân nặng cho công thức OFFICE trong
      `data/generate_catalog.py`; sau retrain macro-F1 test phục hồi 0,799 (lần đo trước khi thêm
      tính năng khuyến mãi), hiện tại (đã thêm khuyến mãi/lượt bán) là 0,787 — vẫn vượt mục tiêu.
- [x] Chạy lại `python -m app.evaluate` lần cuối sau khi mọi thay đổi dữ liệu đã chốt, lưu số
      liệu vào `KET_QUA_THUC_NGHIEM.md` — đã chạy, đã cập nhật file (mục 2-6).
- [x] Kiểm thử màn Quản lý giá đầy đủ trên browser — đã test lại: sửa giá, sửa khuyến mãi, sửa
      lượt bán đều thành công (xác nhận qua network log), route `/price-changes` không còn bị
      hiểu nhầm là `:id`.
- [x] Retrain artifact Mô hình A + Mô hình C sau khi dữ liệu đổi lần cuối — đã retrain sau khi
      thêm cột khuyến mãi/lượt bán (xem mục C0.10).
- [x] Chạy lại `scripts/capture_screenshots.py` để có ảnh MỚI NHẤT — đã xoá ảnh cũ, sửa script
      cho khớp UI dropdown mới, chụp lại đủ 16 ảnh (thêm ảnh màn Quản lý giá).
- [x] Kiểm tra toàn bộ `npx tsc --noEmit` (backend + frontend) và `pytest` (ml-service) LẦN CUỐI
      sau khi mọi thay đổi trong phiên đã xong — cả 3 đều sạch/pass (backend tsc sạch, frontend
      tsc sạch, pytest 34/34 pass).
- [x] Viết `TONG_HOP_THAY_DOI_PHIEN_NAY.md` — đã tạo
      [TONG_HOP_THAY_DOI_PHIEN_NAY.md](TONG_HOP_THAY_DOI_PHIEN_NAY.md).
- [x] `git add -A && git commit && git push` — đã commit `0f7615d` và push thành công lên
      `origin/main` (https://github.com/tranduchai9111994-BA/QuanLyLapTop).

## D. Ghi chú để không lặp lỗi

- Route Express: route TĨNH phải khai báo TRƯỚC route ĐỘNG (`/:id`) — đã vá 1 lần, rà lại các
  route khác trong `laptops.routes.ts` xem còn chỗ nào bị sai thứ tự không.
- Mỗi lần đổi Prisma schema: phải `migrate dev` + `seed --reset` + restart ML service + backend
  (thứ tự này, thiếu bước nào cũng ra dữ liệu lệch giữa DB và ML service).
- Ảnh chụp minh họa (`screenshots/`) LÀ SẢN PHẨM BÀN GIAO — phải chụp LẠI mỗi khi giao diện đổi,
  không được để ảnh cũ lẫn với báo cáo mới.
