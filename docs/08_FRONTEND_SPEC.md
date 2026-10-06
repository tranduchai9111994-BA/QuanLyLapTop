# 08 — Đặc tả màn hình Frontend

> Màu, chữ, component: theo `07_UIUX.md`. Mỗi màn liệt kê: route, quyền, bố cục, dữ liệu, hành vi, trạng thái.
> Route lấy đúng theo `src/App.tsx` (tiếng Anh). Ba màn **trải nghiệm thông minh** trọng tâm khi bảo vệ được đánh dấu ✨.

## 1. Kiến trúc chung & danh sách màn

**Quản lý trạng thái:** không dùng Zustand/Redux/TanStack Query. Mỗi trang tự quản lý dữ liệu bằng `useState`/`useEffect` cục bộ, gọi API qua instance `axios` dùng chung `src/lib/api.ts`. Chỉ có 2 mẩu trạng thái được chia sẻ giữa nhiều trang, và cả hai đều dựa trên `localStorage` + sự kiện DOM tuỳ chỉnh (không phải store tập trung):
- **Danh sách so sánh** (`src/lib/compareList.ts`): lưu tối đa 3 `laptopId` ở khoá `smartlap_compare_ids`; hook `useCompareIds()` lắng nghe sự kiện `smartlap:compare-changed` (phát trong cùng tab) và `storage` (đổi từ tab khác) để `TopNav` và `Results.tsx` luôn hiển thị đúng số lượng.
- **Đăng nhập** (khách hàng và quản trị dùng chung khoá `smartlap_token` / `smartlap_user`, vì một trình duyệt chỉ đăng nhập một danh tính tại một thời điểm): đăng nhập/đăng ký/đăng xuất phát sự kiện `smartlap:customer-auth-changed` để `TopNav` cập nhật ngay không cần tải lại trang. `AdminLayout` tự kiểm tra token mỗi khi vào khu quản trị và chuyển hướng `/admin/login` nếu chưa đăng nhập hoặc tài khoản là `CUSTOMER`; `Favorites.tsx`/`History.tsx` áp dụng logic ngược lại (yêu cầu `role === 'CUSTOMER'`).

Danh sách toàn bộ route (đúng `src/App.tsx`):

| # | Màn | Route | Quyền |
|---|---|---|---|
| 1 | Trang chủ | `/` | Công khai |
| 2 | ✨ Wizard tư vấn | `/wizard` | Công khai |
| 3 | ✨ Kết quả khuyến nghị | `/results` | Công khai (nhận dữ liệu qua `location.state`, không có id phiên trên URL) |
| 4 | Chi tiết laptop + tương tự | `/laptop/:id` | Công khai |
| 5 | Danh mục | `/laptops` | Công khai |
| 6 | So sánh | `/compare?ids=1,2,3` | Công khai |
| 7 | Yêu thích | `/favorites` | CUSTOMER (chặn ở frontend, hiện `Result` mời đăng nhập nếu chưa đủ quyền) |
| 8 | Lịch sử tư vấn | `/history` | CUSTOMER |
| 9 | Đăng nhập / Tạo tài khoản khách hàng | `/login` | Công khai |
| 10 | Đăng nhập quản trị | `/admin/login` | Công khai |
| 11 | Dashboard | `/admin/dashboard` | ADMIN |
| 12 | Hãng máy | `/admin/brands` | STAFF, ADMIN |
| 13 | Benchmark CPU | `/admin/benchmarks/cpu` | STAFF, ADMIN |
| 14 | Benchmark GPU | `/admin/benchmarks/gpu` | STAFF, ADMIN |
| 15 | Laptop (+ gợi ý phân khúc AI) | `/admin/laptops` | STAFF, ADMIN |
| 16 | Quản lý giá | `/admin/prices` | STAFF, ADMIN |
| 17 | Duyệt nhãn phân khúc | `/admin/review-queue` | STAFF, ADMIN |
| 18 | ✨ Quản lý mô hình | `/admin/models` | ADMIN |
| 19 | Cấu hình tri thức | `/admin/knowledge` | ADMIN |
| 20 | ✨ Phân tích phản hồi | `/admin/feedback` | ADMIN |
| 21 | Người dùng & nhật ký | `/admin/users` | ADMIN |

`/admin` (không kèm path con) tự chuyển hướng: ADMIN → `dashboard`, STAFF → `laptops` (STAFF không có quyền xem Dashboard). Giới hạn theo vai trò ở trên là những gì Sider ẩn/hiện tại frontend (`AdminLayout.tsx`); backend vẫn tự kiểm `requireRole` cho từng route.

