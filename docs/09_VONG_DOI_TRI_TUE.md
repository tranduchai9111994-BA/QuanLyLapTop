# 09 — Vòng đời trí tuệ (Intelligence Orchestration)

> Ứng với C1 ("trí thông minh cải thiện theo thời gian qua tương tác người dùng") và C3 ("giám sát tiêu chí thành công, kiểm tra tương tác, cân bằng trải nghiệm, ghi đè tri thức, tạo tri thức mới, giảm nhẹ sai lầm").

## 1. Sơ đồ vòng đời

```
      ┌──────────── Người dùng tư vấn ────────────┐
      │                                            ▼
 Tri thức mới ◄── Nhân viên duyệt nhãn ◄── Telemetry (phiên, 👍/👎, lý do)
      │                                            │
      ▼                                            ▼
 Huấn luyện challenger ──► So với golden test ──► Admin duyệt ──► Champion mới
      ▲                                            │
      └──── Cảnh báo giám sát (drift, tỷ lệ 👍) ◄───┘
```

## 2. Tạo tri thức mới và huấn luyện lại

### 2.1 Nguồn nhãn mới cho Mô hình A
| Nguồn | Điều kiện đưa vào tập train |
|---|---|
| Nhãn nhà bán lẻ (seed) | Luôn |
| Nhân viên xác nhận / sửa (`source = ADMIN`) | Luôn — ưu tiên cao nhất |
| Mô hình tự gán (`source = MODEL`) | **Chỉ khi** `status = VERIFIED` (đã có người xác nhận). Tránh vòng lặp mô hình tự học lại lỗi của chính nó |

Phản hồi 👍/👎 **không** đổi nhãn phân khúc trực tiếp; nó tác động qua mục 2.4.

### 2.2 Điều kiện kích hoạt huấn luyện lại
- Có ≥ 20 nhãn mới VERIFIED kể từ phiên bản hiện hành, **hoặc**
- Cảnh báo `LOW_CONFIDENCE_RATE` (mục 6) bật, **hoặc**
- Admin bấm "Huấn luyện lại".
Tác vụ `retrainCheck` chỉ tạo **challenger**, không bao giờ tự promote (D-08).

### 2.3 Quy tắc promote (champion / challenger)
Challenger được bật nút "Duyệt đưa vào sử dụng" khi **tất cả** đúng:
1. Macro-F1 trên `golden_test` ≥ macro-F1 champion − 0,01.
2. Không lớp nào giảm recall quá 0,05.
3. Qua toàn bộ test 04 §9.
4. Số mẫu train ≥ số mẫu champion (không vô tình mất dữ liệu).

Golden test đóng băng từ phiên bản đầu. Máy trong golden test không bị sửa nhãn trong luồng thường (nếu bắt buộc sửa → tạo golden mới, ghi chú rõ, tất cả phiên bản được chấm lại).

### 2.4 Phản hồi tác động Mô hình B
- Tổng hợp tuần: tỷ lệ từng lý do 👎 theo phân khúc.
- Lý do chiếm tỷ lệ cao bất thường (> 1,8 × trung bình các lý do, tối thiểu 15 phản hồi) → sinh **đề xuất** chỉnh `segment_base_weights` (màn 14):

| Lý do | Nhóm trọng số đề xuất tăng |
|---|---|
| Quá đắt | price +0,2 |
| Quá nặng | mobility +0,2 |
| Hiệu năng yếu | performance +0,2 |
| Màn hình chưa tốt | display +0,2 |

Admin xác nhận mới áp dụng (ghi đè tri thức có con người trong vòng lặp). Đây là dạng hệ hỗ trợ quyết định dựa trên dữ liệu tương tác.

### 2.5 Thích nghi theo thời gian không cần huấn luyện
- Thêm máy mới / đổi giá → `snapshotSync` dựng lại chỉ mục Mô hình B ngay: kNN là học lười (lazy learning), có mẫu mới là có tri thức mới.
- Phân vị trong vector lý tưởng tính trên catalog hiện hành → khi CPU thế hệ mới làm mặt bằng tăng, "hiệu năng mức 4" tự dịch lên theo thị trường.

## 3. Ghi đè tri thức và cân bằng trải nghiệm

