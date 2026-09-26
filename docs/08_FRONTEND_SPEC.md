# 08 — Đặc tả màn hình Frontend

> Màu, chữ, component: theo `07_UIUX.md`. Mỗi màn liệt kê: route, quyền, bố cục, dữ liệu, hành vi, trạng thái.
> Ba màn **trải nghiệm thông minh** trọng tâm khi bảo vệ được đánh dấu ✨.

## 1. Danh sách màn

| # | Màn | Route | Quyền |
|---|---|---|---|
| 1 | Trang chủ | `/` | Công khai |
| 2 | ✨ Wizard tư vấn | `/tu-van` | Công khai |
| 3 | ✨ Kết quả khuyến nghị | `/tu-van/ket-qua/:sessionId` | Công khai |
| 4 | Chi tiết laptop + tương tự | `/laptop/:id` | Công khai |
| 5 | Danh mục | `/danh-muc` | Công khai |
| 6 | So sánh | `/so-sanh` | Công khai |
| 7 | Yêu thích & lịch sử | `/ca-nhan` | CUSTOMER |
| 8 | Đăng nhập | `/dang-nhap` | Công khai |
| 9 | Dashboard | `/quan-tri` | ADMIN |
| 10 | Quản lý laptop (+ gợi ý phân khúc AI) | `/quan-tri/laptop` | STAFF |
| 11 | Hàng đợi nhãn | `/quan-tri/hang-doi-nhan` | STAFF |
| 12 | Benchmark CPU/GPU | `/quan-tri/benchmark` | ADMIN |
| 13 | ✨ Mô hình | `/quan-tri/mo-hinh` | ADMIN |
| 14 | ✨ Phản hồi & đánh giá | `/quan-tri/phan-hoi` | ADMIN |
| 15 | Cấu hình tri thức | `/quan-tri/tri-thuc` | ADMIN |
| 16 | Người dùng, Nhật ký | `/quan-tri/nguoi-dung`, `/quan-tri/nhat-ky` | ADMIN |

Trạng thái toàn cục: Zustand store `compareStore` (tối đa 3 id, lưu trong bộ nhớ phiên), `authStore`. Gọi API bằng TanStack Query (cache 60 s cho danh mục).

## 2. Trang chủ `/`
- Hero nền `ai-gradient` nhạt (primary-50 → trắng), H1 "Tìm laptop hợp với bạn chỉ trong 2 phút", phụ đề "AI so sánh hàng trăm mẫu máy theo hiệu năng và ngân sách của bạn". Nút chính lớn "Tìm laptop cho tôi" → `/tu-van`.
- 4 thẻ phân khúc (icon + màu 07 §2.2) → vào wizard với phân khúc chọn sẵn.
- Khối "Cách SmartLap hoạt động": 3 bước icon (Bạn cho biết nhu cầu → AI tìm máy gần nhất → Bạn xem giải thích và chọn).
- Dải "Đáng tiền nhất tuần này": 4 máy `value_desc`.

## 3. ✨ Wizard tư vấn `/tu-van`
Thẻ trung tâm max 720 px, `Steps` 3 bước ở trên, nút "Quay lại" / "Tiếp tục" dưới, bước cuối "Xem kết quả".

**Bước 1 — Bạn dùng laptop để làm gì?**
- Lưới 2×2 thẻ phân khúc chọn được + thẻ thứ 5 viền nét đứt "Chưa rõ — gợi ý giúp tôi ✨".
- Chọn "Chưa rõ" → hiện nhóm chip chọn nhiều hoạt động (Học tập, Văn phòng, Lập trình, Chơi game, Thiết kế đồ họa, Dựng video, Di chuyển nhiều). Mỗi lần đổi chip gọi `POST /recommendations/infer-segment` (debounce 400 ms) → khối gợi ý: "✨ Nhu cầu của bạn gần với **Gaming** (72%)" + `ConfidenceIndicator` + link "Dùng phân khúc khác".
- Độ tin cậy < 60% → "Nhu cầu của bạn nằm giữa Gaming và Đồ họa. Hệ thống sẽ tìm ở cả hai." (backend dùng 2 phân khúc).

**Bước 2 — Ngân sách**
- `Slider range` 8–80 triệu, hiển thị "Từ 15.000.000 ₫ đến 22.000.000 ₫". 4 nút nhanh. Dòng phụ động: "Có 46 mẫu trong khoảng này" (gọi `GET /laptops?...&pageSize=1` lấy `meta.total`).

**Bước 3 — Điều gì quan trọng với bạn?**
- 4 `PrioritySlider`: Hiệu năng, Di động & pin, Màn hình, Tiết kiệm chi phí (mặc định 3).
- Collapse "Yêu cầu bắt buộc (tùy chọn)": RAM tối thiểu (Segmented 8/16/32), SSD tối thiểu (256/512/1TB), Nặng tối đa (Slider 1–3 kg), Hãng (Select nhiều).