## 2. Trang chủ `/`
- Hero, 4 thẻ phân khúc (icon + màu theo 07 §2.2) dẫn vào wizard với phân khúc chọn sẵn.
- Khối "Cách SmartLap hoạt động": tiêu đề `<h2>` + đúng 3 bước (mảng `STEPS`).
- Dải "💎 Đáng tiền nhất tuần này": tiêu đề `<h2>` + 4 thẻ máy, dữ liệu lấy từ `GET /laptops?sort=value_desc&pageSize=4`, hiện skeleton 4 ô khi đang tải.

## 3. ✨ Wizard tư vấn `/wizard`
Component chính: `PrioritySlider`, `NeedTextInput`.

**Bước 1 — Bạn dùng laptop để làm gì?**
- Chọn nhanh 1 trong 4 phân khúc, hoặc "Chưa rõ" → hiện nhóm chip hoạt động (Văn phòng/soạn thảo, Học tập, Lập trình, Chơi game, Đồ họa/thiết kế, Dựng video, Di chuyển nhiều, Xem phim/giải trí).
- Mỗi lần đổi danh sách hoạt động, gọi `POST /recommendations/infer-segment` (không debounce, gọi ngay khi mảng hoạt động thay đổi, huỷ request cũ nếu có request mới) → hiển thị phân khúc suy luận kèm độ tin cậy và `ConfidenceIndicator`.
- `NeedTextInput` cho phép nhập câu nhu cầu tự do, gọi `/recommendations/parse-need`.

**Bước 2 — Ngân sách**
- `Slider range` từ 8.000.000 ₫ đến 80.000.000 ₫ (bước 500.000 ₫), 4 nút nhanh (Dưới 15 tr, 15–25 tr, 25–40 tr, Trên 40 tr).
- Dòng phụ động cạnh slider: **"Có {N} mẫu trong khoảng này"** — debounce **400 ms** sau khi ngừng kéo, gọi `GET /laptops?priceMin=...&priceMax=...&pageSize=1` và lấy `meta.total`.

**Bước 3 — Điều gì quan trọng với bạn?**
- 4 `PrioritySlider` (Hiệu năng, Di động & pin, Màn hình, Tiết kiệm chi phí), thang 1–5, mặc định 3.
- Chọn thêm: RAM tối thiểu, SSD tối thiểu, Trọng lượng tối đa, Hãng.

Bấm "Xem kết quả" → điều hướng ngay sang `/results` kèm `requestBody` trong `location.state` (Wizard **không** đợi API trả lời trước khi chuyển trang) — `Results.tsx` tự gọi `POST /recommendations` và tự hiển thị trạng thái tải.

## 4. ✨ Kết quả khuyến nghị `/results`
Nhận `location.state` gồm `{ result?, requestBody? }`. Nếu chỉ có `requestBody` (đến từ Wizard), tự gọi `POST /recommendations` lúc mount và hiện Skeleton + `LoadingMessages` luân phiên trong lúc chờ.

Bố cục ≥ 992 px (lg): cột trái danh sách thẻ, cột phải panel dính (radar + `SegmentTag` + trọng số); dưới 992 px: 2 cột không panel; dưới 768 px (md): 1 cột.

- **Số lượng hiển thị**: `Segmented` 3/5/8/10 (`TOPN_OPTIONS`) — gọi lại API.
- **Sắp xếp cục bộ** (`localSort`, không gọi lại API/không ghi event): `Segmented` "Phù hợp nhất" (mặc định, giữ nguyên thứ tự backend trả về) / "Giá thấp" / "Hiệu năng cao".
- Danh sách: `RecommendationCard` × N (07 §7.4).
- Nút Thích/Không thích khoá sau khi bấm: `RecommendationCard.tsx` lưu `localStorage` với khoá `smartlap_feedback_{sessionId}_{laptopId}`, disable cả 2 nút khi đã có phản hồi lưu.
- "Vì sao gợi ý?" → `ExplainDrawer` (truyền `modelVersion` từ `result.modelVersion`).
- "+ So sánh" → ghi event `ADD_COMPARE`, thêm vào danh sách so sánh dùng chung (`toggleCompareId`, tối đa 3 máy).
- Cuối danh sách: khối "Không thấy máy ưng ý?" với 2 nút hành động.
- `FallbackBanner` / `BudgetRelaxedBanner` hiện khi `result.mode === 'FALLBACK'` hoặc `result.budgetRelaxed`.

