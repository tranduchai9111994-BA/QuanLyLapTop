# 09 — Vòng đời trí tuệ (Intelligence Orchestration)

Hệ thống tự "thông minh lên" theo thời gian qua 4 cơ chế phối hợp: máy mới tự gán nhãn phân khúc, học từ phản hồi người dùng, hàng đợi xác minh có con người kiểm soát, và vòng đời champion/challenger cho mô hình — tất cả được giám sát bởi một tập luật cảnh báo tự động.

## 1. Máy mới tự gán nhãn phân khúc

Khi một laptop được tạo mới hoặc sửa (`POST/PUT /api/laptops`), backend gọi `applySegmentLabel()` trong `backend/src/modules/laptops/segment.service.ts` để gán/giữ nhãn `SegmentLabel`. Quy tắc quyết định:

1. **Nhãn đang bị khóa (`locked = true`) và người dùng không chủ động chọn lại phân khúc** → giữ nguyên nhãn cũ, không gọi mô hình, không ghi đè. Đây là cơ chế cho phép nhân viên "chốt" một nhãn để Mô hình A không bao giờ tự sửa lại (bật ở hàng đợi xác minh, xem mục 3).
2. **Người dùng chủ động chọn phân khúc** (`requested`) → lưu đúng phân khúc đó, `status = VERIFIED`. `source = MODEL` nếu trùng với dự đoán của Mô hình A, `source = ADMIN` nếu khác — phân biệt "người dùng xác nhận đúng dự đoán" với "người dùng tự quyết định khác dự đoán".
3. **Người dùng không chọn, có gọi được Mô hình A** → dùng nhãn dự đoán (`source = MODEL`). So sánh xác suất dự đoán với ngưỡng tin cậy đọc từ `KnowledgeConfig` khóa `confidence_threshold` (mặc định `0.6` nếu chưa cấu hình):
   - Xác suất ≥ ngưỡng → `status = VERIFIED`, nhãn được dùng ngay cho gợi ý.
   - Xác suất < ngưỡng → `status = NEEDS_REVIEW`, nhãn vẫn được gán tạm (không chặn lưu máy) nhưng đưa vào hàng đợi xác minh, kèm cảnh báo hiển thị mức tin cậy phần trăm và ngưỡng đang áp dụng.
4. **Không gọi được Mô hình A (ML service lỗi/timeout) và người dùng cũng không chọn** → không gán được nhãn mới; nếu đã có nhãn cũ thì giữ nguyên kèm cảnh báo "không gọi được mô hình AI"; nếu chưa từng có nhãn thì máy sẽ chưa được đưa vào gợi ý cho khách cho tới khi có phân khúc.

Mỗi lần lưu nhãn (trừ trường hợp giữ nguyên do khóa), `SegmentLabel` được cập nhật đầy đủ: `segment`, `source`, `status`, `confidence` (xác suất lớp thắng), `predictedBy` (phiên bản Mô hình A), `probaJson` (toàn bộ phân phối xác suất 4 phân khúc), `verifiedById` (người xác nhận, nếu là người chọn).

## 2. Học từ phản hồi người dùng

Mỗi hành vi của người dùng trên kết quả gợi ý được ghi thành một `InteractionEvent` qua `POST /api/events` (`backend/src/modules/feedback/events.routes.ts`): `type` ∈ `VIEW_DETAIL, LIKE, DISLIKE, ADD_COMPARE, ADD_FAVORITE`, kèm `reason` (chỉ có ý nghĩa khi `DISLIKE`) ∈ `TOO_EXPENSIVE, TOO_HEAVY, WEAK_PERFORMANCE, POOR_DISPLAY, BRAND, OTHER`.

Phản hồi được dùng theo 2 cách:

- **Đo lường/cảnh báo**: tỷ lệ 👍/👎 và tương quan với hạng gợi ý được dùng trực tiếp trong luật cảnh báo `LOW_SATISFACTION` và `RANK1_WEAK` (mục 5). `GET /api/feedback/summary` tổng hợp theo `type` + `reason` cho màn Dashboard/Phản hồi.
- **Học lại Mô hình C**: script `ml-service/app/lifecycle/retrain_from_feedback.py` đọc các câu nhu cầu tự do thật mà người dùng đã gõ (lưu trong `RecommendationSession`), kèm phản hồi 👍/👎 của họ, qua route `GET /api/feedback/need-texts`. Chỉ những câu được 👍 (người dùng hài lòng với kết quả) mới được xem là "mô hình đoán đúng" và được thêm vào tập huấn luyện của Mô hình C. Script có 2 chế độ chạy: gọi API backend thật, hoặc `--demo` mô phỏng câu mới không cần backend; cờ `--apply` mới thực sự ghi câu mới vào file dữ liệu (`need_phrases.json`), sau đó cần chạy lại `python -m app.lifecycle.train` để kích hoạt. Script tự so sánh độ chính xác trước/sau khi học thêm bằng cách huấn luyện trên một tập câu và kiểm tra trên tập câu khác.

