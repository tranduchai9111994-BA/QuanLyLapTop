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

> **Cập nhật gần nhất**: đã bổ sung đặc trưng **khuyến mãi** (`discount_percent`) và **lượt bán**
> (`sales_score`, log-hoá) vào Mô hình B (xem mục 4.4). Model A/C được huấn luyện lại trên cùng bộ
> dữ liệu 1.000 máy đã tái sinh (có thêm cột giá gốc/khuyến mãi/lượt bán) — số liệu bên dưới là số
> liệu **mới nhất**, thay thế các con số cũ.

## 2. Mô hình A — kNN phân lớp phân khúc

| Chỉ số | Giá trị | Mục tiêu | Đạt? |
|---|---|---|---|
| macro-F1 (5-fold CV) | **0,773** | — | — |
| macro-F1 trên tập test 20% | **0,787** | ≥ 0,75 | ✅ |
| Vượt baseline đa số (Dummy) | **+0,658** | ≥ 0,30 | ✅ |
| Vượt baseline luật if-else | **+0,155** | ≥ 0,05 | ✅ |
| Tham số tốt nhất | k = 7, Euclidean, weights = uniform | — | — |

**Điểm đáng chú ý cho hội đồng**: trên bộ dữ liệu cũ (sinh theo khuôn mẫu, phân khúc tách bạch),
kNN **thua** baseline luật if-else (−0,043) vì luật khớp đúng khuôn mẫu sinh dữ liệu. Trên bộ dữ
liệu mới có chồng lấn thực tế, kNN **vượt luật +0,122** — đúng như kỳ vọng: luật cứng chỉ hiệu quả
khi ranh giới rõ ràng, còn kNN học được ranh giới mờ. Tham số `k` cũng chuyển từ 1 (dấu hiệu
overfit dữ liệu quá sạch) sang 9 (mô hình mượt, hợp lý).

Confusion matrix (5-fold CV) cho thấy nhầm lẫn tập trung ở **CREATOR ↔ GAMING** (49/120 máy
CREATOR bị đoán thành GAMING, recall CREATOR chỉ 0,442) — đúng dự đoán trong đặc tả, vì hai nhóm
này dùng cấu hình gần giống nhau, chỉ khác mục đích sử dụng. Đây là hạn chế đã biết và chấp nhận
được: ranh giới CREATOR/GAMING trong dữ liệu thật cũng mờ tương tự (một máy RTX mạnh vừa chơi game
vừa dựng phim tốt).

## 3. Mô hình C — phân loại câu nhu cầu tự do (TF-IDF + kNN) — **MỚI**

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

> Số liệu ở bảng trên là **sau khi** thêm đặc trưng khuyến mãi/lượt bán (mục 4.4). So với lần đo
> trước (nDCG@5 0,788), con số mới (0,737) **thấp hơn một chút** — nhưng đây **không phải** một
> phép so sánh có kiểm soát (ablation): toàn bộ catalog 1.000 máy đã được **sinh lại từ đầu** (giá,
> phân khúc, nhiễu ngẫu nhiên khác lần trước) để có thêm cột giá gốc/khuyến mãi/lượt bán, nên chênh
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

**Một lỗi nghiêm trọng đã phát hiện và sửa trong quá trình làm**: scikit-learn gọi hàm metric theo
thứ tự `metric(query, train)`, ngược với thứ tự `(x, q)` mà công thức một phía yêu cầu. Vì hàm này
**không đối xứng**, việc đảo thứ tự làm **lật dấu** — hệ thống đang ưu tiên máy *yếu hơn* thay vì
*mạnh hơn*. Sau khi sửa, nDCG@5 tăng từ 0,589 lên **0,788**. Đã thêm test
`test_one_sided_metric_argument_order` để chặn lỗi tái phát.

### 4.3 Các thay đổi khác theo góp ý

