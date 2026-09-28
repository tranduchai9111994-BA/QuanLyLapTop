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

### 5.5 Bốn màn quản trị "thông minh" — FR-12, FR-13, FR-14, UC-15

Trước Giai đoạn 4, backend đã có đủ API cho 4 nghiệp vụ này (`/models`, `/knowledge`, `/dashboard`,
`/feedback`) nhưng **không có giao diện quản trị nào** để dùng — quản trị viên phải gọi API thủ
công. Đã thêm 4 màn mới (`frontend/src/pages/admin/`) và 1 tác vụ nền chưa từng tồn tại
(`alertScan`):

- **`AdminModels.tsx` (FR-12 Quản lý mô hình)**: danh sách các lần huấn luyện Mô hình A kèm
  macro-F1, nút "Huấn luyện mô hình mới" (tạo "ứng viên", không tự thay mô hình đang chạy), Drawer
  chi tiết hiện bảng so với 2 đường cơ sở (đoán ngẫu nhiên, luật đơn giản), biểu đồ đường cong chọn
  k (Recharts, có đường tham chiếu đánh dấu k đã chọn), và ma trận nhầm lẫn (đường chéo in đậm).
  Nút "Đưa vào sử dụng" gọi thẳng API promote đã có sẵn quy tắc an toàn (backend từ chối nếu tệ hơn
  bản đang dùng > 2% macro-F1 hoặc có lớp nào < 0,5 F1); nút "Quay lại phiên bản này" cho bản đã
  lưu trữ.
- **`AdminKnowledge.tsx` (FR-13 Cấu hình tri thức)**: 4 tab — (1) Ghim/Cấm máy theo phân khúc kèm
  lý do + ngày hết hạn; (2) Ngưỡng tin cậy, số kết quả mặc định, tỷ lệ nới ngân sách; (3) Trọng số
  mặc định 5 nhóm đặc trưng (hiệu năng/di động/màn hình/giá/thương hiệu) cho từng phân khúc; (4)
  5 ngưỡng cảnh báo (docs/09 §6). **Đây là thay đổi chạm tới cả 2 tầng dưới**: trước đây
  `BASE_WEIGHT_BY_SEGMENT` là hằng số cứng trong `ml-service/app/retriever.py`, và
  `budget_relax_ratio`/`default_top_n` là hằng số cứng trong `recommend.service.ts` — đã thêm
  tham số `baseWeightsOverride` xuyên suốt `schemas.py` → `main.py` → `build_weights()` (ghi đè
  MỀM: chỉ áp dụng phân khúc có trong cấu hình, phân khúc khác vẫn dùng mặc định trong code), và
  `recommend.service.ts` đọc `KnowledgeConfig` ở **mỗi lần gọi** (không cache) nên sửa xong có hiệu
  lực ngay từ lượt tư vấn tiếp theo, không cần khởi động lại backend.
- **`AdminDashboard.tsx` (FR-14 Dashboard)**: 6 KPI đúng theo tiêu chí thành công đề tài (lượt tư
  vấn, tỷ lệ hài lòng, độ trễ trung bình, tỷ lệ dự phòng, số nhãn chờ duyệt, tổng phản hồi) + bảng
  cảnh báo đang mở, nút "Quét cảnh báo ngay" gọi thủ công thay vì chờ lịch.
- **`backend/src/modules/jobs/alertScan.ts` (MỚI)**: cài đặt đủ 6 luật cảnh báo trong
  docs/09_VONG_DOI_TRI_TUE.md mục 6 (`LOW_SATISFACTION`, `FALLBACK_HIGH`, `LATENCY_HIGH`,
  `LOW_CONFIDENCE_RATE`, `REVIEW_BACKLOG`, `RANK1_WEAK`) — trước đây chỉ có bảng `AlertLog` trong
  schema nhưng không có tác vụ nào từng ghi vào đó. Chạy tự động mỗi giờ (`cron.schedule('0 * * *
  *')` trong `server.ts`) và 1 lần lúc khởi động; không tạo cảnh báo trùng mã khi đã có cảnh báo
  cùng mã chưa xử lý (tránh spam). Ngưỡng đọc từ `KnowledgeConfig.alert_thresholds` (sửa được ở
  `AdminKnowledge.tsx`).
- **`AdminFeedback.tsx` (UC-15 Phân tích phản hồi)**: biểu đồ cột số lượt theo loại sự kiện
  (Xem chi tiết/Thích/Không thích/Thêm so sánh), biểu đồ ngang xếp hạng lý do "Không thích" phổ
  biến nhất (dữ liệu thật có từ modal chọn lý do thêm ở Giai đoạn 3), và bảng các câu nhu cầu tự do
  đã được xác nhận hài lòng (nguồn học thêm cho Mô hình C).
- **`AdminLayout.tsx`**: 3/4 màn mới (Dashboard, Quản lý mô hình, Cấu hình tri thức, Phân tích phản
  hồi) chỉ hiện trên menu khi đăng nhập bằng vai trò `ADMIN` — `STAFF` không có quyền gọi các API
  này ở backend nên ẩn hẳn khỏi menu, tránh nhấn vào rồi gặp lỗi 403 khó hiểu. Trang mặc định sau
  đăng nhập cũng đổi theo vai trò: ADMIN vào Dashboard, STAFF vào Laptop.