## 5. Chi tiết laptop `/laptop/:id`
- Trái: `LaptopThumbnail`. Phải: tên, `SegmentTag`, giá, thông số hiệu năng.
- Dòng "💎 Đáng tiền — tốt hơn {laptop.valuePercentile}% máy cùng phân khúc" — chỉ hiện khi `valuePercentile != null`.
- Bảng thông số 2 cột (CPU, GPU, RAM, SSD, Màn hình, Trọng lượng, Pin).
- **Lịch sử giá**: `Card` + Recharts `LineChart` — chỉ render khi `laptop.priceHistory?.length >= 2`.
- **"Máy tương tự"**: lưới CSS tự co giãn (`grid-template-columns: repeat(auto-fill, minmax(200px,1fr))`, không phải carousel), mỗi thẻ có Tag chênh lệch giá (`Đắt hơn N%` màu đỏ / `Rẻ hơn N%` màu xanh / `Cùng mức giá`) và 1 dòng nêu **khác biệt lớn nhất** so với máy đang xem (hàm `biggestDifference()`, so trên trọng lượng/RAM/SSD/tần số quét/dung lượng pin; nếu không có khác biệt đáng kể → "Cấu hình gần như tương đương"). Nếu không có máy tương tự nào, hiện `Result status="info"` với nút "Xem toàn bộ danh mục".

## 6. Danh mục `/laptops`
- Bộ lọc (phân khúc, giá, hãng, RAM, trọng lượng), lưới thẻ, phân trang, sắp xếp, tìm kiếm tên.
- Banner đầu trang: **"Không biết chọn gì? Để AI tư vấn ✨"** kèm nút "Bắt đầu tư vấn" → `navigate('/wizard')`.

## 7. So sánh `/compare?ids=`
- Danh sách id lấy từ query string `ids` (không phải path param). Chưa có id nào hoặc dữ liệu không tải được → `Empty` với nút "Chọn máy trong danh mục".
- `Table` cột theo từng máy, hàng theo thông số: Tên máy, Giá, Khuyến mãi, Đã bán, CPU, GPU, RAM, SSD, Màn hình, Trọng lượng. Gọi `GET /laptops/compare?ids=...`.

## 8. Yêu thích `/favorites`
- Yêu cầu đăng nhập khách hàng (kiểm tra `token` + `user.role === 'CUSTOMER'`); chưa đủ điều kiện → `Result status="info"` mời đăng nhập, nút điều hướng `/login` kèm `state.from`.
- Dữ liệu: `GET /me/favorites`. Lưới thẻ (`LaptopThumbnail`, `SegmentTag`, giá); mỗi thẻ có nút "Bỏ thích" (`DELETE /me/favorites/:laptopId`, chặn nổi bọt sự kiện để không điều hướng nhầm sang Chi tiết).
- Rỗng: `Empty` + nút "Xem danh mục".

## 9. Lịch sử tư vấn `/history`
- File và route **tách riêng hoàn toàn** khỏi Yêu thích (`src/pages/History.tsx`, không phải tab chung 1 trang). Cùng điều kiện đăng nhập như mục 8.
- Dữ liệu: `GET /me/sessions`. Mỗi thẻ: `SegmentTag` phân khúc đã dùng, Tag "Chế độ dự phòng" nếu có, thời gian, tối đa 3 tên máy đầu (+ số máy còn lại), giá thấp nhất trong phiên.
- Bấm vào 1 phiên → dựng lại `RecommendationResult` từ dữ liệu đã lưu (không gọi lại `/recommendations`) rồi điều hướng `/results` kèm `location.state.result` — xem lại đúng những gì người dùng từng thấy dù giá/mô hình hiện tại đã đổi.

## 10. Đăng nhập khách hàng `/login`
- Thẻ giữa màn, `Tabs` 2 tab: "Đăng nhập" (`POST /auth/login`, từ chối nếu tài khoản không phải `CUSTOMER`) và "Tạo tài khoản" (`POST /auth/register`, tự đăng nhập ngay sau khi đăng ký).
- Tab "Đăng nhập" tự điền `{ email: 'khach@smartlap.vn', password: 'Demo@123' }` **chỉ khi** biến môi trường `VITE_DEMO === 'true'`.
- Đăng nhập/đăng ký thành công → lưu `smartlap_token`/`smartlap_user`, phát sự kiện `smartlap:customer-auth-changed`, điều hướng theo `location.state.from` (mặc định `/`).

## 11. Đăng nhập quản trị `/admin/login`
- Thẻ giữa màn, `POST /auth/login`; từ chối nếu tài khoản là `CUSTOMER`.
- Tự điền `{ email: 'admin@smartlap.vn', password: 'Demo@123' }` **chỉ khi** `VITE_DEMO === 'true'`.