| Góp ý | Đã làm |
|---|---|
| Đưa giá vào xếp hạng | `price_vnd` và `value_index` là đặc trưng trong metric (trước đây "đáng tiền" chỉ là huy hiệu hiển thị) |
| Thêm thuộc tính thương hiệu | `brand_tier` 1–5 là đặc trưng; từ khóa "bền/uy tín" trong câu nói đẩy trọng số thương hiệu lên 1,6× |
| Bỏ lọc cứng theo phân khúc | Phân khúc là **một đặc trưng trong metric** (trọng số 0,18) — máy phân khúc kề bên vẫn lọt top nếu thực sự phù hợp. Lọc cứng chỉ còn: ngân sách, RAM/SSD/cân nặng tối thiểu, máy bị cấm |
| Sửa match % | Dùng mốc cố định `100·e^(−d/0,9)`, không chuẩn hóa theo top-N nữa → điểm so sánh được giữa các lần truy vấn, máy hạng 1 không còn luôn được điểm cao |

### 4.4 Khuyến mãi + lượt bán — góp ý bổ sung mới nhất

Góp ý gốc: *"máy giá gốc cao hơn nhưng đang giảm giá tốt hơn, đang có số lượt bán tốt hơn thì vẫn
có thể sẽ được chọn nhiều hơn"* — tức khuyến mãi/độ phổ biến phải là **tín hiệu xếp hạng thật sự
trong metric kNN**, không chỉ là huy hiệu trang trí trên giao diện.

Đã bổ sung:
- Dữ liệu: 35% số máy trong catalog đang giảm giá (5–25%), có `originalPriceVnd` (giá gốc) và
  `salesCount` (lượt bán, tương quan với độ "đáng tiền" + uy tín thương hiệu + có đang giảm giá hay
  không) — sinh tại [data/generate_catalog.py](../data/generate_catalog.py).
- Đặc trưng mới cho Mô hình B ([ml-service/app/features.py](../ml-service/app/features.py)):
  `discount_percent` (% giảm giá) và `sales_score` (lượt bán, log-hoá về thang 0–100 để không bị vài
  máy bán chạy đột biến lấn át).
- Nhóm trọng số mới trong metric kNN ([ml-service/app/retriever.py](../ml-service/app/retriever.py)):
  `"popularity": ["discount_percent", "sales_score"]`, trọng số **cố định** 0,12 (không cho người
  dùng chỉnh qua thanh trượt ưu tiên — đây là tín hiệu nền, không phải tiêu chí người dùng tự chọn).
- Hướng tối ưu: cả hai đặc trưng đều "càng cao càng tốt" và **không phạt khi vượt** — máy giảm giá
  sâu hơn/bán chạy hơn mức "lý tưởng" (mốc phân vị 80%) vẫn không bị trừ điểm, đúng tinh thần đo
  khoảng cách một phía đã dùng cho các đặc trưng khác (mục 4.2).
- Có sẵn qua toàn bộ chuỗi đồng bộ dữ liệu: `backend/prisma/schema.prisma` →
  `backend/src/modules/jobs/snapshotSync.ts` (tính `discount_percent` từ giá gốc/giá hiện tại) →
  `ml-service/app/main.py` (`catalog_sync`, tính `sales_score` log-hoá tại thời điểm đồng bộ).

## 5. Tiêu chí 3 — hệ thống thông minh lên theo thời gian

### 5.1 Máy mới tự được gán phân khúc — và THẬT SỰ được đưa vào catalog gợi ý

**Lỗi từng phát hiện (đối chiếu `docs/02_YEU_CAU_CHUC_NANG.md`)**: nút "AI gợi ý phân khúc" trước
đây chỉ HIỂN THỊ kết quả dự đoán, không lưu nhãn nào cả. Vì bước đồng bộ sang ML service bỏ qua
mọi máy chưa có nhãn (`snapshotSync.ts`), **máy mới thêm từ trang quản trị không bao giờ được gợi
ý cho khách** — hỏng đúng tiêu chí 3 của đề bài. Đã sửa (`backend/src/modules/laptops/segment.service.ts`):
mọi lần tạo/sửa laptop đều kết thúc bằng việc gán nhãn phân khúc thật, dựa trên đúng 1 lệnh gọi Mô
hình A dùng chung cho cả nút "gợi ý xem trước" lẫn bước lưu.

Quy tắc gán nhãn:
- Nhân viên **giữ nguyên** nhãn AI gợi ý → nguồn `MODEL`; **tự đổi** nhãn khác → nguồn `ADMIN`.
- Nhân viên **để trống** ô Phân khúc → dùng thẳng dự đoán AI, nguồn `MODEL`; độ tin cậy dưới
  ngưỡng (đọc từ cấu hình tri thức `confidence_threshold`, mặc định 0,6) → trạng thái
  `NEEDS_REVIEW` (vào hàng đợi cần xác minh) thay vì chặn lưu máy.