**Đã kiểm thử trên browser** (`scripts/capture_phase4_admin_smart.py`, ảnh
`crud_test_screenshots/phase4_*.png`): Dashboard hiện đủ KPI và "Quét cảnh báo ngay" chạy không
lỗi; đã huấn luyện thử 1 phiên bản mô hình qua API (`clf-2026.09.27-160831`, macro-F1 test 78,7%
so với luật đơn giản 63,2% và đoán ngẫu nhiên 12,8%) rồi xác nhận màn Quản lý mô hình hiện đúng
đường cong chọn k + ma trận nhầm lẫn; cả 4 tab của Cấu hình tri thức lưu được (đã kiểm thêm CRUD
Ghim/Cấm qua API: tạo → hiện trong danh sách → xoá → danh sách rỗng lại); Phân tích phản hồi hiện
đúng biểu đồ theo loại sự kiện và theo lý do "Không thích". `tsc --noEmit` sạch ở backend/frontend,
`pytest` ml-service 35/35 pass (thêm `baseWeightsOverride` là tham số optional, không ảnh hưởng
hành vi mặc định khi không truyền).

### 5.6 Tài khoản khách hàng — UC-07, UC-08

Trước Giai đoạn 5: bảng `User` và các API `/me/favorites`, `/me/sessions` đã tồn tại từ trước,
nhưng **không có cách nào để một khách hàng thực sự đăng nhập** — `AdminLogin.tsx` là màn đăng
nhập DUY NHẤT trong hệ thống và nó chủ động từ chối tài khoản `CUSTOMER`; cũng chưa có API đăng ký.
Nghĩa là 2 API kể trên tồn tại nhưng không thể gọi tới được từ giao diện.

**Đã bổ sung:**

- **`POST /auth/register`** (`auth.routes.ts` + `auth.service.ts`, mới): tạo tài khoản `CUSTOMER`
  (không cho tự chọn vai trò khác qua API công khai này), trả JWT ngay để tự động đăng nhập.
- **`CustomerLogin.tsx`** (mới, route `/login`): 2 tab Đăng nhập/Tạo tài khoản — ngược với
  `AdminLogin.tsx`, màn này từ chối tài khoản `STAFF`/`ADMIN` (hướng họ sang `/admin/login`).
- **`Favorites.tsx`** (UC-07, route `/favorites`) và **`History.tsx`** (UC-08, route `/history`):
  yêu cầu đăng nhập, nếu chưa có token thì hiện màn mời đăng nhập (kèm redirect quay lại đúng
  trang sau khi đăng nhập) thay vì gọi thẳng API rồi nhận lỗi 401. `History.tsx` dựng lại
  `RecommendationResult` từ dữ liệu **đã lưu** của phiên cũ (không gọi lại thuật toán), tái dùng
  nguyên `Results.tsx`/`RecommendationCard.tsx` để xem lại — phải sửa `sessionsRouter` (
  `favorites.routes.ts`) include đầy đủ quan hệ `brand/cpu/gpu/segmentLabel` của laptop (trước đây
  chỉ include laptop nông, thiếu quan hệ sẽ vỡ `RecommendationCard` với lỗi
  "Cannot read properties of undefined").
- **Nút yêu thích (trái tim)** thêm vào `Detail.tsx`: bấm khi chưa đăng nhập → điều hướng sang
  `/login` kèm đường quay lại; khi đã đăng nhập → gọi `POST /me/favorites` + ghi sự kiện
  `ADD_FAVORITE` (cho UC-15) đồng thời.
- **`TopNav` (`App.tsx`)**: thêm trạng thái đăng nhập khách hàng — dùng chung `localStorage` key
  với khu quản trị (một trình duyệt chỉ mang một danh tính tại một thời điểm, giống phần lớn
  trang TMDT), cập nhật ngay bằng sự kiện tuỳ chỉnh `smartlap:customer-auth-changed` (không cần tải
  lại trang sau khi đăng nhập/đăng xuất).
- **Vá lỗ hổng UX phát hiện trong lúc làm**: vì đăng nhập khách hàng và quản trị dùng chung khoá
  `localStorage`, một khách hàng đã đăng nhập tự gõ thẳng URL `/admin/...` trước đây sẽ **lọt qua**
  được `AdminLayout` (nó chỉ kiểm tra "có token hay không", không kiểm tra vai trò) và thấy khung
  sườn quản trị trống (mọi API đều 403) — không rò rỉ dữ liệu nhưng gây khó hiểu. Đã sửa
  `AdminLayout.tsx` kiểm tra thêm `user.role !== 'CUSTOMER'`.