Gửi → màn tải (07 §8) → điều hướng tới kết quả. Để quay lại chỉnh nhu cầu, dùng `/tu-van?from=<sessionId>`: wizard tải lại `needJson` của phiên đó từ server (không dùng browser storage).

## 4. ✨ Kết quả khuyến nghị `/tu-van/ket-qua/:sessionId`
Bố cục xl: cột trái 8/12 danh sách thẻ, cột phải 4/12 panel dính.

**Đầu trang:** H1 "5 laptop phù hợp nhất với bạn" + tóm tắt nhu cầu dạng chip (Gaming · 18–22 tr · Hiệu năng 4/5 …) + nút phụ "Chỉnh nhu cầu". Có `AiBadge`. Alert nới ngân sách / `FallbackBanner` nếu có.

**Danh sách:** `RecommendationCard` × N (07 §7.4). Sắp xếp phụ: Phù hợp nhất (mặc định) / Giá thấp / Hiệu năng cao — chỉ đổi thứ tự hiển thị, không gọi lại mô hình, không ghi event.

**Panel phải:**
- "Hồ sơ lý tưởng của bạn": radar 6 trục (CPU, GPU, RAM, Màn hình, Di động, Giá hợp lý) so với máy đang hover/chọn.
- "Phân khúc": `SegmentTag` + câu "Chọn vì 5/7 máy tương tự nhu cầu của bạn là Gaming".
- "Trọng số hệ thống đã dùng": thanh ngang từng nhóm (minh bạch cách chấm).

**Hành vi:**
- "Vì sao gợi ý?" → `ExplainDrawer`.
- 👍 → `POST /events {type: LIKE}`; 👎 → Popover chọn lý do → `DISLIKE` + reason. Không cho bấm lặp (khóa theo `sessionId+laptopId`).
- "Chi tiết" → ghi `VIEW_DETAIL`; "+ So sánh" → `ADD_COMPARE`, thanh so sánh nổi dưới đáy khi ≥ 1 máy.
- Cuối trang: "Không thấy máy ưng ý?" → nút "Thử ưu tiên khác" và "Xem toàn bộ danh mục".

## 5. Chi tiết laptop `/laptop/:id`
- Trái: ảnh lớn. Phải: tên, `SegmentTag`, giá `Price-lg`, chỉ số hiệu năng (Progress 0–100) và "Đáng tiền" (so với trung vị phân khúc: "Tốt hơn 68% máy cùng phân khúc").
- Bảng thông số 2 cột, nền `bg-subtle`.
- Biểu đồ lịch sử giá (Line, nếu ≥ 2 điểm).
- **"Laptop tương tự ✨"**: carousel 6 thẻ nhỏ, mỗi thẻ có chênh giá (`+2,5 tr` màu `error`, `−1,2 tr` màu `success`) và 1 khác biệt chính ("Nhẹ hơn 0,4 kg").
- Nếu vào từ kết quả (`?session=`), hiện 👍/👎 như thẻ kết quả.

## 6. Danh mục `/danh-muc`
- Bộ lọc trái (Drawer ở mobile): phân khúc, giá, hãng, RAM, trọng lượng. Lưới thẻ 3 cột, `Pagination`. Sắp xếp. Tìm kiếm tên.
- Banner nhỏ đầu trang: "Không biết chọn gì? Để AI tư vấn ✨" → wizard.

## 7. So sánh `/so-sanh`
- Bảng cột theo máy (tối đa 3), hàng theo thông số; ô tốt nhất mỗi hàng tô `success-bg` + đậm. Hàng đầu radar chồng 3 máy. Nút xóa từng máy.

## 8. Cá nhân `/ca-nhan`
- Tab "Yêu thích" (lưới thẻ), tab "Lịch sử tư vấn" (List: ngày, tóm tắt nhu cầu, máy hạng 1, nút "Xem lại").

## 9. Dashboard `/quan-tri`
- Hàng KPI (Card thống kê): Lượt tư vấn (7 ngày, % so kỳ trước), Tỷ lệ 👍, Tỷ lệ phiên có tương tác, p95 phản hồi, Tỷ lệ dự phòng, Nhãn chờ duyệt.
- Line: lượt tư vấn và tỷ lệ 👍 theo ngày. Pie/Bar: phân bố phân khúc được tư vấn. Bar: top 10 máy được gợi ý hạng 1.
- Khối "Cảnh báo" (List từ `AlertLog`, icon theo mức độ) — mỗi cảnh báo có hành động gợi ý (ví dụ "Xem phản hồi", "Huấn luyện lại").
- Bộ chọn khoảng ngày `RangePicker`; công tắc "Loại dữ liệu giả lập".

