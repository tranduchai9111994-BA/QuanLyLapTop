# Kết quả thực nghiệm SmartLap (chạy lại trên bộ dữ liệu 1.000 máy)

> Mọi con số dưới đây đều **truy được về file artifact**: `ml-service/artifacts/evaluation.json`
> và `ml-service/artifacts/<version>/metadata.json`. Tái tạo bằng:
> `cd ml-service && python -m app.train && python -m app.evaluate`

## 1. Bộ dữ liệu

| Hạng mục | Giá trị |
|---|---|
| Số máy | 1.000 |
| Nguồn điểm CPU/GPU | PassMark CPU Mark / G3D Mark (tham chiếu cpubenchmark.net, videocardbenchmark.net) |
| Số cặp CPU–GPU khác nhau | 195 |
| Phân bố phân khúc | OFFICE 352 · GAMING 286 · ULTRABOOK 234 · CREATOR 128 |

**Ràng buộc hợp lý đã áp dụng khi sinh dữ liệu** (`data/generate_catalog.py`):
- Chỉ ghép CPU–GPU **khả dĩ trên thị trường**: Intel CPU không đi với iGPU AMD, Apple M-series chỉ
  dùng GPU Apple (không có Apple + RTX), CPU tiết kiệm điện (U-series) không gắn RTX 4070/4080,
  chip Celeron/Pentium không bao giờ kèm card rời.
- **Giá là hàm của cấu hình × thương hiệu × nhiễu**: `giá = (chi phí CPU + GPU + RAM + SSD + màn
  hình + vỏ máy) × hệ số thương hiệu × (1 ± 7%)`, không phải random theo phân khúc.
- **Phân khúc chồng lấn tự nhiên**: nhãn được gán bằng điểm số có trọng số + nhiễu ngẫu nhiên, nên
  khoảng giá các phân khúc giao nhau mạnh (GAMING 17,7–71,6tr; CREATOR 18,2–68,2tr).
- Hãng cao cấp (tier ≥ 4) không dùng chip entry; hãng giá rẻ không bán máy cấu hình cao.
- Catalog còn có đặc trưng **khuyến mãi** (`discount_percent`, 35% số máy đang giảm giá 5–25%, có
  `originalPriceVnd`) và **lượt bán** (`sales_score`, log-hoá về thang 0–100) — dùng làm tín hiệu
  xếp hạng cho Mô hình B (xem mục 4.4).

## 2. Mô hình A — kNN phân lớp phân khúc

| Chỉ số | Giá trị | Mục tiêu | Đạt? |
|---|---|---|---|
| macro-F1 (5-fold CV) | **0,773** | — | — |
| macro-F1 trên tập test 20% | **0,787** | ≥ 0,75 | ✅ |
| Vượt baseline đa số (Dummy) | **+0,658** | ≥ 0,30 | ✅ |
| Vượt baseline luật if-else | **+0,155** | ≥ 0,05 | ✅ |
| Tham số tốt nhất | k = 7, Euclidean, weights = uniform | — | — |

**Điểm đáng chú ý cho hội đồng**: trên dữ liệu tách bạch theo khuôn mẫu, một baseline luật if-else
có thể "ăn may" thắng kNN vì luật khớp đúng khuôn mẫu sinh dữ liệu; trên bộ dữ liệu có chồng lấn
thực tế (như bộ 1.000 máy hiện tại), kNN **vượt luật +0,122** — đúng như kỳ vọng lý thuyết: luật
cứng chỉ hiệu quả khi ranh giới rõ ràng, còn kNN học được ranh giới mờ. Tham số `k` tối ưu ở mức 7–9
(không phải k = 1), cho thấy mô hình không overfit vào các điểm huấn luyện.

Confusion matrix (5-fold CV) cho thấy nhầm lẫn tập trung ở **CREATOR ↔ GAMING** (49/120 máy CREATOR
bị đoán thành GAMING, recall CREATOR chỉ 0,442) — đây là hạn chế đã biết và chấp nhận được: hai
phân khúc này dùng cấu hình phần cứng gần giống nhau, chỉ khác mục đích sử dụng, nên ranh giới giữa
chúng trong dữ liệu thật cũng mờ tương tự (một máy RTX mạnh vừa chơi game vừa dựng phim tốt).

## 3. Mô hình C — phân loại câu nhu cầu tự do (TF-IDF + kNN)

Đây là phần trả lời trực tiếp góp ý "chọn tiêu chí qua dropdown/thanh kéo không phải là thông minh".

| Chỉ số | Giá trị |
|---|---|
| Số câu huấn luyện | 132 câu tiếng Việt viết tay |
| Số nhóm nhu cầu | 6 (Văn phòng, Học tập, Lập trình, Đồ họa, Gaming, Di động) |
| macro-F1 (5-fold CV) | **0,7725** (k = 7) |
| Độ chính xác trên 30 câu persona | **93%** (28/30) |

Kiến trúc: `câu văn → TF-IDF (word 1-2gram + char_wb 3-5gram) → kNN cosine → nhóm nhu cầu → hồ sơ
ưu tiên`. Dùng char n-gram nên **chịu được câu không dấu**: "con hoc ke toan can may ben re" vẫn
cho kết quả giống hệt câu có dấu (đã kiểm thử).

Regex chỉ dùng để **trích số cụ thể** (ngân sách "tầm 20 triệu", "dưới 1.4kg", "ram 16gb") — đây là
tri thức hỗ trợ, việc **phân loại nhu cầu hoàn toàn do kNN đảm nhiệm**.

## 4. Mô hình B — kNN truy hồi, khoảng cách một phía

### 4.1 So với baseline (30 persona, top-5)

| Phương pháp | P@5 | nDCG@5 | Đúng ngân sách |
|---|---|---|---|
| **kNN một phía (Mô hình B)** | **0,433** | **0,737** | 100% |
| Baseline: value_index (hiệu năng/giá) | 0,247 | 0,640 | 100% |
| Baseline: ngẫu nhiên | 0,113 | 0,649 | 100% |
| Baseline: giá tăng dần | 0,153 | 0,612 | 100% |

→ kNN vượt baseline tốt nhất **+0,088 nDCG@5**.