## 12. Dashboard `/admin/dashboard`
- 2 nút đầu trang: "Tải lại", "Quét cảnh báo ngay" (`POST /dashboard/alerts/scan`).
- Lưới thẻ `Statistic` (CSS grid tự co giãn `auto-fit, minmax(220px,1fr)`, không dùng `Row`/`Col` cố định): Lượt tư vấn (30 ngày), Tỷ lệ hài lòng (👍/(👍+👎), kèm số 👍/👎), Độ trễ trung bình, Độ trễ p95 (so ngưỡng NFR-01 800 ms), Tỷ lệ dùng chế độ dự phòng, Nhãn đang chờ xác minh, Tổng phản hồi. Không có biểu đồ Line/Pie/Bar trên màn này.
- "Cảnh báo đang mở": nếu rỗng hiện `Alert type="success"`; ngược lại `Table` cột Mức (Tag theo `severity`: INFO xanh dương, WARN cam, CRITICAL đỏ), Mã, Nội dung, Lúc, nút "Đánh dấu đã xử lý" (`PATCH /dashboard/alerts/:id/resolve`).

## 13. Hãng máy `/admin/brands`
`CrudTable` (07 §7.13) quản lý danh sách hãng: tìm kiếm client-side, thêm/sửa qua Modal form, xuất/nhập Excel.

## 14. Benchmark CPU / GPU `/admin/benchmarks/cpu`, `/admin/benchmarks/gpu`
- 2 route riêng, cùng dùng `CrudTable` với các trường chung: Mã tra cứu (pattern), Tên hiển thị, Điểm PassMark thô, Điểm chuẩn hoá (0–100), Nguồn tra cứu, Ngày tra. GPU có thêm "Card rời" (boolean) và "VRAM (GB)".
- Khi **sửa** một điểm đã có (không áp dụng lúc thêm mới): `renderFormExtra` hiện `Alert type="warning"` — **"Thay đổi điểm sẽ ảnh hưởng mọi máy dùng linh kiện này"** kèm mô tả về việc cập nhật lại `performanceIdx`/`valueIdx` của toàn bộ laptop gắn linh kiện đó.

## 15. Laptop `/admin/laptops`
- `CrudTable` với đầy đủ trường thông số (SKU, tên, hãng, CPU/GPU chọn từ bảng benchmark có sẵn, RAM/SSD/màn hình/độ phân giải/tần số quét chọn từ danh sách giá trị chuẩn, sRGB, trọng lượng, pin, giá).
- Cột/ô "Phân khúc": chọn thủ công hoặc để trống cho AI tự gán; khối `SegmentSuggester` trong form gọi `/laptops/predict-segment`, hiển thị `ConfidenceIndicator` + nhãn đề xuất + tự điền nếu ô còn trống.
- Sau khi lưu: nếu có `labelWarning` từ server → `message.warning`; nếu đã gán được phân khúc → `message.info` báo tên phân khúc.

## 16. Quản lý giá `/admin/prices`
- Tách khỏi form sửa laptop đầy đủ vì giá đổi thường xuyên hơn.
- Khối "Biến động giá gần đây": tối đa 8 Tag (`GET /laptops/price-changes`), màu đỏ nếu tăng/xanh nếu giảm.
- `Table` sửa trực tiếp theo dòng (`InputNumber` inline, lưu khi rời ô hoặc nhấn Enter): Giá mới, Giá gốc/khuyến mãi (để trống = huỷ khuyến mãi, tối thiểu = giá bán + 10.000 ₫), Đã bán. Nút "Lịch sử" mở Drawer biểu đồ `LineChart` (Recharts) + 4 số tóm tắt (hiện tại, thấp nhất, cao nhất, số lần đổi giá).
- Modal "Điều chỉnh hàng loạt": nhập % thay đổi + lọc theo hãng, bắt buộc bấm "Xem trước ảnh hưởng" (`dryRun=true`) trước khi nút "Áp dụng thật" được bật.

## 17. Duyệt nhãn phân khúc `/admin/review-queue`
- Danh sách máy có nhãn AI gán nhưng độ tin cậy dưới ngưỡng cấu hình (`GET /labels/review-queue`); máy trong hàng đợi vẫn đang được gợi ý tạm bằng nhãn hiện tại.
- Mỗi thẻ: thông tin máy, `ConfidenceIndicator` theo phân bố xác suất, `Select` đổi phân khúc (hiện `Alert warning` nếu chọn khác nhãn AI), checkbox **"Khóa nhãn, không cho mô hình thay đổi"**, nút Duyệt (`PATCH /labels/review-queue/:laptopId`) — phát sự kiện `smartlap:review-queue-changed` để badge trên Sider cập nhật ngay.