## 10. Quản lý laptop `/quan-tri/laptop`
- Table: ảnh nhỏ, tên, hãng, phân khúc (tag + icon khóa nếu `locked`), nguồn nhãn, giá, trạng thái, thao tác. Lọc + tìm.
- Form thêm/sửa (Drawer 640 px): chọn CPU/GPU từ bảng benchmark (Select có tìm kiếm, hiện điểm), các trường thông số, giá.
- **Khối "Gợi ý phân khúc ✨"** cuối form: nút "Gợi ý bằng AI" (bật khi đủ trường) → `ConfidenceIndicator`, nhãn đề xuất, bảng 7 láng giềng (tên, phân khúc, khoảng cách). Nút "Dùng gợi ý này" / chọn nhãn khác (Radio) + Checkbox "Khóa nhãn, không cho mô hình thay đổi".
- Đổi giá → tự ghi `PriceHistory`.

## 11. Hàng đợi nhãn `/quan-tri/hang-doi-nhan`
- Table các nhãn `NEEDS_REVIEW` hoặc "nhãn đáng ngờ" (nhãn hiện tại khác dự đoán mô hình với tin cậy ≥ 0,8). Cột: máy, nhãn hiện tại, dự đoán, độ tin cậy. Thao tác: Xác nhận / Đổi nhãn. Chọn nhiều → xác nhận hàng loạt.
- Đầu trang: "Mỗi nhãn bạn xác nhận sẽ được dùng để huấn luyện mô hình ở lần tiếp theo."

## 12. Benchmark `/quan-tri/benchmark`
- 2 tab CPU / GPU, bảng có sửa trực tiếp, nhập CSV. Cảnh báo khi sửa điểm: "Thay đổi điểm sẽ ảnh hưởng mọi máy dùng CPU này. Cần đồng bộ lại chỉ mục."

## 13. ✨ Mô hình `/quan-tri/mo-hinh`
- Đầu trang: thẻ "Phiên bản đang dùng" (version, k, metric, weights, macro-F1, accuracy, số mẫu, ngày) + nút "Huấn luyện lại" (Modal nhập ghi chú, hiện tiến trình).
- Table phiên bản: trạng thái (tag: Đang dùng xanh, Ứng viên xanh lơ, Lưu trữ xám, Lỗi đỏ), macro-F1 (golden), thay đổi so với đang dùng (▲ ▼ màu), thao tác Duyệt / Quay lại.
- Chi tiết phiên bản (Tabs):
  - **Tổng quan**: bảng precision/recall/F1 từng lớp; bảng so sánh baseline (Dummy, Luật, kNN).
  - **Ma trận nhầm lẫn**: heatmap (lưới div, cường độ `primary`) có số, nhãn tiếng Việt.
  - **Chọn k**: LineChart macro-F1 train/validation theo k, đánh dấu k được chọn.
  - **Thí nghiệm cắt bỏ**: bảng 04 §6.3.
  - **Truy hồi**: segment precision@5, tỷ lệ persona đạt, danh sách persona trượt.
- Nút "Duyệt đưa vào sử dụng" chỉ bật khi đạt quy tắc (09 §2.3); nếu tắt, Tooltip nói rõ điều kiện nào chưa đạt. Confirm Modal trước khi promote/rollback.

## 14. ✨ Phản hồi & đánh giá `/quan-tri/phan-hoi`
- KPI: tỷ lệ 👍 theo phân khúc (Bar), phân bố lý do 👎 (Bar ngang), tỷ lệ 👍 theo hạng (1–5, để xem hạng 1 có thật sự tốt nhất).
- **Khối "Đề xuất điều chỉnh ✨"** (DSS): ví dụ "Phân khúc Gaming: 38% phản hồi 👎 do *Quá nặng* (cao gấp 2 lần trung bình). Đề xuất tăng trọng số Di động mặc định từ 0,6 lên 0,8." Nút "Áp dụng đề xuất" (mở Cấu hình tri thức với giá trị điền sẵn, admin xác nhận) / "Bỏ qua".
- Table phản hồi gần đây: thời gian, máy, loại, lý do, ghi chú, link phiên.

## 15. Cấu hình tri thức `/quan-tri/tri-thuc`
- Tab **Trọng số mặc định**: bảng 4 phân khúc × 4 nhóm, InputNumber 0,1–2,0; cột xem trước "Top 3 cho persona mẫu" cập nhật khi đổi (gọi recommend với persona P01).
- Tab **Ghim / Loại**: Table + form (máy, hành động, phân khúc, lý do bắt buộc, ngày hết hạn).
- Tab **Hồ sơ hoạt động**: bảng 04 §3.5 sửa được.
- Tab **Ngưỡng**: tin cậy, top-N, tỷ lệ nới ngân sách, ngưỡng cảnh báo.
- Mọi thay đổi ghi `AuditLog`, hiện "Cập nhật lần cuối bởi … lúc …".

## 16. Đăng nhập
Thẻ giữa màn trên nền gradient nhạt; khối "Tài khoản demo" bấm để điền nhanh (chỉ hiện khi `VITE_DEMO=true`).