| Cơ chế | Tác dụng | Nơi cấu hình |
|---|---|---|
| Khóa nhãn (`locked`) | Mô hình không được đổi nhãn máy này | Màn 10 |
| Ghim (PIN) | Máy luôn có mặt (vị trí cuối, nhãn "Đề xuất từ cửa hàng") | Màn 15 |
| Loại (BAN) | Máy không bao giờ được gợi ý (ví dụ ngừng kinh doanh, lỗi hàng loạt) | Màn 15 |
| Trọng số mặc định, hồ sơ hoạt động | Điều chỉnh cách hiểu nhu cầu | Màn 15 |
| Ngưỡng tin cậy | Dưới ngưỡng → hỏi người / tìm ở 2 phân khúc thay vì khẳng định | Màn 15 |

Cân bằng trải nghiệm: gợi ý phân khúc khác chỉ hiện dạng **đề nghị nhẹ**, không đổi lựa chọn của người dùng; chỉ hiện khi độ tin cậy ≥ 0,6 để tránh làm phiền.

## 4. Giảm nhẹ sai lầm — chế độ dự phòng

| Sự cố | Phát hiện | Xử lý |
|---|---|---|
| ML service chết / timeout 3 s | `mlClient` | `fallback.service.ts`: lọc cứng như thường, xếp theo `value_index` giảm dần trong phân khúc người dùng chọn (hoặc luật baseline 04 §6.1 nếu "Chưa rõ"); giải thích bằng mẫu câu luật; `mode = FALLBACK` |
| Phiên bản mô hình mới kém | Tỷ lệ 👍 giảm, cảnh báo | Rollback một chạm về champion trước |
| Artifact hỏng khi nạp | `registry.py` | Giữ phiên bản đang chạy, đánh dấu `FAILED` |
| Catalog lệch (ML chưa đồng bộ máy mới) | So `catalogSize` ở `/health` với DB | Tự gọi `/catalog/sync` |

## 5. Telemetry (kiểm tra các tương tác)

| Dữ liệu | Bảng | Dùng để |
|---|---|---|
| Nhu cầu, phân khúc suy ra, trọng số, vector lý tưởng, phiên bản, độ trễ, cờ dự phòng | `RecommendationSession` | Tái hiện bất kỳ lượt tư vấn nào, đo hiệu năng |
| Danh sách gợi ý, hạng, khoảng cách, giải thích | `RecommendationItem` | Đo tỷ lệ 👍 theo hạng |
| Xem chi tiết, 👍, 👎 + lý do, so sánh, yêu thích | `InteractionEvent` | Tiêu chí thành công, đề xuất trọng số |
| Mọi thay đổi tri thức, promote, rollback | `AuditLog` | Truy vết |

## 6. Giám sát tiêu chí thành công và cảnh báo

**Tiêu chí thành công (mục tiêu đề tài):**
| Tiêu chí | Công thức | Mục tiêu |
|---|---|---|
| Tỷ lệ hài lòng | 👍 / (👍 + 👎) | ≥ 50% |
| Tỷ lệ phiên có tương tác | phiên có ≥ 1 VIEW_DETAIL/LIKE/ADD_COMPARE / tổng phiên | ≥ 60% |
| Hạng 1 tốt nhất | tỷ lệ 👍 hạng 1 ≥ tỷ lệ 👍 hạng 2–5 | Đúng |
| Thời gian ra kết quả | p95 `latencyMs` | < 800 ms |

**Luật cảnh báo (`alertScan`, cửa sổ trượt 7 ngày, tối thiểu 30 phiên):**
| Mã | Điều kiện | Mức | Hành động gợi ý |
|---|---|---|---|
| `LOW_SATISFACTION` | tỷ lệ 👍 < 40% | WARN | Xem màn Phản hồi |
| `FALLBACK_HIGH` | tỷ lệ dự phòng > 5% (24 giờ) | CRITICAL | Kiểm tra ML service |
| `LATENCY_HIGH` | p95 > 800 ms | WARN | Kiểm tra tải |
| `LOW_CONFIDENCE_RATE` | > 30% máy mới nhập 30 ngày có tin cậy < 0,6 | WARN | Dữ liệu trôi — huấn luyện lại |
| `REVIEW_BACKLOG` | > 20 nhãn chờ duyệt | INFO | Mở hàng đợi nhãn |
| `RANK1_WEAK` | tỷ lệ 👍 hạng 1 < trung bình hạng 2–5 | WARN | Xem lại trọng số |

Ngưỡng nằm trong `KnowledgeConfig.alert_thresholds`, sửa được.