## 3. Hàng đợi "Cần xác minh" (NEEDS_REVIEW)

Nhãn có `status = NEEDS_REVIEW` (do Mô hình A dự đoán với độ tin cậy dưới ngưỡng, xem mục 1) được liệt kê ở `GET /api/labels/review-queue` (`backend/src/modules/labels/labels.routes.ts`), sắp xếp theo `updatedAt` tăng dần — máy chờ xác minh lâu nhất hiển thị trước. Mỗi dòng trả kèm phân phối xác suất (giải mã từ `probaJson`) và thời gian chờ.

Nhân viên/quản trị viên duyệt qua `PATCH /api/labels/review-queue/:laptopId` với `{segment, locked?}`. Khi duyệt: `source = ADMIN`, `status = VERIFIED`, ghi `verifiedById`; nếu không truyền `locked` thì giữ nguyên giá trị cũ của nhãn. Màn hình quản trị (`AdminReviewQueue.tsx`) có checkbox **"Khóa nhãn, không cho mô hình thay đổi"** ứng với trường `locked` này — khi bật, lần sửa laptop tiếp theo (nếu không chủ động chọn lại phân khúc) sẽ giữ nguyên nhãn thay vì để Mô hình A gán đè (đúng quy tắc 1 ở mục 1).

## 4. Vòng đời champion/challenger cho Mô hình A

Quản lý qua `backend/src/modules/models/models.routes.ts`, lưu ở bảng `ModelVersion` (`status` ∈ `CHAMPION, CHALLENGER, ARCHIVED, FAILED`).

- **`POST /api/models/train`**: gọi đồng bộ ML `/train` (timeout 60 giây), tạo bản ghi `ModelVersion` mới với `status = CHALLENGER`, `type = CLASSIFIER`, lưu `paramsJson` (siêu tham số tốt nhất), `metricsJson` (kết quả cross-validation, test, baseline, k-curve), `datasetHash`, `nSamples`, `trainedAt`. ML service huấn luyện xong lưu artifact mới nhưng **kích hoạt ngay** trên tiến trình ML (không đợi promote) — việc "chính thức hóa" làm CHAMPION trong hệ thống backend vẫn cần bước promote riêng.

- **`POST /api/models/:version/promote`** — quy tắc an toàn khi promote (kiểm tra tất cả trước khi cho phép):
  1. Nếu đang có CHAMPION (loại `CLASSIFIER`): từ chối nếu macro-F1 của challenger trên tập test thấp hơn macro-F1 của champion quá `0.02` (`challengerF1 < championF1 - 0.02`).
  2. Từ chối nếu bất kỳ lớp phân khúc nào (bỏ qua các dòng tổng hợp `accuracy`, `macro avg`, `weighted avg`) có `f1-score < 0.5` trên tập test.
  3. Nếu qua cả hai điều kiện: gọi ML `/models/{version}/activate` để nạp artifact challenger làm phiên bản đang chạy, sau đó trong một transaction: chuyển mọi `ModelVersion` đang `CHAMPION` sang `ARCHIVED`, chuyển challenger sang `CHAMPION` (ghi `promotedAt`, `promotedById`), và ghi `AuditLog` hành động `PROMOTE_MODEL`.

- **`POST /api/models/:version/rollback`**: kích hoạt lại một phiên bản cũ bất kỳ làm CHAMPION ngay lập tức — gọi ML `/models/{version}/activate`, rồi trong transaction chuyển CHAMPION hiện tại sang `ARCHIVED` và phiên bản được chọn sang `CHAMPION`, ghi `AuditLog` hành động `ROLLBACK_MODEL`. Rollback **không kiểm tra** bất kỳ điều kiện chỉ số nào — dùng khi một phiên bản mới promote hóa ra tệ hơn thực tế, cần quay lại ngay.

## 5. Ghi đè tri thức và cân bằng trải nghiệm