- ML service trả thêm **danh sách k láng giềng đã bỏ phiếu** (nhãn + khoảng cách), hiển thị ngay
  dưới thanh phần trăm để nhân viên thấy lý do cụ thể, không phải một con số hộp đen.

Đã kiểm thử trên browser (script `scripts/capture_phase1_segment.py`, ảnh
`crud_test_screenshots/phase1_*.png`): thêm máy "Acer i9-13900H + RTX 4070, 32GB, 240Hz, 2,6kg" →
AI dự đoán **Gaming 100%** (7/7 láng giềng bỏ phiếu Gaming) → chọn thử nhãn khác (Đồ họa) → bấm
"Dùng nhãn AI" quay lại Gaming → lưu → thông báo "Đã gán phân khúc: Gaming" → vào trang Chi tiết
của chính máy đó: mục "Máy tương tự" hiển thị đủ 6 máy (trước khi sửa sẽ luôn rỗng vì máy chưa
từng vào catalog gợi ý). Đã thêm test hồi quy `test_neighbors_explain_the_vote`
(`ml-service/tests/test_classifier.py`) chặn lỗi lấy sai danh sách láng giềng.

### 5.2 Học từ phản hồi người dùng

`python -m app.retrain_from_feedback --demo` mô phỏng dòng thời gian thực tế: người dùng gõ câu với
từ ngữ hệ thống chưa từng học ("tiệm tạp hóa", "khai báo thuế", "quay tiktok").

| | Kết quả |
|---|---|
| Học từ 12 câu đợt 1 (được 👍) | |
| Độ chính xác trên 12 câu đợt 2 (chưa từng thấy) — **trước** khi học | 11/12 = **91,7%** |
| Độ chính xác trên 12 câu đợt 2 — **sau** khi học | 12/12 = **100%** |

Câu cụ thể được sửa: *"cần máy chỉnh ảnh cưới hàng loạt, màu phải chính xác"* từ VAN_PHONG →
**DO_HOA** (đúng).

Chỉ nhận câu có phản hồi 👍 vào tập huấn luyện — không tự tin vào dự đoán của chính mình, tránh
hiệu ứng "buồng vọng âm" (echo chamber).

### 5.3 Hàng đợi "Cần xác minh" (UC-10, human-in-the-loop)