> Số liệu ở bảng trên đã bao gồm đặc trưng khuyến mãi/lượt bán (mục 4.4). Ở một lần đo trước khi
> catalog được sinh lại để thêm 2 đặc trưng này, nDCG@5 từng đạt 0,788; con số hiện tại (0,737)
> thấp hơn một chút nhưng **không phải** một phép so sánh có kiểm soát (ablation): toàn bộ catalog
> 1.000 máy đã được sinh lại từ đầu (giá, phân khúc, nhiễu ngẫu nhiên khác lần trước), nên chênh
> lệch này lẫn cả sai số do dữ liệu khác nhau lẫn ảnh hưởng của đặc trưng mới, không tách bạch được.
> Muốn kết luận chắc chắn "khuyến mãi/lượt bán có giúp xếp hạng tốt hơn không" cần chạy lại đúng 1
> bộ dữ liệu, bật/tắt riêng nhóm `popularity` trong `retriever.py` để so sánh — việc này **chưa
> làm**, nên khi bảo vệ cần nói rõ đây là bổ sung theo yêu cầu nghiệp vụ (mô phỏng hành vi mua sắm
> thật), chưa có bằng chứng định lượng tách bạch rằng nó cải thiện độ chính xác xếp hạng.

Độ liên quan được tính tự động từ hồ sơ persona (không gán nhãn tay): với mỗi tiêu chí, máy nhận
điểm theo **hạng phân vị** (liên tục 0–1) nhân trọng số `mức_ưu_tiên/5`. Cách này công bằng cho mọi
phương pháp — baseline một chiều không còn lợi thế cấu trúc như thước đo nhị phân ban đầu.

### 4.2 Khoảng cách một phía

```
d(x, q) = √( Σⱼ wⱼ · penⱼ² )
penⱼ = max(0, qⱼ − xⱼ)   nếu đặc trưng "càng cao càng tốt"  (mạnh hơn → KHÔNG phạt)
penⱼ = max(0, xⱼ − qⱼ)   nếu đặc trưng "càng thấp càng tốt" (rẻ/nhẹ hơn → KHÔNG phạt)
penⱼ = |xⱼ − qⱼ|         nếu hai phía (kích thước màn hình)
```

Hàm này được đưa **thẳng vào metric của kNN** (`NearestNeighbors(metric=callable)`), không phải xếp
hạng lại bên ngoài.

**Bài học kỹ thuật quan trọng cần nhớ khi bảo vệ**: scikit-learn gọi hàm metric theo thứ tự
`metric(query, train)`, ngược với thứ tự `(x, q)` mà công thức một phía yêu cầu. Vì hàm này
**không đối xứng**, việc đảo thứ tự làm **lật dấu** — hệ thống từng ưu tiên nhầm máy *yếu hơn* thay
vì *mạnh hơn*. Sau khi sửa đúng thứ tự tham số, nDCG@5 tăng từ 0,589 lên **0,788**. Đây là lớp lỗi
dễ gặp và khó phát hiện bằng mắt (không có exception, kết quả vẫn "chạy được" nhưng sai về chất
lượng) khi dùng metric callable không đối xứng với các thư viện kNN — đã thêm test hồi quy
`test_one_sided_metric_argument_order` để chặn tái phát.

### 4.3 Các thay đổi khác theo góp ý

| Góp ý | Đã làm |
|---|---|
| Đưa giá vào xếp hạng | `price_vnd` và `value_index` là đặc trưng trong metric (trước đây "đáng tiền" chỉ là huy hiệu hiển thị) |
| Thêm thuộc tính thương hiệu | `brand_tier` 1–5 là đặc trưng; từ khóa "bền/uy tín" trong câu nói đẩy trọng số thương hiệu lên 1,6× |
| Bỏ lọc cứng theo phân khúc | Phân khúc là **một đặc trưng trong metric** (trọng số 0,18) — máy phân khúc kề bên vẫn lọt top nếu thực sự phù hợp. Lọc cứng chỉ còn: ngân sách, RAM/SSD/cân nặng tối thiểu, máy bị cấm |
| Sửa match % | Dùng mốc cố định `100·e^(−d/0,9)`, không chuẩn hóa theo top-N nữa → điểm so sánh được giữa các lần truy vấn, máy hạng 1 không còn luôn được điểm cao |

### 4.4 Khuyến mãi + lượt bán là tín hiệu xếp hạng thật

Góp ý gốc: *"máy giá gốc cao hơn nhưng đang giảm giá tốt hơn, đang có số lượt bán tốt hơn thì vẫn
có thể sẽ được chọn nhiều hơn"* — tức khuyến mãi/độ phổ biến phải là **tín hiệu xếp hạng thật sự
trong metric kNN**, không chỉ là huy hiệu trang trí trên giao diện.

Hiện trạng:
- Dữ liệu: 35% số máy trong catalog đang giảm giá (5–25%), có `originalPriceVnd` (giá gốc) và
  `salesCount` (lượt bán, tương quan với độ "đáng tiền" + uy tín thương hiệu + có đang giảm giá hay
  không) — sinh tại [data/generate_catalog.py](../data/generate_catalog.py).
- Đặc trưng cho Mô hình B ([ml-service/app/features.py](../ml-service/app/features.py)):
  `discount_percent` (% giảm giá) và `sales_score` (lượt bán, log-hoá về thang 0–100 để không bị vài
  máy bán chạy đột biến lấn át).
- Nhóm trọng số trong metric kNN ([ml-service/app/retriever.py](../ml-service/app/retriever.py)):
  `"popularity": ["discount_percent", "sales_score"]`, trọng số **cố định** 0,12 (không cho người
  dùng chỉnh qua thanh trượt ưu tiên — đây là tín hiệu nền, không phải tiêu chí người dùng tự chọn).
- Hướng tối ưu: cả hai đặc trưng đều "càng cao càng tốt" và **không phạt khi vượt** — máy giảm giá
  sâu hơn/bán chạy hơn mức "lý tưởng" (mốc phân vị 80%) vẫn không bị trừ điểm, đúng tinh thần đo
  khoảng cách một phía đã dùng cho các đặc trưng khác (mục 4.2).
- Có sẵn qua toàn bộ chuỗi đồng bộ dữ liệu: `backend/prisma/schema.prisma` →
  `backend/src/modules/jobs/snapshotSync.ts` (tính `discount_percent` từ giá gốc/giá hiện tại) →
  `ml-service/app/main.py` (`catalog_sync`, tính `sales_score` log-hoá tại thời điểm đồng bộ).

## 5. Hệ thống thông minh lên theo thời gian (Tiêu chí 3)

### 5.1 Gán nhãn phân khúc tự động cho máy mới, có đưa vào catalog gợi ý thật