| Cơ chế | Bảng | Tác dụng |
|---|---|---|
| Khóa nhãn (`locked`) | `SegmentLabel.locked` | Mô hình A không được tự đổi nhãn máy này (mục 1, 3) |
| Ghim (PIN) | `LaptopPin` (`action = PIN`) | Ưu tiên đưa máy vào kết quả gợi ý |
| Cấm (BAN) | `LaptopPin` (`action = BAN`) | Loại máy khỏi mọi gợi ý (vd ngừng kinh doanh) |
| Cấu hình ngưỡng/trọng số | `KnowledgeConfig` | `confidence_threshold` (mục 1), `alert_thresholds` (mục 6) và các khóa cấu hình khác đọc/ghi qua `GET/PUT /api/knowledge/config/:key` |

## 6. Sáu luật cảnh báo tự động (`alertScan`)

Cài đặt trong `backend/src/modules/jobs/alertScan.ts`, chạy định kỳ mỗi giờ qua cron và ngay lúc khởi động server, có thể chạy thủ công qua `POST /api/dashboard/alerts/scan`. Ngưỡng mặc định nằm trong code, có thể ghi đè qua `KnowledgeConfig` khóa `alert_thresholds`. Mỗi luật chạy trong `try/catch` riêng để một luật lỗi không làm hỏng các luật còn lại; một mã cảnh báo chỉ được tạo dòng `AlertLog` mới nếu chưa có dòng cùng mã đang `resolved = false` (tránh spam trùng).

| Mã | Cửa sổ dữ liệu | Điều kiện | Ngưỡng mặc định | Mức |
|---|---|---|---|---|
| `LOW_SATISFACTION` | 7 ngày gần nhất, cần ≥ 30 phiên tư vấn | `LIKE / (LIKE + DISLIKE) < ngưỡng` | `0.4` | WARN |
| `FALLBACK_HIGH` | 24 giờ gần nhất | `số phiên có isFallback=true / tổng số phiên > ngưỡng` | `0.05` | CRITICAL |
| `LATENCY_HIGH` | 7 ngày gần nhất, cần ≥ 30 phiên tư vấn | `p95(latencyMs) > ngưỡng` (mili-giây) | `800` | WARN |
| `LOW_CONFIDENCE_RATE` | Laptop tạo trong 30 ngày gần nhất | `tỷ lệ máy có SegmentLabel.confidence < 0.6 > ngưỡng` | `0.3` | WARN |
| `REVIEW_BACKLOG` | không giới hạn thời gian | `số SegmentLabel.status = NEEDS_REVIEW > ngưỡng` | `20` | INFO |
| `RANK1_WEAK` | 7 ngày gần nhất, cần ≥ 30 phiên tư vấn | tỷ lệ 👍 của item xếp hạng #1 thấp hơn tỷ lệ 👍 trung bình của các item hạng khác (so sánh tương đối, không có ngưỡng số cố định) | — | WARN |

Ghi chú:
- Điều kiện "≥ 30 phiên trong 7 ngày" áp dụng chung cho 4 luật (`LOW_SATISFACTION`, `LATENCY_HIGH`, `RANK1_WEAK` dùng đúng cửa sổ 7 ngày này; `FALLBACK_HIGH` dùng cửa sổ 24 giờ riêng, không yêu cầu số phiên tối thiểu; `REVIEW_BACKLOG` không dùng cửa sổ thời gian).
- `LOW_CONFIDENCE_RATE` dùng ngưỡng tin cậy `0.6` cố định trong code cho việc đếm "máy có tin cậy thấp" — độc lập với `confidence_threshold` cấu hình được ở mục 1 (hai giá trị hiện đang trùng mặc định nhưng là hai tham số khác nhau).
- `RANK1_WEAK` không so với một con số cố định mà so sánh trực tiếp tỷ lệ 👍 của hạng #1 với tỷ lệ 👍 trung bình các hạng #2–#5 trong cùng cửa sổ; cảnh báo bật khi hạng #1 thua các hạng sau — dấu hiệu trọng số xếp hạng của Mô hình B cần xem lại.

Kết quả mỗi luật (khi vi phạm) được ghi vào `AlertLog` với `code`, `severity`, `message` (câu tiếng Việt có kèm số liệu cụ thể), `value` (giá trị đo được) và `threshold` (ngưỡng đang áp dụng), hiển thị ở khối "Cảnh báo đang mở" trên Dashboard (`GET /api/dashboard/alerts`) và có thể đánh dấu đã xử lý qua `PATCH /api/dashboard/alerts/:id/resolve`.