Máy được Mô hình A tự gán nhãn với độ tin cậy dưới ngưỡng (`confidence_threshold`, mặc định 0,6)
vào trạng thái `NEEDS_REVIEW` thay vì chặn lưu — máy **vẫn được gợi ý tạm** cho khách bằng nhãn
đó (đúng tinh thần "hệ thống hoạt động được ngay, con người xác nhận lại sau", không phải "chờ
duyệt mới hoạt động"). Màn quản trị mới `/admin/review-queue`: hiện huy hiệu số lượng đang chờ
ngay trên menu (cập nhật tức thì sau mỗi lần duyệt, không cần tải lại trang), liệt kê từng máy
kèm phân bố xác suất đầy đủ, cho phép giữ nguyên nhãn AI hoặc chọn nhãn khác rồi duyệt.

Đã kiểm thử trên browser (`scripts/capture_phase2_review_queue.py`, ảnh
`crud_test_screenshots/phase2_*.png`): hạ tạm ngưỡng để ép máy mới vào hàng đợi, xác nhận huy
hiệu "1" hiện trên menu, màn hiện đúng thông tin máy + phân bố xác suất, bấm duyệt xong hàng đợi
rỗng và huy hiệu biến mất ngay lập tức.

### 5.4 Hoàn thiện luồng khách hàng Wizard → Kết quả → Chi tiết (FR-01 → FR-04)

Trước Giai đoạn 3, màn Tư vấn (Wizard) và Kết quả còn thiếu nhiều mục trong đặc tả
`docs/02_YEU_CAU_CHUC_NANG.md`: ngân sách chỉ có ô nhập tay (không có nút chọn nhanh), không có ràng
buộc SSD/cân nặng/hãng, không hiển thị phân khúc AI suy luận, không có gợi ý nhẹ khi người dùng tự
chọn phân khúc khác dự đoán, số lượng kết quả cố định 5 máy, nhãn "Đáng tiền nhất" tính theo ngưỡng
cố định toàn hệ thống thay vì so trong nhóm đang hiển thị, không có biểu đồ radar, không hỏi lý do
khi "Không thích", không ghi nhận sự kiện thêm vào so sánh, và trang Chi tiết không hiện chênh lệch
giá với máy tương tự.

**Đã bổ sung:**

- **`Wizard.tsx`**: đổi bố cục 2 cột (form + panel tóm tắt luôn cập nhật theo lựa chọn); thanh trượt
  ngân sách 8–80tr kèm 4 nút chọn nhanh; 3 ô ràng buộc mới (SSD tối thiểu, cân nặng tối đa, hãng ưa
  thích — nhiều lựa chọn); gọi `POST /recommendations/infer-segment` mỗi khi đổi hoạt động để hiển
  thị "Nhu cầu của bạn gần với **X** (độ tin cậy Y%)" khi chưa tự chọn phân khúc, và cảnh báo nhẹ
  "phân khúc X có thể hợp hơn" kèm nút "Xem thử" khi phân khúc tự chọn khác với dự đoán AI **và** độ
  tin cậy dự đoán ≥ ngưỡng 60%.
- **`recommend.service.ts` + `types.ts`**: trả thêm `candidatesBeforeRelax` (số máy thật sự thoả
  ngân sách gốc trước khi nới 10%) để `BudgetRelaxedBanner` hiển thị con số cụ thể thay vì câu chung
  chung.
- **`Results.tsx`**: bộ chọn số lượng hiển thị (`Segmented` 3/5/8/10) gọi lại đúng request gốc (lưu
  từ Wizard qua `location.state.requestBody`) với `topN` mới; nhãn phụ "🪶 Nhẹ nhất / ⚡ Mạnh nhất /
  💎 Đáng tiền nhất" nay được tính **từ chính tập kết quả đang hiển thị** (so sánh `weightKg` /
  `performanceIdx` / `valueIdx` giữa các máy trong top N) thay vì một ngưỡng cố định trong toàn bộ
  1.000 máy; bấm "+ So sánh" ghi sự kiện `ADD_COMPARE` (tín hiệu quan tâm ngầm định, dùng cho UC-15).
- **`RecommendationCard.tsx`**: bấm "Không thích" mở modal chọn 1 trong 6 lý do (khớp enum `reason`
  phía backend) trước khi gửi sự kiện `DISLIKE` kèm lý do.
- **`ExplainDrawer.tsx`**: thêm biểu đồ radar (Recharts) so sánh 6 trục "Bạn cần" vs "Máy này" (CPU,
  GPU, RAM, SSD, Pin, tần số quét màn hình), mỗi trục chuẩn hoá về 0–100% theo giá trị lớn hơn giữa
  hai bên để các đơn vị khác nhau (điểm CPU, GB, Hz) không lấn át nhau trên cùng biểu đồ.
- **`Detail.tsx`**: mỗi máy trong "Máy tương tự" hiện nhãn chênh lệch giá so với máy đang xem
  ("Đắt hơn N%" / "Rẻ hơn N%" / "Cùng mức giá").

**Đã kiểm thử trên browser** (`scripts/capture_phase3_wizard_results.py`, ảnh
`crud_test_screenshots/phase3_*.png`): xác nhận đủ 8 kịch bản — gợi ý phân khúc AI hiện đúng khi
chưa chọn ("Văn phòng / soạn thảo" → AI đoán OFFICE 100%), gợi ý nhẹ hiện đúng khi tự chọn khác
(chọn Gaming trong khi AI đoán OFFICE 100% ≥ ngưỡng), điều hướng Wizard → Kết quả, đổi số lượng
hiển thị không lỗi, biểu đồ radar hiện trong Drawer, modal lý do "Không thích" hoạt động, nút So
sánh không lỗi, và trang Chi tiết hiện đúng nhãn chênh lệch giá. `tsc --noEmit` sạch ở cả
frontend/backend, `pytest` ml-service 35/35 pass (không đổi mô hình ở giai đoạn này).

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