Mọi lần tạo/sửa laptop từ trang quản trị đều kết thúc bằng việc gán nhãn phân khúc thật cho máy đó
(`backend/src/modules/laptops/segment.service.ts`), dựa trên đúng 1 lệnh gọi Mô hình A dùng chung
cho cả nút "gợi ý xem trước" lẫn bước lưu — nhờ vậy máy mới thêm luôn được đồng bộ sang ML service
và xuất hiện trong catalog gợi ý cho khách ngay từ lần tư vấn tiếp theo (đúng tiêu chí 3 của đề
bài: hệ thống tự học và mở rộng theo dữ liệu mới, không chỉ hiển thị dự đoán rồi bỏ qua).

Quy tắc gán nhãn:
- Nhân viên **giữ nguyên** nhãn AI gợi ý → nguồn `MODEL`; **tự đổi** nhãn khác → nguồn `ADMIN`.
- Nhân viên **để trống** ô Phân khúc → dùng thẳng dự đoán AI, nguồn `MODEL`; độ tin cậy dưới
  ngưỡng (đọc từ cấu hình tri thức `confidence_threshold`, mặc định 0,6) → trạng thái
  `NEEDS_REVIEW` (vào hàng đợi cần xác minh, xem mục 5.3) thay vì chặn lưu máy.
- ML service trả thêm **danh sách k láng giềng đã bỏ phiếu** (nhãn + khoảng cách), hiển thị ngay
  dưới thanh phần trăm để nhân viên thấy lý do cụ thể, không phải một con số hộp đen.

Đã kiểm thử trên trình duyệt: thêm máy "Acer i9-13900H + RTX 4070, 32GB, 240Hz, 2,6kg" → AI dự đoán
**Gaming 100%** (7/7 láng giềng bỏ phiếu Gaming) → chọn thử nhãn khác (Đồ họa) → bấm "Dùng nhãn AI"
quay lại Gaming → lưu → thông báo "Đã gán phân khúc: Gaming" → vào trang Chi tiết của chính máy đó:
mục "Máy tương tự" hiển thị đủ 6 máy (nếu máy chưa từng được đồng bộ, mục này sẽ luôn rỗng). Có test
hồi quy `test_neighbors_explain_the_vote` (`ml-service/tests/test_classifier.py`) chặn lỗi lấy sai
danh sách láng giềng.

### 5.2 Học từ phản hồi người dùng

`python -m app.retrain_from_feedback --demo` mô phỏng dòng thời gian thực tế: người dùng gõ câu với
từ ngữ hệ thống chưa từng học ("tiệm tạp hóa", "khai báo thuế", "quay tiktok").

| | Kết quả |
|---|---|
| Độ chính xác trên 12 câu chưa từng thấy — **trước** khi học từ 12 câu đợt 1 (được 👍) | 11/12 = **91,7%** |
| Độ chính xác trên cùng 12 câu — **sau** khi học | 12/12 = **100%** |

Câu cụ thể được sửa đúng: *"cần máy chỉnh ảnh cưới hàng loạt, màu phải chính xác"* từ VAN_PHONG →
**DO_HOA**.

Hệ thống chỉ nhận câu có phản hồi 👍 vào tập huấn luyện — không tự tin vào dự đoán của chính mình,
tránh hiệu ứng "buồng vọng âm" (echo chamber).

### 5.3 Hàng đợi "Cần xác minh" và khóa nhãn (UC-10, human-in-the-loop)