## 18. ✨ Quản lý mô hình `/admin/models`
- Form huấn luyện nhanh (ghi chú tuỳ chọn) + nút "Huấn luyện mô hình mới" (`POST /models/train`) — luôn tạo bản "Dự phòng" (`CHALLENGER`), không tự thay mô hình đang phục vụ khách.
- `Table` phiên bản: trạng thái (Tag: Đang sử dụng xanh lá, Dự phòng xanh dương, Đã lưu trữ xám), macro-F1 (test), số mẫu, thời điểm huấn luyện, ghi chú, nút "Xem chi tiết".
- Drawer chi tiết (không phải Tabs, các khối xếp dọc theo thứ tự):
  1. So với baseline: bảng so sánh macro-F1 của kNN đã tối ưu, đoán ngẫu nhiên có trọng số, luật đơn giản.
  2. Đường cong chọn k (5-fold CV): `LineChart` macro-F1 theo k, `ReferenceLine` đánh dấu k đã chọn.
  3. **Precision/Recall/F1-score theo từng phân khúc**: `Table` (Phân khúc, Precision, Recall, F1-score, Số mẫu/support).
  4. Ma trận nhầm lẫn (confusion matrix): `Table` dạng lưới, đường chéo in đậm.
  Nút "Đưa vào sử dụng" (`promote`, chỉ hiện khi chưa là Champion) và "Quay lại phiên bản này" (`rollback`, chỉ hiện với phiên bản đã lưu trữ) — backend tự kiểm quy tắc an toàn khi promote.

## 19. Cấu hình tri thức `/admin/knowledge`
4 tab (`Tabs`), mọi thay đổi đọc/ghi qua `KnowledgeConfig` (key-value), có hiệu lực ngay không cần khởi động lại backend:
- **"Ghim / Cấm máy"**: form thêm (chọn máy, loại 📌 Ghim/🚫 Cấm, phân khúc áp dụng tuỳ chọn, lý do, ngày hết hạn) + `Table` danh sách đang áp dụng, nút gỡ từng mục.
- **"Ngưỡng & mặc định"**: `Slider` ngưỡng tin cậy tự động duyệt nhãn, `InputNumber` số kết quả mặc định, `Slider` tỷ lệ nới ngân sách.
- **"Trọng số theo phân khúc"**: chọn 1 trong 4 phân khúc, chỉnh 5 `Slider` nhóm trọng số (Hiệu năng, Di động & pin, Màn hình, Giá/đáng tiền, Thương hiệu) từ 0,1–2,0; nút lưu tất cả và nút khôi phục mặc định riêng phân khúc đang chọn.
- **"Ngưỡng cảnh báo"**: các `InputNumber` dùng cho tác vụ quét cảnh báo định kỳ (tỷ lệ hài lòng tối thiểu, tỷ lệ dự phòng tối đa, độ trễ p95 tối đa, tỷ lệ máy mới có độ tin cậy thấp tối đa, số nhãn chờ duyệt tối đa).

## 20. ✨ Phân tích phản hồi `/admin/feedback`
- 3 thẻ `Statistic`: Tỷ lệ hài lòng, Lượt thích, Lượt không thích.
- `BarChart` (Recharts) "Hành vi người dùng theo loại sự kiện": tổng hợp `InteractionEvent` theo loại (Xem chi tiết, Thích, Không thích, Thêm vào so sánh, Thêm vào yêu thích).
- `BarChart` ngang "Lý do 'Không thích' phổ biến nhất" (Giá quá cao, Máy quá nặng/cồng kềnh, Cấu hình yếu, Màn hình không như ý, Không thích thương hiệu, Lý do khác).
- `Table` "Câu nhu cầu tự do đã học (phản hồi 👍)": câu nhập tự do + nhãn suy ra, phục vụ huấn luyện lại Mô hình C.

## 21. Người dùng & nhật ký `/admin/users`
1 màn, `Tabs` 2 tab (không phải 2 route riêng):
- **"Tài khoản nội bộ"**: `Table` tài khoản STAFF/ADMIN (khách hàng tự đăng ký ở `/login`, không quản lý ở đây) — đổi vai trò và bật/tắt hoạt động ngay trên dòng (khoá sửa với chính tài khoản đang đăng nhập), Modal "Thêm tài khoản nội bộ".
- **"Nhật ký hệ thống"**: `Table` `AuditLog` (Lúc, Người thực hiện, Hành động — nhãn tiếng Việt cho các hành động sửa cấu hình tri thức/ghim-cấm máy/promote-rollback mô hình/tạo-sửa tài khoản, Đối tượng, Chi tiết rút gọn).