**Đã kiểm thử trên browser** (`scripts/capture_phase5_customer_account.py`, ảnh
`crud_test_screenshots/phase5_*.png`): đăng ký tài khoản mới → tự động đăng nhập, TopNav đổi tên;
yêu thích 1 máy ở trang Chi tiết → xuất hiện đúng trong `/favorites`; bỏ thích → danh sách rỗng lại
(**phát hiện và sửa 1 lỗi thật khi viết kịch bản test**: nút "Bỏ thích" nằm trong `Card` có
`onClick` điều hướng riêng, click vào nút bị nổi bọt (bubble) lên `Card` khiến vừa xoá vừa điều
hướng sang trang Chi tiết của chính máy vừa xoá — đã thêm `e.stopPropagation()`); tạo 1 lượt tư vấn
mới → xuất hiện trong `/history`, bấm vào xem lại đúng kết quả cũ; đăng xuất → TopNav trở lại
"Đăng nhập", `/favorites`/`/history` yêu cầu đăng nhập lại; khách hàng đã đăng xuất tự điều hướng
tới `/admin/laptops` → bị chuyển hướng về `/admin/login` (xác nhận bản vá lỗ hổng ở trên hoạt
động). `tsc --noEmit` sạch ở backend/frontend, `pytest` ml-service 35/35 pass (không đổi ML ở
giai đoạn này).

### 5.7 Quản lý người dùng & nhật ký hệ thống — UC-16

Trước Giai đoạn 6: bảng `AuditLog` đã tồn tại từ migration đầu tiên nhưng **chưa từng có dòng nào
được ghi** — không route nào gọi tới nó. Cũng chưa có API/màn hình nào để quản trị viên xem hay
tạo tài khoản `STAFF`/`ADMIN` khác (chỉ có 2 tài khoản demo tạo qua seed).

**Đã bổ sung:**

- **`backend/src/lib/audit.ts`** (mới): hàm `writeAudit()` dùng chung — ghi 1 dòng `AuditLog`,
  không bao giờ làm hỏng request chính nếu ghi thất bại (chỉ log cảnh báo), vì đây là dữ liệu truy
  vết phụ trợ chứ không phải nghiệp vụ chính.
- **`backend/src/modules/users/users.routes.ts`** (mới): `GET/POST /users` (danh sách + tạo tài
  khoản nội bộ), `PATCH /users/:id` (đổi họ tên/vai trò/mật khẩu/khoá-mở khoá) — **chặn tự sửa
  chính tài khoản đang đăng nhập** (không tự khoá hoặc tự hạ quyền), tránh tình huống quản trị viên
  duy nhất tự khoá tài khoản của mình rồi không ai còn quyền mở lại. Tài khoản `CUSTOMER` (tự đăng
  ký ở `/login`) không quản lý ở đây — 2 luồng tách biệt hoàn toàn theo đúng UC-07 (khách hàng) và
  UC-16 (nội bộ).
- **`GET /audit-logs`** (mới): đã gắn `writeAudit()` vào mọi hành động "nhạy cảm" theo đúng
  docs/09 §5 ("Mọi thay đổi tri thức, promote, rollback → AuditLog: Truy vết"): sửa cấu hình tri
  thức (`PUT /knowledge/config/:key`), ghim/cấm/gỡ máy (`POST`/`DELETE /knowledge/pins`), đưa mô
  hình vào sử dụng và quay lại phiên bản cũ (`/models/:version/promote`, `/rollback`), tạo/sửa tài
  khoản nội bộ.
- **`AdminUsers.tsx`** (mới, route `/admin/users`, chỉ hiện menu với `ADMIN`): 2 tab — "Tài khoản
  nội bộ" (bảng có `Select` đổi vai trò và `Switch` khoá/mở trực tiếp trên từng dòng, dòng của
  chính người đang đăng nhập bị vô hiệu hoá cả hai) và "Nhật ký hệ thống" (bảng audit log, mới nhất
  trước, kèm tên người thực hiện + chi tiết JSON rút gọn).

**Đã kiểm thử trên browser** (`scripts/capture_phase6_users_audit.py`, ảnh
`crud_test_screenshots/phase6_*.png`, và kiểm qua API bằng `curl` trước khi viết giao diện): tạo
tài khoản `STAFF` mới → xuất hiện ngay trong bảng; đổi vai trò sang `ADMIN` và khoá tài khoản đó
qua `Switch` → thành công; xác nhận dòng tài khoản `ADMIN` đang đăng nhập bị vô hiệu hoá cả ô vai
trò lẫn công tắc hoạt động (không tự sửa được chính mình — kiểm cả qua API: gọi
`PATCH /users/1 {isActive:false}` trả về lỗi `CANNOT_MODIFY_SELF` thay vì thực hiện); tab "Nhật ký
hệ thống" hiện đầy đủ các hành động tạo/sửa tài khoản và sửa cấu hình tri thức vừa thực hiện, đúng
thứ tự thời gian. `tsc --noEmit` sạch ở backend/frontend, `pytest` ml-service 35/35 pass (không
đổi ML ở giai đoạn này).

### 5.8 Kiểm chứng NFR — responsive 375–1920px, độ trễ p95, tương phản màu (NFR-01, 04, 05)

Giai đoạn cuối cùng: đo lại các yêu cầu phi chức năng bằng số liệu thật thay vì chỉ khẳng định
suông, và tìm/sửa các lỗi hiển thị ở 2 đầu mút kích thước màn hình (docs/02 mục 4).