Máy được Mô hình A tự gán nhãn với độ tin cậy dưới ngưỡng (`confidence_threshold`, mặc định 0,6)
vào trạng thái `NEEDS_REVIEW` thay vì chặn lưu — máy **vẫn được gợi ý tạm** cho khách bằng nhãn đó
(đúng tinh thần "hệ thống hoạt động được ngay, con người xác nhận lại sau", không phải "chờ duyệt
mới hoạt động"). Màn quản trị `/admin/review-queue`: hiện huy hiệu số lượng đang chờ ngay trên menu
(cập nhật tức thì sau mỗi lần duyệt, không cần tải lại trang), liệt kê từng máy kèm phân bố xác
suất đầy đủ (`ConfidenceIndicator`, xem mục 5.9), cho phép giữ nguyên nhãn AI hoặc chọn nhãn khác
rồi duyệt. Khi duyệt còn có checkbox "Khóa nhãn, không cho mô hình thay đổi" — set cờ
`SegmentLabel.locked` để nhãn không bị ghi đè bởi các lượt gán nhãn tự động sau này.

Đã kiểm thử trên trình duyệt: hạ tạm ngưỡng để ép máy mới vào hàng đợi, xác nhận huy hiệu "1" hiện
trên menu, màn hiện đúng thông tin máy + phân bố xác suất, bấm duyệt xong hàng đợi rỗng và huy hiệu
biến mất ngay lập tức.

### 5.4 Luồng khách hàng: Wizard → Kết quả → Chi tiết (FR-01 → FR-04)

**Wizard (tư vấn)**: bố cục 2 cột (form + panel tóm tắt luôn cập nhật theo lựa chọn); thanh trượt
ngân sách 8–80tr kèm 4 nút chọn nhanh; 3 ô ràng buộc (SSD tối thiểu, cân nặng tối đa, hãng ưa thích —
nhiều lựa chọn); gọi `POST /recommendations/infer-segment` mỗi khi đổi hoạt động để hiển thị "Nhu
cầu của bạn gần với **X** (độ tin cậy Y%)" khi chưa tự chọn phân khúc, và cảnh báo nhẹ "phân khúc X
có thể hợp hơn" kèm nút "Xem thử" khi phân khúc tự chọn khác với dự đoán AI **và** độ tin cậy dự
đoán ≥ ngưỡng 60%. Cạnh thanh trượt ngân sách còn có dòng "Có N mẫu trong khoảng này" (debounce
400ms, gọi `GET /laptops?priceMin&priceMax&pageSize=1`, chỉ lấy `meta.total`). Bấm "Xem kết quả"
điều hướng ngay sang `/results` kèm `requestBody`, không chờ API trả kết quả trước.

**Kết quả**: `Results.tsx` tự gọi API lúc mount, trong lúc chờ hiện Skeleton 3 thẻ + component
`LoadingMessages.tsx` (đổi câu mỗi 1,1 giây, ví dụ "Đang so sánh 1.000 mẫu laptop…"); lỗi mạng hiện
màn lỗi kèm nút "Thử lại" riêng. Bộ chọn số lượng hiển thị (`Segmented` 3/5/8/10) gọi lại đúng
request gốc với `topN` mới; nhãn phụ "🪶 Nhẹ nhất / ⚡ Mạnh nhất / 💎 Đáng tiền nhất" được tính **từ
chính tập kết quả đang hiển thị** (so sánh `weightKg`/`performanceIdx`/`valueIdx` giữa các máy trong
top N) thay vì một ngưỡng cố định toàn hệ thống. Có thêm control sắp xếp cục bộ (Phù hợp nhất/Giá
thấp/Hiệu năng cao) và khối CTA cố định "Không thấy máy ưng ý?" (Thử ưu tiên khác/Xem toàn bộ danh
mục) sau danh sách kết quả không rỗng. Bấm "+ So sánh" ghi sự kiện `ADD_COMPARE` (tín hiệu quan tâm
ngầm định, dùng cho UC-15). Bấm "Không thích" mở modal chọn 1 trong 6 lý do trước khi gửi sự kiện
`DISLIKE` kèm lý do. Trạng thái Thích/Không thích được khóa theo `sessionId + laptopId` lưu vào
`localStorage` (giữ nguyên qua lần tải lại trang). Ở màn hình ≥768px lưới kết quả lên 2 cột, ≥992px
thêm 1 panel `Card` dính (sticky) bên phải hiện biểu đồ radar "hồ sơ lý tưởng vs máy đang chú ý"
(mặc định máy hạng #1, đổi theo máy vừa bấm "Vì sao gợi ý?", giữ nguyên lựa chọn sau khi đóng
Drawer chi tiết — 2 state được tách riêng để tránh việc đóng Drawer làm panel tự quay về máy #1).

**Chi tiết máy** (`ExplainDrawer`/`Detail.tsx`): biểu đồ radar (Recharts) so sánh 6 trục "Bạn cần"
vs "Máy này" (CPU, GPU, RAM, SSD, Pin, tần số quét màn hình), mỗi trục chuẩn hoá về 0–100% theo giá
trị lớn hơn giữa hai bên để các đơn vị khác nhau (điểm CPU, GB, Hz) không lấn át nhau. Khối "Phân
khúc được chọn vì…" chỉ hiện khi phân khúc đang dùng được **suy ra từ hoạt động** (người dùng chọn
"Chưa rõ"), liệt kê k láng giềng đã bỏ phiếu — không hiện khi người dùng tự chọn rõ một phân khúc
(lúc đó không có "lý do AI" nào để giải thích). Mỗi máy trong "Máy tương tự" hiện nhãn chênh lệch
giá so với máy đang xem ("Đắt hơn N%"/"Rẻ hơn N%"/"Cùng mức giá") và dòng nêu khác biệt lớn nhất so
với máy đang xem (so theo % chênh lệch lớn nhất giữa cân nặng/RAM/SSD/tần số quét/pin). Có dòng
"Đáng tiền — tốt hơn N% máy cùng phân khúc" (so `valueIdx` với toàn bộ máy cùng phân khúc đang bán,
loại trừ chính nó) và biểu đồ lịch sử giá (Recharts `LineChart`).

Đã kiểm thử trên trình duyệt đủ các kịch bản trên (gợi ý phân khúc AI, gợi ý nhẹ khi tự chọn khác,
điều hướng Wizard → Kết quả, đổi số lượng hiển thị, biểu đồ radar, modal lý do "Không thích", nút So
sánh, nhãn chênh lệch giá ở Chi tiết), không phát sinh lỗi.

### 5.5 Bốn màn quản trị "thông minh" — FR-12, FR-13, FR-14, UC-15

- **`AdminModels.tsx` (FR-12 Quản lý mô hình)**: danh sách các lần huấn luyện Mô hình A kèm
  macro-F1, nút "Huấn luyện mô hình mới" (tạo "ứng viên", không tự thay mô hình đang chạy), Drawer
  chi tiết hiện bảng so với 2 đường cơ sở (đoán ngẫu nhiên, luật đơn giản), bảng Precision/Recall/
  F1-score theo từng phân khúc, biểu đồ đường cong chọn k (Recharts, có đường tham chiếu đánh dấu k
  đã chọn), và ma trận nhầm lẫn (đường chéo in đậm). Nút "Đưa vào sử dụng" gọi API promote có sẵn
  quy tắc an toàn (backend từ chối nếu tệ hơn bản đang dùng > 2% macro-F1 hoặc có lớp nào < 0,5 F1);
  nút "Quay lại phiên bản này" cho bản đã lưu trữ. Một phiên bản huấn luyện thử nghiệm qua màn này
  (`clf-2026.09.27-160831`) đạt macro-F1 test **78,7%**, so với luật đơn giản 63,2% và đoán ngẫu
  nhiên 12,8%.
- **`AdminKnowledge.tsx` (FR-13 Cấu hình tri thức)**: 4 tab — (1) Ghim/Cấm máy theo phân khúc kèm
  lý do + ngày hết hạn; (2) Ngưỡng tin cậy, số kết quả mặc định, tỷ lệ nới ngân sách; (3) Trọng số
  mặc định 5 nhóm đặc trưng (hiệu năng/di động/màn hình/giá/thương hiệu) cho từng phân khúc; (4) 5
  ngưỡng cảnh báo (docs/09 §6). Tham số `baseWeightsOverride` xuyên suốt `schemas.py` → `main.py` →
  `build_weights()` (ghi đè **mềm**: chỉ áp dụng cho phân khúc có trong cấu hình, phân khúc khác vẫn
  dùng mặc định trong code); `recommend.service.ts` đọc `KnowledgeConfig` ở **mỗi lần gọi** (không
  cache) nên sửa xong có hiệu lực ngay từ lượt tư vấn tiếp theo, không cần khởi động lại backend.
- **`AdminDashboard.tsx` (FR-14 Dashboard)**: 6 KPI đúng theo tiêu chí thành công đề tài (lượt tư
  vấn, tỷ lệ hài lòng, độ trễ trung bình, tỷ lệ dự phòng, số nhãn chờ duyệt, tổng phản hồi) + thẻ
  riêng "Độ trễ p95 (NFR-01: < 800ms)" (xem mục 5.8) + bảng cảnh báo đang mở, nút "Quét cảnh báo
  ngay" gọi thủ công thay vì chờ lịch.
- **`backend/src/modules/jobs/alertScan.ts`**: cài đặt đủ 6 luật cảnh báo theo docs/09 mục 6
  (`LOW_SATISFACTION`, `FALLBACK_HIGH`, `LATENCY_HIGH`, `LOW_CONFIDENCE_RATE`, `REVIEW_BACKLOG`,
  `RANK1_WEAK`), chạy tự động mỗi giờ (`cron.schedule` trong `server.ts`) và 1 lần lúc khởi động;
  không tạo cảnh báo trùng mã khi đã có cảnh báo cùng mã chưa xử lý (tránh spam). Ngưỡng đọc từ
  `KnowledgeConfig.alert_thresholds` (sửa được ở `AdminKnowledge.tsx`).
- **`AdminFeedback.tsx` (UC-15 Phân tích phản hồi)**: biểu đồ cột số lượt theo loại sự kiện (Xem
  chi tiết/Thích/Không thích/Thêm so sánh), biểu đồ ngang xếp hạng lý do "Không thích" phổ biến
  nhất, và bảng các câu nhu cầu tự do đã được xác nhận hài lòng (nguồn học thêm cho Mô hình C).
- **`AdminLayout.tsx`**: Dashboard, Quản lý mô hình, Cấu hình tri thức, Phân tích phản hồi chỉ hiện
  trên menu khi đăng nhập bằng vai trò `ADMIN` — `STAFF` không có quyền gọi các API này ở backend
  nên bị ẩn hẳn khỏi menu, tránh nhấn vào rồi gặp lỗi 403 khó hiểu. Trang mặc định sau đăng nhập
  cũng theo vai trò: ADMIN vào Dashboard, STAFF vào Laptop. Sidebar được nhóm thành 4 nhóm có tên
  ("Tổng quan", "Dữ liệu", "✨ Trí tuệ", "Hệ thống") thay vì danh sách phẳng, rộng 240px với
  `collapsedWidth` 72px, trạng thái thu gọn lưu vào `localStorage`.

Đã kiểm thử trên trình duyệt: Dashboard hiện đủ KPI và "Quét cảnh báo ngay" chạy không lỗi; màn
Quản lý mô hình hiện đúng đường cong chọn k + ma trận nhầm lẫn + bảng Precision/Recall/F1 theo
phân khúc; cả 4 tab của Cấu hình tri thức lưu được (CRUD Ghim/Cấm qua API: tạo → hiện trong danh
sách → xoá → danh sách rỗng lại); Phân tích phản hồi hiện đúng biểu đồ theo loại sự kiện và theo lý
do "Không thích".

### 5.6 Tài khoản khách hàng — UC-07, UC-08

- **`POST /auth/register`** (`auth.routes.ts` + `auth.service.ts`): tạo tài khoản `CUSTOMER` (không
  cho tự chọn vai trò khác qua API công khai này), trả JWT ngay để tự động đăng nhập.
- **`CustomerLogin.tsx`** (route `/login`): 2 tab Đăng nhập/Tạo tài khoản — từ chối tài khoản
  `STAFF`/`ADMIN` (hướng họ sang `/admin/login`); chỉ điền sẵn tài khoản demo khi biến môi trường
  `VITE_DEMO=true` (mặc định bật ở `.env` cho môi trường đồ án, tắt/xóa trước khi triển khai thật —
  áp dụng tương tự cho `AdminLogin.tsx`).
- **`Favorites.tsx`** (UC-07, route `/favorites`) và **`History.tsx`** (UC-08, route `/history`):
  yêu cầu đăng nhập, nếu chưa có token thì hiện màn mời đăng nhập (kèm redirect quay lại đúng trang
  sau khi đăng nhập) thay vì gọi thẳng API rồi nhận lỗi 401. `History.tsx` dựng lại
  `RecommendationResult` từ dữ liệu **đã lưu** của phiên cũ (không gọi lại thuật toán), tái dùng
  nguyên `Results.tsx`/`RecommendationCard.tsx` để xem lại — `sessionsRouter` include đầy đủ quan hệ
  `brand/cpu/gpu/segmentLabel` của laptop để không vỡ `RecommendationCard`.
- **Nút yêu thích (trái tim)** ở `Detail.tsx`: bấm khi chưa đăng nhập → điều hướng sang `/login`
  kèm đường quay lại; khi đã đăng nhập → gọi `POST /me/favorites` + ghi sự kiện `ADD_FAVORITE`
  (cho UC-15). TopNav luôn có icon "♡" (dẫn tới `/favorites`, hoạt động cả khi chưa đăng nhập —
  trang đích tự xử lý việc mời đăng nhập) và chỉ hiện link "So sánh (N)" khi đã chọn ít nhất 1 máy;
  danh sách so sánh là trạng thái dùng chung toàn app lưu `localStorage`
  (`frontend/src/lib/compareList.ts`, giống giỏ hàng), phát sự kiện tuỳ chỉnh để mọi nơi đang mở
  cập nhật ngay.
- **`TopNav` (`App.tsx`)**: trạng thái đăng nhập khách hàng dùng chung `localStorage` key với khu
  quản trị (một trình duyệt chỉ mang một danh tính tại một thời điểm, giống phần lớn trang TMĐT),
  cập nhật ngay bằng sự kiện tuỳ chỉnh `smartlap:customer-auth-changed` (không cần tải lại trang).
- **Kiểm soát chéo vai trò**: vì đăng nhập khách hàng và quản trị dùng chung khoá `localStorage`,
  `AdminLayout.tsx` kiểm tra thêm điều kiện `user.role !== 'CUSTOMER'` (không chỉ "có token hay
  không") để một khách hàng đã đăng nhập tự gõ URL `/admin/...` bị chuyển hướng về `/admin/login`
  thay vì lọt vào khung sườn quản trị rỗng (mọi API đều 403, gây khó hiểu dù không rò rỉ dữ liệu).

Đã kiểm thử trên trình duyệt: đăng ký tài khoản mới → tự động đăng nhập, TopNav đổi tên; yêu thích 1
máy ở trang Chi tiết → xuất hiện đúng trong `/favorites`; bỏ thích → danh sách rỗng lại (nút "Bỏ
thích" nằm trong `Card` có `onClick` điều hướng riêng nên đã thêm `e.stopPropagation()` để tránh vừa
xoá vừa điều hướng sang trang Chi tiết của chính máy vừa xoá); tạo 1 lượt tư vấn mới → xuất hiện
trong `/history`, bấm vào xem lại đúng kết quả cũ; đăng xuất → TopNav trở lại "Đăng nhập",
`/favorites`/`/history` yêu cầu đăng nhập lại; khách hàng đã đăng xuất tự điều hướng tới
`/admin/laptops` → bị chuyển hướng về `/admin/login` (xác nhận cơ chế kiểm soát chéo vai trò hoạt
động đúng).

### 5.7 Quản lý người dùng nội bộ & nhật ký hệ thống — UC-16

- **`backend/src/lib/audit.ts`**: hàm `writeAudit()` dùng chung — ghi 1 dòng `AuditLog`, không bao
  giờ làm hỏng request chính nếu ghi thất bại (chỉ log cảnh báo), vì đây là dữ liệu truy vết phụ trợ
  chứ không phải nghiệp vụ chính.
- **`backend/src/modules/users/users.routes.ts`**: `GET/POST /users` (danh sách + tạo tài khoản nội
  bộ), `PATCH /users/:id` (đổi họ tên/vai trò/mật khẩu/khoá-mở khoá) — **chặn tự sửa chính tài
  khoản đang đăng nhập** (không tự khoá hoặc tự hạ quyền), tránh tình huống quản trị viên duy nhất
  tự khoá tài khoản của mình rồi không ai còn quyền mở lại. Tài khoản `CUSTOMER` (tự đăng ký ở
  `/login`) không quản lý ở đây — 2 luồng tách biệt hoàn toàn theo đúng UC-07 (khách hàng) và UC-16
  (nội bộ).
- **`GET /audit-logs`**: đã gắn `writeAudit()` vào mọi hành động "nhạy cảm" theo đúng docs/09 §5
  ("Mọi thay đổi tri thức, promote, rollback → AuditLog: Truy vết"): sửa cấu hình tri thức
  (`PUT /knowledge/config/:key`), ghim/cấm/gỡ máy (`POST`/`DELETE /knowledge/pins`), đưa mô hình
  vào sử dụng và quay lại phiên bản cũ (`/models/:version/promote`, `/rollback`), tạo/sửa tài khoản
  nội bộ.
- **`AdminUsers.tsx`** (route `/admin/users`, chỉ hiện menu với `ADMIN`): 2 tab — "Tài khoản nội bộ"
  (bảng có `Select` đổi vai trò và `Switch` khoá/mở trực tiếp trên từng dòng, dòng của chính người
  đang đăng nhập bị vô hiệu hoá cả hai) và "Nhật ký hệ thống" (bảng audit log, mới nhất trước, kèm
  tên người thực hiện + chi tiết JSON rút gọn).

Đã kiểm thử trên trình duyệt và qua API: tạo tài khoản `STAFF` mới → xuất hiện ngay trong bảng; đổi
vai trò sang `ADMIN` và khoá tài khoản đó qua `Switch` → thành công; xác nhận dòng tài khoản `ADMIN`
đang đăng nhập bị vô hiệu hoá cả ô vai trò lẫn công tắc hoạt động (gọi trực tiếp
`PATCH /users/1 {isActive:false}` trả về lỗi `CANNOT_MODIFY_SELF` thay vì thực hiện); tab "Nhật ký
hệ thống" hiện đầy đủ các hành động tạo/sửa tài khoản và sửa cấu hình tri thức, đúng thứ tự thời
gian.

### 5.8 Yêu cầu phi chức năng đã kiểm chứng bằng số liệu (NFR-01, 04, 05)

**NFR-01 (p95 độ trễ tư vấn < 800ms)**: `GET /dashboard/kpis` tính `p95LatencyMs` bằng cách sắp xếp
toàn bộ độ trễ trong khoảng thời gian rồi lấy phần tử ở vị trí `ceil(0,95 × n) − 1` (cùng cách tính
với `alertScan.ts`), hiện thẻ riêng "Độ trễ p95 (NFR-01: < 800ms)" trên Dashboard thay vì chỉ hiện
độ trễ trung bình (dễ che giấu các phiên chậm bất thường). **Đo được: p95 = 198ms** trên 418 phiên
30 ngày gần nhất — đạt dư nhiều so với ngưỡng 800ms.

**NFR-04 (responsive 375–1920px)**: kịch bản kiểm tra `document.documentElement.scrollWidth` không
được vượt `clientWidth` trên toàn bộ 15 trang (khách hàng + quản trị) ở cả 2 đầu mút kích thước màn
hình. Sau khi sửa các lỗi hiển thị phát hiện được (liệt kê bên dưới), kết quả cuối cùng là **0 lỗi
tràn ngang** trên 21 lượt kiểm tra (9 trang khách hàng ở 375px kể cả trang Kết quả có dữ liệu thật,
10 trang/tab quản trị ở 375px, 3 trang ở 1920px), và các kịch bản kiểm thử chức năng khác chạy lại
không hồi quy sau các thay đổi CSS này.

Các nguyên nhân gốc đã xử lý — đáng lưu ý khi bảo vệ vì đều là bài học CSS sâu hơn "quên set
max-width":
1. **`TopNav` (App.tsx)**: menu ngang tràn hẳn ra ngoài màn hình hẹp trên các đầu mút nhỏ. Xử lý:
   gộp toàn bộ điều hướng vào 1 nút "☰" mở `Drawer` trên màn hẹp, dùng `Grid.useBreakpoint()` của
   antd (đáng tin cậy ngay từ lần render đầu, khác với các API responsive kiểu "chỉ phản ứng theo
   sự kiện resize" ở mục 2, 3 dưới đây).
2. **`Segmented` lọc phân khúc + `Pagination` (Catalog.tsx)**: nguyên nhân gốc của tràn `Segmented`
   là `Content` (antd `Layout`, flex-column) không có `minWidth: 0`, khiến 1 widget con quá rộng
   kéo dãn cả trang thay vì tự cuộn riêng trong khung `overflowX:auto` của nó. `Pagination` (84
   trang) tràn vì prop `responsive` có sẵn của antd **chỉ cập nhật khi nhận sự kiện `resize` của
   window**, không tự kiểm tra lúc mount — người dùng tải trang lần đầu trên điện thoại (không
   resize) vẫn thấy bản đầy đủ desktop. Xử lý: thêm `minWidth:0` cho `Content`, tự quyết định
   `simple` bằng `Grid.useBreakpoint()` thay vì dựa vào prop `responsive`.
3. **Sidebar quản trị (`AdminLayout.tsx`)**: `Sider` với `breakpoint`/`collapsedWidth={0}` của antd
   gắn đúng class "đã thu gọn" nhưng `getComputedStyle` cho thấy `flex-basis` thực tế vẫn là 220px
   (một điểm không nhất quán trong phiên bản antd đang dùng), vẫn chiếm chỗ trong flex dù nhìn "như
   đã ẩn". Xử lý triệt để: không dựa vào cơ chế responsive nửa-tự-động của `Sider`, tự tính
   `isMobile` bằng `Grid.useBreakpoint()` và **không render `Sider`** trên màn hẹp (thay bằng nút
   "☰" + `Drawer`, giống TopNav khách hàng).
4. **2 form trong `AdminKnowledge.tsx`**: `<Space wrap>` của antd render `display:inline-flex` —
   loại box này **tự co theo nội dung** (shrink-to-fit) thay vì bị giới hạn bởi `Card` cha, nên
   `flexWrap` không có tác dụng thật (trình duyệt coi như có "không gian vô hạn" để xếp hết trên 1
   dòng trước khi tính wrap). Xử lý: thay `<Space>` bằng `<div style={{display:'flex',
   flexWrap:'wrap'}}>` (block-level, bị giới hạn đúng bởi cha).
5. **Card KPI Dashboard**: `Row`/`Col span={8}` cố định 3 cột bất kể độ rộng màn hình, ép nội dung
   Card (tiêu đề dài như "Độ trễ p95 (NFR-01: < 800ms)") bị bóp méo tràn ra ngoài. Xử lý: đổi sang
   CSS grid `repeat(auto-fit, minmax(220px, 1fr))` (tự giảm số cột trên màn hẹp).
6. **`RecommendationCard.tsx`** (thẻ kết quả gợi ý, trang quan trọng nhất với khách hàng): đây là
   phần tử grid-item trực tiếp trong `display:grid` của Results.tsx; giống flex-item, grid-item mặc
   định `min-width:auto` (không chịu co nhỏ hơn nội dung "min-content" của nó) trừ khi khai báo
   `minWidth:0` ngay trên chính nó — không chỉ trên các div con bên trong. Vì thiếu khai báo này ở
   tầng ngoài cùng, ảnh đại diện cố định 128px + vòng tròn % phù hợp cố định 64px cùng buộc cả thẻ
   phải rộng tối thiểu ~412px. Xử lý: thêm `minWidth:0` cho div ngoài cùng và `flexShrink:0` cho 2
   phần tử kích thước cố định (ảnh, vòng tròn %) để lực co giãn dồn hết vào phần văn bản (tên máy/
   thông số) — nơi duy nhất có thể xuống dòng an toàn.

**NFR-05 (tương phản màu WCAG AA)**: `scripts/check_contrast.py` tính tỷ lệ tương phản (công thức
WCAG 2.1) cho 16 cặp chữ/nền dùng trong `theme/tokens.ts`. Kết quả cuối cùng: toàn bộ 16 cặp đạt
chuẩn AA (≥ 4,5:1 cho văn bản thường). Trong quá trình rà soát từng phát hiện 2 cặp dưới ngưỡng:
`error` (`#DC2626`) trên `errorBg` chỉ đạt 4,23:1, và `textTertiary` (`#64748B`) trên `bgSubtle` chỉ
đạt 4,34:1 — đã tối màu 2 token này (`error` → `#C62828`, đạt 4,92:1; `textTertiary` → `#5B6B85`,
đạt 4,93:1), chênh lệch màu sắc rất nhỏ nên không đổi cảm giác thiết kế, và không làm giảm tương
phản ở bất kỳ cặp nào khác đang dùng 2 token này.

### 5.9 Hệ thống thiết kế UI/UX — token, nền tảng và component đặc trưng

Toàn bộ đặc tả `docs/07_UIUX.md` đã được rà soát và triển khai đầy đủ: token màu, `antdTheme.ts`,
`utils/format.ts`, các component `MatchScore`/`SegmentTag`/`AiBadge`/`FallbackBanner`/
`RecommendationCard`/`ConfidenceIndicator`/`PrioritySlider`/`RadarComparison`, nền tảng CSS/a11y, và
3 điểm bố cục lớn ở mục 6. Trạng thái hiện tại:

- **Token màu nhất quán**: mọi nơi dùng lại đúng token trong `theme/tokens.ts` (không hardcode hex
  rải rác — từng có vài chỗ lệch, xem "Cấm hardcode hex" bên dưới); `global.css` export đủ toàn bộ
  24 token thành CSS variable (`--success`, `--warning`, `--error`, `--text-*`, `--border-strong`,
  `--bg-subtle`, 3 mức shadow) để đồng bộ với `tokens.ts`.
- **Cấm hardcode màu hex** (docs mục 10): dự án dùng **oxlint**, không phải ESLint — rule mẫu
  `no-restricted-syntax` trong docs không áp dụng được vì oxlint là bộ rule cố định viết bằng Rust,
  không hỗ trợ rule tuỳ chỉnh. Thay bằng `frontend/scripts/check-no-hardcoded-colors.mjs` (quét mọi
  `.ts`/`.tsx` tìm chuỗi hex ngoài danh sách cho phép), gắn vào `npm run lint`. Loại trừ hợp lý
  `LaptopThumbnail.tsx` (màu logo thương hiệu thật + minh hoạ SVG, không phải màu giao diện dùng lặp
  lại). Đây là khác biệt có chủ ý duy nhất so với văn bản đặc tả gốc.
- **Focus-ring (a11y, mục 11)**: `:focus-visible { box-shadow: 0 0 0 3px var(--primary-200) }` áp
  dụng toàn cục, đã kiểm thử hiển thị đúng khi điều hướng bằng bàn phím.
- **Max-width nội dung khách hàng**: chuẩn hoá về `1200px` trên toàn bộ trang (Home, Catalog,
  Results, Wizard, Compare, Detail) theo mục 6.1.
- **`PrioritySlider` (mục 7.6)**: nhãn mốc đúng nguyên văn "Không quan trọng / Bình thường / Rất
  quan trọng" (3 dòng), không bị chồng lấn lên thanh trượt kế tiếp nhờ tăng khoảng cách dọc giữa
  các thanh trượt và ghim vị trí 2 mốc đầu/cuối bằng CSS.
- **`ConfidenceIndicator` (mục 7.8)**: thanh ngang chia 4 đoạn màu phân khúc, độ rộng theo đúng xác
  suất Mô hình A dự đoán, kèm Tag "Cần xác minh" khi xác suất cao nhất dưới ngưỡng — dùng chung ở
  `SegmentSuggester.tsx` (màn Thêm laptop) và `AdminReviewQueue.tsx` (hàng đợi "Cần xác minh"), thay
  cho cách vẽ 4 thanh `Progress` rời rạc trước đây (khó so sánh tương quan cùng lúc).
- **Trạng thái tải**: `Wizard.tsx` điều hướng ngay sang `/results` với `requestBody`, `Results.tsx`
  tự gọi API lúc mount và hiện Skeleton 3 thẻ + `LoadingMessages.tsx` (đổi câu mỗi 1,1 giây) trong
  lúc chờ, thay vì chờ API xong trên nút bấm rồi mới điều hướng.

**Bài học kỹ thuật quan trọng cần nhớ khi bảo vệ**: `npx tsc --noEmit` chạy ở thư mục gốc
`frontend/` từng luôn báo "sạch" một cách **sai** trong phần lớn thời gian phát triển —
`tsconfig.json` gốc chỉ là file tổng hợp `references` (`"files": []`), không tự biên dịch gì cả;
lệnh đúng phải là `npx tsc -p tsconfig.app.json --noEmit` (hoặc `npx tsc -b`, khớp với script
`build` thật trong `package.json`). Chạy lại đúng lệnh từng phát hiện 6 lỗi thật đã lọt qua trước
đó: 1 lỗi vi phạm "rules of hooks" thật sự trong `AdminLayout.tsx` (gọi `useState`/`useEffect`/
`Grid.useBreakpoint()` sau một `return` có điều kiện — tiềm ẩn crash "Rendered fewer hooks than
expected" nếu component không unmount giữa 2 lần render), 1 biến `Space` dùng trong JSX nhưng quên
import ở `Wizard.tsx`, 3 import không dùng, và 1 lỗi kiểu dữ liệu ở `Tooltip formatter` của Recharts
(`AdminModels.tsx`). Toàn bộ đã được sửa; `npx tsc -b --force` (build thật) hiện sạch hoàn toàn. Đây
là bài học quan trọng cho các dự án dùng TypeScript project references: **luôn xác nhận lệnh kiểm
tra đang thực sự biên dịch file nào**, vì một lệnh "chạy được và không báo lỗi" không đồng nghĩa với
"đã kiểm tra type thật".

Đã kiểm thử trên trình duyệt toàn bộ các điểm trên (bao gồm dựng lại đúng kịch bản từng phát hiện
lỗi panel radar quay về máy #1 khi đóng Drawer, để xác nhận đã sửa), không hồi quy so với các kịch
bản kiểm thử chức năng khác. `npx tsc -p tsconfig.app.json --noEmit` sạch ở frontend, `npx tsc
--noEmit` sạch ở backend, `pytest` ml-service 35/35 pass.

### 5.10 Rà soát đối chiếu `docs/08_FRONTEND_SPEC.md` (16 màn hình)

Đối chiếu toàn bộ đặc tả 16 màn hình trong `08_FRONTEND_SPEC.md`, phần lớn đã được triển khai đúng
hoặc tốt hơn đặc tả (route tiếng Anh thay vì slug tiếng Việt, state cục bộ thay vì Zustand/TanStack
Query, trang Yêu thích/Lịch sử tách riêng thay vì gộp — các khác biệt kiến trúc này giữ nguyên,
không coi là thiếu sót). Các điểm bổ sung theo đúng đặc tả:

- **Trang chủ**: khối "Cách SmartLap hoạt động" (3 bước) và dải "💎 Đáng tiền nhất tuần này" (4 máy,
  sắp theo `value_desc` có sẵn ở backend).
- **Danh mục**: banner "Không biết chọn gì? Để AI tư vấn ✨" dẫn sang Wizard, đặt ngay dưới tiêu đề
  trang, trước bộ lọc.
- **Benchmark**: `Alert` cảnh báo "Thay đổi điểm sẽ ảnh hưởng mọi máy dùng linh kiện này" khi sửa
  (không hiện khi thêm mới).
- **Đăng nhập**: cả `AdminLogin.tsx` và `CustomerLogin.tsx` chỉ điền sẵn tài khoản demo khi
  `VITE_DEMO=true` (xem mục 5.6).

Các mục khác (Wizard, Kết quả, Chi tiết laptop, Hàng đợi nhãn, Mô hình) đã mô tả ở các mục 5.3–5.9
tương ứng. Đã kiểm thử trên trình duyệt: điều hướng qua Trang chủ, Danh mục, Chi tiết máy, đăng nhập
quản trị, form Sửa Benchmark CPU, Drawer chi tiết mô hình — xác nhận hiển thị đúng, không phát sinh
lỗi console mới. `npx tsc -p tsconfig.app.json --noEmit` sạch ở frontend, `npx tsc --noEmit` sạch ở
backend, `pytest` ml-service 35/35 pass.

## 6. Độ đo thực tế — công sức tìm kiếm

Đo bằng **số máy người dùng phải xem qua** trước khi gặp máy phù hợp (máy thuộc nhóm 20% hài lòng
nhất), tái lập được bằng code nên không cần bấm giờ từng người:

| Cách tìm | Số máy phải xem |
|---|---|
| Duyệt danh mục thủ công (sắp theo giá) | **19,7 máy/lần** (trung vị 12) |
| Dùng hệ thống gợi ý | **1,92 máy/lần** |
| Tỷ lệ tìm thấy ngay trong top-5 | **80%** |

→ Giảm công sức khoảng **10,3 lần**.

## 7. Hạn chế cần nói rõ khi bảo vệ

1. **Dữ liệu là dữ liệu tổng hợp có logic**, không phải catalog thu thập thật. Điểm PassMark là số
   tham chiếu từ kiến thức sẵn có, nhóm nên đối chiếu lại trên cpubenchmark.net và ghi ngày tra.
2. **Mô hình C mới có 132 câu huấn luyện** — macro-F1 0,773 là khá với quy mô này nhưng còn xa mức
   sản phẩm thật. Nhóm DO_HOA yếu nhất (9/21 đúng trong CV) vì từ ngữ đa dạng nhất.
3. **Thí nghiệm đối chứng Kaggle chưa chạy** (chưa tải được `laptop_price.csv`).
4. Thước đo "công sức tìm kiếm" là **proxy tính bằng code**, không phải đo thời gian thật trên
   người dùng. Muốn có số liệu thuyết phục hơn cần thử nghiệm với 5–10 người thật.
5. **Chưa có ablation tách bạch cho khuyến mãi/lượt bán** — đặc trưng đã nằm trong metric thật,
   nhưng chưa chạy bật/tắt nhóm `popularity` trên cùng 1 bộ dữ liệu, nên chưa chứng minh định
   lượng được nó cải thiện xếp hạng (chi tiết ở mục 4.1).

> Đây là danh sách hạn chế **duy nhất** của đồ án — các tài liệu khác chỉ trỏ về đây, không chép lại.