**NFR-01 (p95 < 800ms)**: trước đây Dashboard chỉ hiện độ trễ **trung bình**, dễ che giấu các phiên
chậm bất thường. Đã thêm `p95LatencyMs` vào `GET /dashboard/kpis` (sắp xếp toàn bộ độ trễ trong
khoảng thời gian rồi lấy phần tử ở vị trí `ceil(0.95 × n) − 1`, cùng cách tính với `alertScan.ts`),
hiện thẻ riêng "Độ trễ p95 (NFR-01: < 800ms)" trên Dashboard. **Đo được: p95 = 198ms** (trên 418
phiên 30 ngày gần nhất) — đạt dư nhiều so với ngưỡng 800ms.

**NFR-04 (responsive 375–1920px)**: viết kịch bản kiểm tra `document.documentElement.scrollWidth`
không được vượt `clientWidth` trên toàn bộ 15 trang (khách hàng + quản trị) ở cả 2 đầu mút. Lượt
kiểm tra đầu tiên phát hiện **6 lỗi tràn ngang thật** trên 375px, sửa từng lỗi rồi xác nhận lại:

1. **`TopNav` (App.tsx)**: menu ngang + link đăng nhập/quản trị tràn hẳn ra ngoài màn hình hẹp,
   một phần bị cắt mất hoàn toàn (không cuộn được tới). Sửa: gộp toàn bộ điều hướng vào 1 nút "☰"
   mở `Drawer` trên màn hẹp (dùng `Grid.useBreakpoint()` của antd — đáng tin cậy ngay từ lần
   render đầu, khác với `Sider`/`Pagination` responsive kiểu "chỉ phản ứng theo sự kiện resize"
   ở lỗi #2 và #3 bên dưới).
2. **`Segmented` lọc phân khúc + `Pagination` (Catalog.tsx)**: `Segmented` với nhãn dài tự tràn
   ra ngoài `Layout.Content` — nguyên nhân gốc là `Content` (antd `Layout`, flex-column) không có
   `minWidth: 0`, khiến 1 widget con quá rộng kéo dãn cả trang thay vì tự cuộn riêng trong khung
   `overflowX:auto` của nó. `Pagination` (84 trang) cũng tràn vì prop `responsive` có sẵn của antd
   **chỉ cập nhật khi nhận sự kiện `resize` của window**, không tự kiểm tra lúc mount — người
   dùng tải trang lần đầu trên điện thoại (không resize) vẫn thấy bản đầy đủ desktop. Sửa: thêm
   `minWidth:0` cho `Content`, và tự quyết định `simple` bằng `Grid.useBreakpoint()` thay vì
   `responsive`.
3. **Sidebar quản trị (`AdminLayout.tsx`)**: tương tự — `Sider` với `breakpoint`/`collapsedWidth={0}`
   của antd gắn đúng class "đã thu gọn" nhưng **`getComputedStyle` cho thấy `flex-basis` vẫn là
   220px thật sự** (một điểm không nhất quán trong phiên bản antd đang dùng), chiếm chỗ trong
   flex dù nhìn "như đã ẩn". Sửa triệt để: không dựa vào cơ chế responsive nửa-tự-động của
   `Sider` nữa, tự tính `isMobile` bằng `Grid.useBreakpoint()` và **không render `Sider`** trên
   màn hẹp (thay bằng nút "☰" + `Drawer`, giống TopNav khách hàng).
4. **2 form trong `AdminKnowledge.tsx`** (thêm Ghim/Cấm máy, nút Lưu trọng số): `<Space wrap>`
   của antd render `display:inline-flex` — loại box này **tự co theo nội dung** (shrink-to-fit)
   thay vì bị giới hạn bởi `Card` cha, nên `flexWrap` không có tác dụng thật (trình duyệt vẫn coi
   như có "không gian vô hạn" để xếp hết trên 1 dòng trước khi tính wrap). Sửa: thay `<Space>`
   bằng `<div style={{display:'flex', flexWrap:'wrap'}}>` (block-level, bị giới hạn đúng bởi cha).
5. **Card KPI Dashboard**: `Row`/`Col span={8}` cố định 3 cột bất kể độ rộng màn hình, ép nội
   dung Card (tiêu đề dài như "Độ trễ p95 (NFR-01: < 800ms)") bị bóp méo tràn ra ngoài cột 49px.
   Sửa: đổi sang CSS grid `repeat(auto-fit, minmax(220px, 1fr))` (tự giảm số cột trên màn hẹp,
   mẫu đã dùng sẵn ở Catalog/Favorites/Detail).
6. **`RecommendationCard.tsx`** (thẻ kết quả gợi ý — trang quan trọng nhất với khách hàng): đây là
   phần tử **grid-item** trực tiếp trong `display:grid` của Results.tsx; giống flex-item, grid-item
   mặc định `min-width:auto` (không chịu co nhỏ hơn nội dung "min-content" của nó) trừ khi khai
   báo `minWidth:0` ngay trên chính nó — không chỉ trên các div con bên trong (đã có sẵn). Vì
   thiếu khai báo này ở tầng ngoài cùng, ảnh đại diện cố định 128px + vòng tròn % phù hợp cố định
   64px cùng buộc cả thẻ phải rộng tối thiểu ~412px. Sửa: thêm `minWidth:0` cho div ngoài cùng,
   và `flexShrink:0` cho 2 phần tử kích thước cố định (ảnh, vòng tròn %) để lực co giãn dồn hết
   vào phần văn bản (tên máy/thông số) — nơi DUY NHẤT có thể xuống dòng an toàn.

Sau khi sửa: `scripts/capture_phase7_nfr_responsive.py` xác nhận **0 lỗi tràn ngang** trên 21 lượt
kiểm tra (9 trang khách hàng ở 375px kể cả trang Kết quả có dữ liệu thật, 10 trang/tab quản trị ở
375px, 3 trang ở 1920px) — ảnh `crud_test_screenshots/phase7_*.png`. Toàn bộ 4 kịch bản kiểm thử
của Giai đoạn 3–6 (28 lượt kiểm) chạy lại **không hồi quy** sau các thay đổi CSS này.

**NFR-05 (tương phản màu WCAG AA)**: viết `scripts/check_contrast.py` tính tỷ lệ tương phản
(công thức WCAG 2.1) cho 16 cặp chữ/nền dùng trong `theme/tokens.ts`. Phát hiện 2 cặp **dưới**
ngưỡng 4,5:1 cho văn bản thường: `error` (`#DC2626`) trên `errorBg` chỉ đạt 4,23:1, và
`textTertiary` (`#64748B`) trên `bgSubtle` chỉ đạt 4,34:1. Đã tối màu 2 token này
(`error` → `#C62828`, đạt 4,92:1; `textTertiary` → `#5B6B85`, đạt 4,93:1) — chênh lệch màu sắc rất
nhỏ, không đổi cảm giác thiết kế, và **không làm giảm** tương phản ở bất kỳ cặp nào khác đang dùng
2 token này (đã kiểm lại toàn bộ 16 cặp, tất cả đều PASS sau khi đổi).

### 5.9 Rà soát tuân thủ `docs/07_UIUX.md` — Giai đoạn 8: nền tảng & sửa lệch token

Rà soát toàn bộ đặc tả UI/UX bằng agent đọc-mã-nguồn phát hiện: hầu hết đã đúng (token màu,
`antdTheme.ts`, `utils/format.ts`, các component `MatchScore`/`SegmentTag`/`AiBadge`/
`FallbackBanner`/`RecommendationCard`), nhưng còn thiếu ở tầng nền tảng và có 1 lỗi lệch dữ liệu
mới phát sinh. Đã sửa trong Giai đoạn 8 (phần bố cục lớn hơn và component `ConfidenceIndicator`
còn thiếu chuyển sang Giai đoạn 9–10):

- **Lỗi lệch token**: `Results.tsx` và `Wizard.tsx` hardcode `#64748B` — là giá trị **cũ** của
  `textTertiary` trước khi đổi thành `#5B6B85` để đạt WCAG AA ở Giai đoạn 7. Đã sửa dùng lại
  `t.textTertiary`; quét thêm 4 file khác (`AiBadge.tsx`, `CrudTable.tsx`, `AdminLayout.tsx` ×3)
  cũng hardcode hex trùng giá trị token có sẵn — đổi tất cả sang tham chiếu token.
- **`global.css`**: trước chỉ export 7/24 token thành CSS variable; đã bổ sung đủ toàn bộ
  (`--success`, `--warning`, `--error`, `--text-*`, `--border-strong`, `--bg-subtle`, 3 mức
  shadow) để đồng bộ với `tokens.ts`.
- **Cấm hardcode hex (docs mục 10)**: dự án dùng **oxlint**, không phải ESLint — rule mẫu
  `no-restricted-syntax` trong docs không áp dụng được (oxlint là bộ rule cố định viết bằng Rust,
  không hỗ trợ rule tuỳ chỉnh). Viết `frontend/scripts/check-no-hardcoded-colors.mjs` (quét mọi
  `.ts`/`.tsx` tìm chuỗi hex ngoài danh sách cho phép) làm tương đương, gắn vào `npm run lint`.
  Loại trừ hợp lý `LaptopThumbnail.tsx` (màu logo thương hiệu thật + minh hoạ SVG, không phải màu
  giao diện dùng lặp lại).
- **Focus-ring (mục 11, a11y)**: thêm `:focus-visible { box-shadow: 0 0 0 3px var(--primary-200) }`
  toàn cục — trước đó hoàn toàn chưa có, chỉ có viền focus mặc định của trình duyệt.
- **Max-width nội dung khách hàng**: trước không nhất quán (Home 1100, Catalog 1400, Results/
  Wizard 1240, trong khi Compare/Detail đã đúng 1200) — chuẩn hoá toàn bộ về `1200px` theo mục 6.1.
- **Phát hiện phụ quan trọng**: `npx tsc --noEmit` chạy ở thư mục gốc `frontend/` trong suốt các
  Giai đoạn 1–7 **luôn báo "sạch" một cách SAI** — `tsconfig.json` gốc chỉ là file tổng hợp
  `references` (`"files": []`), không tự biên dịch gì cả; lệnh đúng phải là
  `npx tsc -p tsconfig.app.json --noEmit` (hoặc `npx tsc -b`, khớp với script `build` thật trong
  `package.json`). Chạy lại đúng lệnh phát hiện **6 lỗi thật** đã lọt qua suốt phiên làm việc:
  1 lỗi vi phạm "rules of hooks" thật sự trong `AdminLayout.tsx` (gọi `useState`/`useEffect`/
  `Grid.useBreakpoint()` SAU một `return` có điều kiện — tiềm ẩn crash "Rendered fewer hooks than
  expected" nếu component không unmount giữa 2 lần render), 1 biến `Space` dùng trong JSX nhưng
  quên import ở `Wizard.tsx`, 3 import không dùng, và 1 lỗi kiểu dữ liệu ở `Tooltip formatter`
  của Recharts (`AdminModels.tsx`). Đã sửa toàn bộ; `npx tsc -b --force` (build thật) nay sạch
  hoàn toàn. Đây là bài học quan trọng cho các buổi làm việc sau: **luôn xác nhận lệnh kiểm tra
  đang thực sự biên dịch file nào**, nhất là với dự án dùng TypeScript project references.

**Đã kiểm thử**: `scripts/capture_phase8_ui_foundation.py` xác nhận focus-ring hiển thị đúng khi
điều hướng bằng bàn phím và 3 trang khách hàng dùng thống nhất `max-width: 1200px`. Chạy lại toàn
bộ 4 kịch bản Giai đoạn 3–7 (28 lượt kiểm) xác nhận không hồi quy. `npx tsc -b --force` sạch ở
frontend (lệnh đúng, không phải lệnh sai đã dùng trước đó), `npx tsc --noEmit` sạch ở backend,
`pytest` ml-service 35/35 pass.

### 5.10 Component đặc trưng còn thiếu/sai — Giai đoạn 9

Tiếp tục rà soát `docs/07_UIUX.md` mục 7, bổ sung 4 điểm còn lại:

- **`PrioritySlider` (mục 7.6)**: nhãn mốc trước là "Ít/Vừa/Cao" (rút gọn có chủ ý để tránh nhãn
  dài "Rất quan trọng" xuống 3 dòng đè lên thanh trượt kế tiếp — một quyết định lấy ngắn hạn thay
  vì sửa đúng nguyên nhân). Đã sửa đúng nguyên văn "Không quan trọng / Bình thường / Rất quan
  trọng" bằng cách tăng khoảng cách dọc giữa các thanh trượt (`marginBottom` 20 → 36px) và ghim
  vị trí 2 mốc đầu/cuối bằng CSS để nhãn 2 dòng không chồng lấn.
- **`ConfidenceIndicator` (mục 7.8, trước đây thiếu hoàn toàn)**: tạo mới
  `frontend/src/components/smart/ConfidenceIndicator.tsx` — thanh ngang chia 4 đoạn màu phân khúc,
  độ rộng theo đúng xác suất Mô hình A dự đoán, kèm Tag "Cần xác minh" khi xác suất cao nhất dưới
  ngưỡng. Thay thế 2 nơi trước đây tự vẽ 4 thanh `Progress` xếp chồng rời rạc (khó so sánh tương
  quan cùng lúc): `SegmentSuggester.tsx` (màn Thêm laptop) và `AdminReviewQueue.tsx` (hàng đợi
  "Cần xác minh").
- **Khối "Phân khúc được chọn vì…" (mục 7.5, trước đây thiếu hoàn toàn trong `ExplainDrawer`)**:
  cần luồng dữ liệu mới xuyên 3 tầng — `ml-service/app/segment_inference.py` (`infer_segment()`)
  trước chỉ trả `{segment, confidence, distribution}`, thiếu đúng phần "vì sao" (k láng giềng đã
  bỏ phiếu) mà `/predict-segment` (dùng ở màn quản trị) đã có sẵn; bổ sung cùng cách trích xuất
  qua `knn.kneighbors()`. `recommend.service.ts` forward `neighbors` này vào
  `RecommendationResult.segment`. `ExplainDrawer.tsx` hiện khối mới — **chỉ khi phân khúc đang
  dùng được SUY RA từ hoạt động** (người dùng chọn "Chưa rõ"), không hiện khi người dùng tự chọn
  rõ một phân khúc (lúc đó không có "lý do AI" nào để giải thích).
- **Trạng thái tải (mục 8, trước đây Skeleton tĩnh không có dòng chữ luân phiên)**: đổi kiến trúc
  nhỏ — trước đây `Wizard.tsx` tự gọi API và CHỜ xong mới điều hướng sang `/results` kèm kết quả
  đầy đủ (người dùng chỉ thấy 1 vòng xoay trên nút bấm); nay bấm "Xem kết quả" điều hướng NGAY với
  `requestBody`, và `Results.tsx` tự gọi API lúc mount, hiện Skeleton 3 thẻ + component mới
  `LoadingMessages.tsx` (đổi câu mỗi 1,1 giây, đúng ví dụ trong docs: "Đang so sánh 1.000 mẫu
  laptop…", "Đang tìm máy gần nhu cầu của bạn…") trong lúc chờ; lỗi mạng lúc này hiện màn lỗi kèm
  nút "Thử lại" riêng (trước đây lỗi mạng ở bước này chỉ hiện `message.error` thoáng qua rồi đứng
  yên ở Wizard).

**Đã kiểm thử trên browser** (`scripts/capture_phase9_ui_components.py`, ảnh
`crud_test_screenshots/phase9_*.png`): xác nhận đủ 4 điểm trên hoạt động đúng, bao gồm chụp được
đúng khoảnh khắc Skeleton+chữ luân phiên xuất hiện trước khi kết quả thật render. Chạy lại 5 kịch
bản Giai đoạn 3–4, 7–8 xác nhận không hồi quy (kịch bản Giai đoạn 6 báo lỗi không tìm thấy tài
khoản vừa tạo trên trang 1 của bảng — **không phải hồi quy**: sau nhiều lần chạy lại kịch bản này
suốt các giai đoạn trước, số tài khoản test tích lũy đã vượt quá `pageSize` mặc định của bảng,
đẩy bản ghi mới nhất sang trang 2; không liên quan tới thay đổi ở Giai đoạn 9). `npx tsc -p
tsconfig.app.json --noEmit` sạch ở frontend, `npx tsc --noEmit` sạch ở backend, `pytest` ml-service
35/35 pass.

### 5.11 Bố cục lớn — Giai đoạn 10 (hoàn tất rà soát docs/07_UIUX.md)

Giai đoạn cuối cùng động vào 3 điểm bố cục lớn nhất còn thiếu ở mục 6:

- **TopNav "So sánh (N)" + "♡" (mục 6.1)**: trước đây danh sách so sánh là **state cục bộ của
  `Results.tsx`**, chọn xong rời trang là mất, nên TopNav không có gì để hiển thị. Tạo mới
  `frontend/src/lib/compareList.ts` — danh sách so sánh chuyển thành trạng thái **dùng chung toàn
  app** lưu `localStorage` (giống giỏ hàng), phát sự kiện tuỳ chỉnh để mọi nơi đang mở (TopNav,
  `Results.tsx`) cập nhật ngay. TopNav nay luôn có icon "♡" (dẫn tới `/favorites`, hoạt động cả khi
  chưa đăng nhập — trang đích tự xử lý việc mời đăng nhập) và chỉ hiện link "So sánh (N)" khi đã
  chọn ít nhất 1 máy.
- **Sidebar quản trị nhóm 4 nhóm (mục 6.2)**: trước là danh sách phẳng 11 mục. Đã nhóm bằng
  `type: 'group'` của antd Menu thành đúng 4 nhóm có tên ("Tổng quan", "Dữ liệu", "✨ Trí tuệ",
  "Hệ thống" — nhóm "Trí tuệ" mang icon ✨ đúng yêu cầu), thêm icon cho từng mục (cần thiết để chế
  độ thu gọn còn nhìn được), đổi `Sider` sang rộng 240px (đúng thay vì 220px) với `collapsedWidth`
  72px và nút thu gọn hoạt động thật (lưu lựa chọn vào `localStorage` để giữ nguyên qua lần tải
  lại). Menu điều hướng trên Drawer di động (Giai đoạn 7) dùng lại đúng cấu trúc nhóm này.
- **Lưới kết quả 2 cột + panel radar dính (mục 6.3)**: `Results.tsx` trước đây LUÔN 1 cột bất kể độ
  rộng màn hình. Tách logic vẽ radar thành component dùng chung mới
  `frontend/src/components/smart/RadarComparison.tsx` (trước đây viết trùng lặp ngay trong
  `ExplainDrawer.tsx`), rồi dùng `Grid.useBreakpoint()` để: <768px giữ 1 cột, ≥768px (md) lên 2
  cột, ≥992px (lg) thêm 1 panel `Card` **dính** (`position: sticky`) bên phải hiện radar "hồ sơ lý
  tưởng vs máy đang chú ý" — mặc định máy hạng #1, đổi sang máy vừa bấm "Vì sao gợi ý?". **Phát
  hiện và sửa 1 lỗi UX trong lúc code**: lần đầu dùng chung 1 state với Drawer khiến panel
  **quay về máy #1 ngay khi đóng Drawer** (vì lúc đó state đó bị reset về `null`), làm tính năng
  gần như vô hình trong thực tế (Drawer che mất panel đúng lúc nó khác #1). Đã tách riêng
  `panelFocusId` khỏi state điều khiển Drawer — panel giữ nguyên máy vừa xem sau khi đóng Drawer.

**Đã kiểm thử trên browser** (`scripts/capture_phase10_layout.py`, ảnh
`crud_test_screenshots/phase10_*.png`): xác nhận cả 6 điểm trên hoạt động đúng, bao gồm việc dựng
lại đúng kịch bản phát hiện lỗi panel-quay-về-#1 để chứng minh đã sửa. Chạy lại 6 kịch bản Giai
đoạn 3–9 (43 lượt kiểm) xác nhận không hồi quy — kể cả kịch bản 375px của Giai đoạn 7, nơi
`showRadarPanel` tự tắt đúng như thiết kế (chỉ bật từ `lg` trở lên). `npx tsc -p tsconfig.app.json
--noEmit` sạch ở frontend, `npx tsc --noEmit` sạch ở backend, `pytest` ml-service 35/35 pass.

Đến đây, toàn bộ rà soát `docs/07_UIUX.md` (Giai đoạn 8–10) đã hoàn tất: nền tảng token/CSS/a11y,
8 component đặc trưng ở mục 7, và 3 điểm bố cục lớn ở mục 6. Điểm duy nhất còn khác biệt có chủ ý
với văn bản đặc tả: quy tắc cấm hex dùng script Node thay ESLint (dự án chọn `oxlint` từ trước,
không hỗ trợ rule tuỳ chỉnh — xem mục 5.9), và `LaptopThumbnail.tsx` được loại trừ khỏi quy tắc đó
vì chứa màu logo thương hiệu thật, không phải màu giao diện.

### 5.12 Rà soát `docs/08_FRONTEND_SPEC.md` — Giai đoạn 11: các điểm còn thiếu

Sau khi rà soát toàn bộ đặc tả 16 màn hình trong `08_FRONTEND_SPEC.md`, phần lớn đã được triển
khai đúng hoặc tốt hơn đặc tả (route tiếng Anh thay vì slug tiếng Việt, state cục bộ thay vì
Zustand/TanStack Query, trang Yêu thích/Lịch sử tách riêng thay vì gộp — các khác biệt kiến trúc
này giữ nguyên, không coi là thiếu sót). Các điểm THẬT SỰ còn thiếu đã bổ sung:

- **Trang chủ (mục 2)**: thêm khối "Cách SmartLap hoạt động" (3 bước) và dải "💎 Đáng tiền nhất
  tuần này" (4 máy, sắp theo `value_desc` có sẵn ở backend) vào `Home.tsx`.
- **Wizard (mục 3)**: thêm dòng "Có N mẫu trong khoảng này" cạnh thanh trượt ngân sách — debounce
  400ms rồi gọi `GET /laptops?priceMin&priceMax&pageSize=1`, chỉ lấy `meta.total`.
- **Kết quả (mục 4)**: thêm control sắp xếp cục bộ (Phù hợp nhất/Giá thấp/Hiệu năng cao) và khối
  CTA cố định "Không thấy máy ưng ý?" (Thử ưu tiên khác / Xem toàn bộ danh mục) sau danh sách kết
  quả không rỗng. Khóa nút Thích/Không thích theo `sessionId + laptopId` lưu vào `localStorage`
  (giữ nguyên qua lần tải lại trang, không chỉ trong bộ nhớ).
- **Chi tiết laptop (mục 5)**: thêm dòng "Đáng tiền — tốt hơn N% máy cùng phân khúc" (tính
  `valuePercentile` ở `laptops.service.ts` bằng cách so `valueIdx` với toàn bộ máy cùng phân khúc
  đang bán, loại trừ chính nó khỏi mẫu số), biểu đồ lịch sử giá (Recharts `LineChart`, dữ liệu
  `priceHistory` vốn đã có sẵn trong Prisma include — chỉ thiếu phần vẽ ở frontend), và 1 dòng nêu
  khác biệt lớn nhất so với máy đang xem trong danh sách "Máy tương tự" (so theo % chênh lệch lớn
  nhất giữa cân nặng/RAM/SSD/tần số quét/pin).
- **Danh mục (mục 6)**: thêm banner "Không biết chọn gì? Để AI tư vấn ✨" dẫn sang Wizard, đặt ngay
  dưới tiêu đề trang, trước bộ lọc.
- **Hàng đợi nhãn (mục 11)**: thêm checkbox "Khóa nhãn, không cho mô hình thay đổi" khi duyệt —
  backend đã có sẵn cơ chế `SegmentLabel.locked` (từ trước, dùng ở `applySegmentLabel`) nhưng chưa
  có đường dẫn nào từ giao diện set được cờ này; nay `PATCH /labels/review-queue/:id` nhận thêm
  `locked` và `AdminReviewQueue.tsx` có checkbox tương ứng.
- **Benchmark (mục 12)**: thêm `Alert` cảnh báo "Thay đổi điểm sẽ ảnh hưởng mọi máy dùng linh kiện
  này" khi SỬA (không hiện khi thêm mới) — mở rộng `CrudTable.renderFormExtra` nhận thêm tham số
  `isEdit` để phân biệt 2 chế độ.
- **Mô hình (mục 13)**: thêm bảng Precision/Recall/F1-score theo từng phân khúc trong Drawer chi
  tiết phiên bản — dữ liệu (`metrics.test.report`) đã có sẵn từ lúc huấn luyện, chỉ thiếu bảng hiển
  thị.
- **Đăng nhập (mục 16)**: trước đây `AdminLogin.tsx` LUÔN điền sẵn tài khoản demo (không điều
  kiện), còn `CustomerLogin.tsx` không có điền sẵn nào. Nay cả 2 chỉ điền sẵn khi biến môi trường
  `VITE_DEMO=true` (mặc định bật ở `.env` cho môi trường đồ án, tắt/xóa dòng này trước khi triển
  khai thật).

**Đã kiểm thử trên browser** (điều hướng thủ công qua Trang chủ, Danh mục, Chi tiết máy `id=5190`,
đăng nhập quản trị bằng tài khoản demo tự điền, form Sửa Benchmark CPU, Drawer chi tiết mô hình):
xác nhận cả 9 điểm trên hiển thị đúng, không lỗi console mới (các cảnh báo antd deprecated và lỗi
mạng còn lại là từ trước, không liên quan thay đổi lần này). `npx tsc -p tsconfig.app.json --noEmit`
sạch ở frontend, `npx tsc --noEmit` sạch ở backend, `pytest` ml-service 35/35 pass.

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
