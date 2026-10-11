# 19 — Bài trình bày đầy đủ Mô hình A (TV1) để luyện nói

> **Cách luyện:** đọc phần **Lời nói**, che phần còn lại, tự nói lại; mở đúng file/màn hình ở phần **Chỉ trên màn hình**.
> Mọi con số trong bài đều truy được về code hoặc `metadata.json`. Chỗ nào là số của lần chạy riêng, bài ghi rõ.
> Phiên bản mô hình đang dùng: `clf-2026.09.27-160831` (`ml-service/artifacts/LATEST`).

---

## 0. Mở đầu 30 giây (thuộc lòng)

Máy mới vào hệ thống chưa có phân khúc. Mô hình A chuẩn hóa 11 thông số của máy, tìm 7 máy đã có nhãn giống nhất,
cho 7 máy đó bỏ phiếu để ra phân khúc kèm độ tin cậy. Độ tin cậy dưới 0,6 thì máy vào hàng đợi cho nhân viên xác minh.
Tham số (k, cách đo, cách đếm phiếu) do hệ thống thử 64 tổ hợp rồi chọn. Điểm macro-F1 trên 200 máy giữ riêng là **0,787**,
so với đoán bừa **0,128** và luật if-else viết tay **0,632**.

**Năm con số:** 7 (láng giềng) · 64 (tổ hợp) · 0,787 (macro-F1) · 0,6 (ngưỡng) · 0,375 (recall CREATOR, điểm yếu).

---

## 1. Bài toán và luồng hệ thống

**Lời nói:** "Cửa hàng không thể gán nhãn tay cho từng máy. Máy chưa có nhãn thì hệ thống không gợi ý được cho khách.
Mô hình A đoán nhãn từ cấu hình."

```
Nhân viên thêm máy ─► Backend (segment.service.ts) ──POST /predict-segment──► ML (main.py:88)
        ▲                                                                        │
        └── nhãn + xác suất 4 lớp + 7 láng giềng ◄──────────────────────────────┘
   tin cậy ≥ 0,6 → VERIFIED      tin cậy < 0,6 → NEEDS_REVIEW (hàng đợi Duyệt nhãn)
```

**Code, hai đầu của luồng:**

```python
# ml-service/app/main.py:88, 98
@app.post("/predict-segment")  # cổng nhận từ backend
...
proba = registry.model.predict_proba(X[MODEL_A_FEATURES])  # chuẩn hóa -> 7 láng giềng -> tỷ lệ phiếu 4 nhãn
```

```ts
// backend/src/modules/laptops/segment.service.ts:25, 138
const DEFAULT_CONFIDENCE_THRESHOLD = 0.6;
const status = requested ? 'VERIFIED' : prediction!.proba >= threshold ? 'VERIFIED' : 'NEEDS_REVIEW';
```

---

## 2. kNN là gì, vì sao chọn kNN

**Lời nói:** "kNN giống việc hỏi k người hàng xóm giống mình nhất rồi lấy ý kiến số đông. Nó không học luật, chỉ ghi nhớ
dữ liệu và tra cứu khi cần."

- kNN là **thuật toán**. Euclidean/Manhattan là **cách đo "gần"** mà kNN cần chọn. Hai khái niệm khác nhau.
- Vì sao chọn (docs/01 mục 3): (1) đề tài là khuyến nghị nên "tìm máy gần nhất" chính là kNN, dùng chung cho cả
  Mô hình A và B; (2) **giải thích được**, giao diện hiện luôn 7 máy đã bỏ phiếu; (3) dữ liệu nhỏ (1.000 máy);
  (4) thêm máy mới không cần học lại tham số.
- **Nói thẳng:** trên dữ liệu dạng bảng, Random Forest/XGBoost thường chính xác ngang hoặc hơn. Nhóm **chưa chạy
  so sánh** các mô hình đó trên dữ liệu này, nên **không được nói** "kNN chính xác hơn". Lý do chọn là hợp yêu cầu
  giải thích và khuyến nghị.

---

## 3. Dữ liệu vào: 11 đặc trưng và chuẩn hóa

**Lời nói:** "Mô hình không biết i5 hay Ryzen mạnh yếu thế nào, nên mọi thứ đổi thành số. Đơn vị khác nhau (GB, kg, Hz)
nên phải đưa về cùng thước đo trước khi đo khoảng cách. Giá cố ý không đưa vào, để phân khúc theo cấu hình chứ không theo giá."

```python
# ml-service/app/data/features.py:20-29
NUMERIC_LOG = ["ram_gb", "ssd_gb"]   # nhóm 1: log2 rồi chuẩn hóa (8->16GB và 16->32GB đều "gấp đôi")
NUMERIC = ["cpu_score", "gpu_score", "screen_inch", "ppi", "refresh_hz", "weight_kg", "battery_wh"]  # nhóm 2
BINARY = ["gpu_dedicated", "srgb_100"]   # nhóm 3: giữ 0/1
MODEL_A_FEATURES = NUMERIC_LOG + NUMERIC + BINARY   # 11 cột = 2 + 7 + 2
```

```python
# features.py:187-214 (rút gọn): cùng một bộ tiền xử lý, đặt TRONG Pipeline
("log", Pipeline([impute trung vị, FunctionTransformer(np.log2), StandardScaler()]), NUMERIC_LOG),
("num", Pipeline([impute trung vị, StandardScaler()]), NUMERIC),
("bin", "passthrough", BINARY),
```

- **[CẤU TRÚC]** thứ tự: điền thiếu → log2 (chỉ RAM/SSD) → z-score `(x − trung bình) ÷ độ lệch chuẩn`.
- **[DỮ LIỆU/CẤU HÌNH]** danh sách cột nào vào nhóm nào.
- Trung bình và độ lệch chuẩn tính trên **800 máy huấn luyện**, lưu trong `model.joblib`
  (xem lệnh ở docs/17; cách tự kiểm tra ở docs/15 mục 1.11).

---

## 3b. Dữ liệu từ đâu ra, "học 800 máy, thử 200 máy" nghĩa là gì (bản tóm tắt; bản chi tiết ở Phần 2 mục D0)

**Lời nói:** "Mô hình học từ một file CSV 1.000 máy, mỗi máy đã có sẵn nhãn phân khúc. Ta giữ riêng 200 máy không cho mô hình
nhìn, 800 máy còn lại là 'sách giáo khoa'. Học xong, ta bắt mô hình đoán nhãn 200 máy giữ riêng rồi so với nhãn thật để chấm điểm."

| Câu hỏi | Trả lời (đã kiểm chứng) |
|---|---|
| Dữ liệu học nằm ở đâu? | `data/processed/catalog_vn.csv`: 1.000 dòng, 23 cột, mỗi dòng một máy, cột cuối `segment` là nhãn. Huấn luyện **đọc CSV, không đọc Excel và không đọc database** (`train.py:46-47`) |
| Điểm CPU/GPU lấy ở đâu? | Tra từ `cpu_benchmark.csv` (29 dòng) và `gpu_benchmark.csv` (21 dòng) cùng thư mục (`train.py:51-53`) |
| File nào chia 800/200? | `ml-service/app/lifecycle/train.py:83`, hàm `train_test_split`, seed 42 nên chia giống nhau mọi lần chạy |
| File nào "học"? | `ml-service/app/models/classifier.py:43-51`, hàm `grid_search`, chỉ nhận 800 máy |
| File nào chấm 200 máy? | `train.py:104-112` |
| Học xong, mô hình nhớ gì? | Đúng **800 máy sau chuẩn hóa** (ma trận 800 hàng x 11 cột) và nhãn của chúng, cộng trung bình/độ lệch chuẩn của 11 cột. Lưu thành `artifacts/<phiên bản>/model.joblib` (166 KB) |

**Hai điều phải nói thẳng khi bị hỏi về dữ liệu:**
1. **Nhãn `segment` do chương trình sinh dữ liệu tự gán**, không phải do người hay nhà bán lẻ thật gán
   (`data/generate_catalog.py:379-406`, hàm `assign_segment`; `data/README.md` ghi "dữ liệu tổng hợp có logic").
   Hàm này tính điểm GAMING/CREATOR/ULTRABOOK/OFFICE từ chính các cột cấu hình rồi **cộng nhiễu ngẫu nhiên** (độ lệch 0,32).
   Vì vậy macro-F1 0,787 cho biết kNN **khôi phục lại luật gán nhãn có nhiễu** tốt đến đâu, **chưa chứng minh** đúng với
   nhãn của thị trường thật.
2. Cách làm đúng khi có dữ liệu thật: thay `catalog_vn.csv` bằng catalog thu thập thật, giữ nguyên tên cột
   (`data/README.md`, mục "Việc cần làm khi có dữ liệu thật").

---

## 4. Đo "gần": khoảng cách Euclidean

**Lời nói:** "Hai máy cách 3 ô ngang, 4 ô dọc thì khoảng cách √(3²+4²) = 5. Với 11 đặc trưng thì cộng thêm số hạng
trong căn."

```
d(máy 1, máy 2) = √( Σ (đặc trưng_j của máy 1 − đặc trưng_j của máy 2)² )      j = 1..11
```

**Ví dụ thật (docs/15 mục 1.13):** Acer Predator Helios 0051 (máy A) và Gigabyte G5 0276 (láng giềng #1):
tổng bình phương = 3,2244 → √3,2244 = **1,7957**, scikit-learn trả về **1,7957**, giao diện hiện `#1 · khoảng cách 1.80`.
RAM chiếm 49,5% tổng, ppi 29,8%, cân nặng 11,9%.

**Euclidean hay Manhattan? Nói đúng với dữ liệu:**

| Nguồn | Euclidean | Manhattan |
|---|---|---|
| GridSearch trên 800 máy (`metadata.json`) | được chọn | thua |
| Chạy lại 5 phần trên cả 1.000 máy, k=7, uniform (`ablation.run_ablation`, chạy hôm nay) | 0,7788 ± 0,0321 | 0,7830 ± 0,0501 |

Hai cách chênh 0,004, **nhỏ hơn nhiều so với độ dao động** (±0,03 đến ±0,05), tức **không có cách nào hơn rõ ràng**.
Vì vậy **không nói** "Euclidean tốt hơn vì Manhattan nhạy ngoại lệ". Nói: "hệ thống thử cả hai, Euclidean được chọn
trên tập huấn luyện, hai cách cho kết quả tương đương; Euclidean là khoảng cách Pytago, dễ giải thích."

---

## 5. Huấn luyện: chia dữ liệu, thử 64 tổ hợp

**Lời nói:** "Ta chưa biết k bằng bao nhiêu là tốt, nên không đoán mà thử rồi đo. Mỗi bộ tham số được chấm bằng cách
học trên 4 phần dữ liệu, kiểm tra trên phần còn lại, lặp 5 lần."

```python
# ml-service/app/lifecycle/train.py:83, 96
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, stratify=y, random_state=RANDOM_STATE)  # 800 học / 200 giấu
search = grid_search(X_train, y_train)   # 64 tổ hợp x 5 phần = 320 lần học (chỉ dùng 800 máy)
```

```python
# ml-service/app/models/classifier.py:28-32
PARAM_GRID = {  # 16 x 2 x 2 = 64 tổ hợp
    "knn__n_neighbors": list(range(1, 32, 2)),   # k = 1, 3, 5, ..., 31 (lẻ để không hòa phiếu)
    "knn__weights": ["uniform", "distance"],     # uniform: mỗi máy 1 phiếu; distance: gần thì phiếu nặng hơn
    "knn__metric": ["euclidean", "manhattan"],
}
```

- **Kết quả chọn** (`metadata.json`): k = 7, weights = uniform, metric = euclidean.
- **Vì sao k chạy tới 31:** quy tắc kinh nghiệm k ≲ √n, với n = 800 thì √800 ≈ 28. Đây là gợi ý, không phải định lý.
- **uniform vs distance:** không cần nhớ phép tính; hệ thống tự thử và giữ cách điểm cao hơn.
- **Đường cong k** (`metadata.json` → `k_curve`, ảnh `k_curve.png`):

| k | 1 | 3 | 5 | **7** | 9 | 11 | 31 |
|---|---|---|---|---|---|---|---|
| macro-F1 (CV) | 0,757 | 0,765 | 0,758 | **0,794** | 0,784 | 0,777 | 0,697 |

k nhỏ thì nhạy với máy lạ; k lớn thì mờ ranh giới. **Nói thẳng:** k = 9 chỉ kém 0,009, nằm trong độ dao động
(±0,03 đến ±0,05), nên k = 7 hơn nhẹ chứ không áp đảo.

---

## 6. Không "rò rỉ dữ liệu"

**Lời nói:** "Bộ chuẩn hóa nằm trong Pipeline nên mỗi lần kiểm thử chéo nó chỉ học trung bình và độ lệch chuẩn từ
phần huấn luyện. 200 máy giấu không ảnh hưởng gì đến chuẩn hóa."

```python
# classifier.py:35-41
def build_pipeline() -> Pipeline:
    return Pipeline([("prep", build_model_a_preprocessor()), ("knn", KNeighborsClassifier())])
```

- Có test chặn lỗi này: `ml-service/tests/test_classifier.py` → `test_scaler_inside_pipeline`.
- **Bằng chứng đã đo** (docs/15 mục 1.7b và buổi học trước): chuẩn hóa ngoài Pipeline chỉ làm điểm lệch rất nhỏ
  (0,7938 so với 0,7923). Tức rò rỉ ở đây có thật nhưng ảnh hưởng nhỏ; vẫn đặt trong Pipeline vì đó là cách làm đúng.
- **Đừng dùng** cặp "CV 0,7938 và test 0,7866 chênh ít nên chắc chắn không rò rỉ" làm bằng chứng: hai con số đo trên
  hai tập khác nhau, chênh ít không chứng minh được gì về rò rỉ.

---

## 7. Đánh giá: macro-F1, baseline, ma trận nhầm lẫn

**Lời nói:** "Ta chấm bằng macro-F1 vì dữ liệu lệch lớp: CREATOR chỉ 12%. Nếu chỉ nhìn độ chính xác thường (0,85)
thì lớp CREATOR bị bỏ sót mà không thấy."

```python
# train.py:110
test_f1_macro = f1_score(y_test, y_pred_test, average="macro")   # F1 từng lớp rồi lấy trung bình đều
```

| Chỉ số | Giá trị | Nguồn |
|---|---|---|
| macro-F1 trên 200 máy giữ riêng | **0,787** | `metadata.json` → `test_metrics.f1_macro` |
| Độ chính xác thường trên 200 máy | 0,85 | `metadata.json` → `report.accuracy` |
| macro-F1 do GridSearch báo (CV) | 0,794 | hơi lạc quan: là điểm của "người thắng" trong 64 tổ hợp |
| macro-F1 chạy lại trung thực 5 phần trên 1.000 máy | 0,773 | docs/15 mục 1.7 (`evaluate.py`), **số nên dùng khi báo cáo** |
| Baseline đoán lớp đông nhất | 0,128 | `dummy_baseline` |
| Baseline luật if-else | 0,632 | `rule_based_baseline` |

**Ma trận nhầm lẫn 200 máy giữ riêng** (hàng = nhãn thật, cột = mô hình đoán):

| thật \ đoán | CREATOR | GAMING | OFFICE | ULTRABOOK |
|---|---|---|---|---|
| CREATOR (24) | 9 | **14** | 1 | 0 |
| GAMING (67) | 3 | 63 | 1 | 0 |
| OFFICE (69) | 0 | 1 | 65 | 3 |
| ULTRABOOK (40) | 0 | 0 | 7 | 33 |

- Recall CREATOR = 9 ÷ 24 = **0,375**; precision CREATOR = 9 ÷ 12 = 0,75.
- Trên kiểm thử chéo 1.000 máy, recall CREATOR = 0,44 (49/120 máy CREATOR bị đoán thành GAMING). Hai con số khác nhau vì
  tập đo khác nhau; khi nói phải nêu rõ đang dùng số nào.
- **Vì sao CREATOR ↔ GAMING nhầm:** hai nhóm có cấu hình phần cứng gần giống (GPU mạnh, RAM nhiều), khác nhau chủ yếu ở
  mục đích sử dụng (docs/15 mục 1.7). Đây là hạn chế đã biết, và là lý do có hàng đợi Duyệt nhãn.

---

## 8. Ablation: bỏ từng thành phần xem điểm đổi thế nào

**Lời nói:** "Để biết một thành phần có ích không, ta bỏ nó đi rồi đo lại trên cùng cách kiểm thử."

Kết quả **chạy hôm nay** trên dữ liệu hiện tại (`app/lifecycle/ablation.py::run_ablation`, k=7, uniform, euclidean,
kiểm thử chéo 5 phần trên 1.000 máy; chạy lại bằng `python -m app.lifecycle.ablation`):

| Biến thể | macro-F1 (trung bình ± độ lệch) |
|---|---|
| Đầy đủ 11 đặc trưng (baseline) | 0,7788 ± 0,0321 |
| Bỏ chuẩn hóa (StandardScaler) | 0,7460 ± 0,0327 |
| Bỏ `refresh_hz` | 0,7297 ± 0,0549 |
| Bỏ `srgb_100` | 0,7483 ± 0,0329 |
| Manhattan thay Euclidean | 0,7830 ± 0,0501 |

**Cách đọc đúng:**
- Chỉ cắt 4 thành phần, **không xếp hạng được tầm quan trọng của cả 11 đặc trưng**. Không nói "CPU quan trọng nhất"
  khi chưa đo.
- Bỏ chuẩn hóa làm giảm khoảng 0,033, lớn hơn độ dao động của baseline (0,032) một chút: có dấu hiệu chuẩn hóa có ích,
  chưa phải kết luận chắc.
- Tập tin `experiments.json` cũ trong `artifacts/clf-2026.09.26-121519/` là của **dữ liệu khác** (macro-F1 ≈ 0,986,
  k = 1); không dùng để báo cáo cho mô hình hiện tại.

---

## 9. Hàng đợi Duyệt nhãn và vòng đời mô hình

**Lời nói:** "Khi AI không chắc thì không tự quyết. Máy vào hàng đợi, nhân viên chọn nhãn, có thể khóa nhãn để
mô hình không ghi đè quyết định của người."

- Ngưỡng 0,6 tương ứng **từ 5/7 phiếu trở lên** (5/7 = 0,714 qua ngưỡng; 4/7 = 0,571 chưa qua), `segment.service.ts:138`.
- Xuất nhãn người đã duyệt ra CSV (nút "Xuất nhãn đã duyệt (CSV)") rồi đưa vào dữ liệu huấn luyện lần sau, khép vòng phản hồi.
- Huấn luyện chỉ lưu bản **Dự phòng**; bấm **Đưa vào sử dụng** mới đổi `LATEST` (cổng 2 quy tắc ở
  `models.routes.ts:63`). Lần huấn luyện đầu tiên mới tự ghi `LATEST` (`train.py:182`).

---

## 10. Kịch bản DEMO trên giao diện (đã thử thật, docs/15 mục 1.12)

Điều kiện: 3 dịch vụ đang chạy (shortcut Desktop `SmartLap`); đăng nhập quản trị `admin@smartlap.vn` / `Demo@123`.

**Demo 1: chắc chắn (7/7 phiếu)**
1. Menu **Dữ liệu → Laptop**, gõ `TUF Gaming 0001` vào ô tìm kiếm.
2. Bấm **Sửa** ở dòng `ASUS TUF Gaming 0001`, rồi bấm **"AI gợi ý phân khúc từ cấu hình"**.
3. Mong đợi: `Dự đoán: Gaming 100%`; "7 máy gần nhất đã bỏ phiếu: 7 Gaming"; khoảng cách
   `0.00 (chính nó), 1.79, 1.83, 1.99, 2.12, 2.14, 2.24`.
4. Bấm **Hủy** (không lưu).
   *Lời nói:* "Bảy máy giống nhất đều là Gaming nên AI chắc chắn 100%. Khoảng cách 0,00 là chính máy này nằm trong dữ liệu."

**Demo 2: ranh giới (cần xác minh)**
1. Tìm `Predator Helios 0051`, bấm **Sửa**, bấm nút AI như trên.
2. Mong đợi: xác suất `Văn phòng 14% / Mỏng nhẹ 43% / Gaming 0% / Đồ họa 43%`; "3 Đồ họa, 3 Mỏng nhẹ, 1 Văn phòng";
   khoảng cách `1.80 ... 2.29`; nhãn **"Cần xác minh"** và dòng cảnh báo "Hệ thống chưa chắc chắn".
3. Giao diện còn hiện "Bạn đang chọn phân khúc khác với AI" vì ô Phân khúc của máy này đang là Đồ họa – Kỹ thuật
   (nhãn thật), khác với nhãn AI hiện ở dòng đầu (Mỏng nhẹ).
4. Bấm **Hủy** (hoặc phím Esc).
   *Lời nói:* "Hai nhóm hòa 3-3 nên độ tin cậy 43%, dưới ngưỡng 60%, máy vào hàng đợi cho người xác nhận.
   Khi hòa phiếu giao diện hiện Mỏng nhẹ chỉ do thứ tự sắp xếp trong code (Phần 2, mục D3), không phải AI nghiêng về Mỏng nhẹ."

**Demo 3: để trống phân khúc, AI tự gán khi Lưu**
1. **+ Thêm mới**: CPU `Intel Core i9-13900H`, GPU `RTX 4070`, RAM 32, SSD 1024, màn 16", 240 Hz, nặng 2,6 kg, giá 45 triệu,
   SKU bất kỳ, **để trống ô Phân khúc**.
2. Bấm **Lưu**; mong đợi thông báo "Đã gán phân khúc: Gaming".
3. **Xóa máy thử** sau khi demo (nút Xóa ở dòng đó). Demo này ghi dữ liệu thật vào DB nên bắt buộc dọn.

**Demo 4: hàng đợi Duyệt nhãn**
Menu **Dữ liệu → Duyệt nhãn** (huy hiệu số 6). Mỗi thẻ có phân bố xác suất, ô chọn phân khúc, checkbox
"Khóa nhãn, không cho mô hình thay đổi", nút **Duyệt (giữ nhãn AI)**; góc trên có nút **Xuất nhãn đã duyệt (CSV)**.
**Lưu ý trung thực:** 6 thẻ này là **dữ liệu mẫu** do `backend/scripts/seedReviewQueue.ts` tạo (cột `predictedBy` =
`demo-seed-review-queue`), không phải mô hình hiện tại đoán. Dấu hiệu: xác suất như 52%, 47% không phải bội số của 1/7.
Mô hình hiện tại (k = 7, uniform) chỉ ra được 0%, 14%, 29%, 43%, 57%, 71%, 86%, 100%. Nếu hội đồng hỏi thì nói đúng như vậy.

---

## 11. Câu hỏi hội đồng (tự trả lời trước, rồi đối chiếu)

**H1. Vì sao dùng kNN mà không phải mô hình khác?**
- Trả lời: dữ liệu nhỏ, cần giải thích được (hiển thị 7 máy đã bỏ phiếu), và kNN dùng chung cho cả xếp hạng ở Mô hình B.
- Bằng chứng: docs/01 mục 3; giao diện Demo 1.
- Hạn chế nói thẳng: chưa so với Random Forest/XGBoost trên dữ liệu này.

**H2. Vì sao k = 7?**
- Trả lời: hệ thống thử k lẻ từ 1 đến 31, k = 7 có macro-F1 cao nhất (0,794).
- Bằng chứng: `metadata.json` → `k_curve`; ảnh `k_curve.png`.
- Hạn chế: k = 9 chỉ kém 0,009, trong phạm vi dao động.

**H3. Vì sao Euclidean mà không phải Manhattan?**
- Trả lời: hệ thống thử cả hai; Euclidean được chọn trên tập huấn luyện; chạy lại cả 1.000 máy thì hai cách tương đương.
- Bằng chứng: bảng ở mục 4 (0,7788 so với 0,7830, trong độ dao động).
- Hạn chế: không có bằng chứng Euclidean hơn rõ rệt; chọn vì dễ giải thích.

**H4. Làm sao biết mô hình không đoán đúng do may?**
- Trả lời: so với hai mốc. Đoán lớp đông 0,128; luật tay 0,632; kNN 0,787.
- Bằng chứng: `metadata.json` → `baseline`.
- Hạn chế: dữ liệu là tổng hợp có logic, chưa phải catalog thu thập thật (docs/14 mục 7).

**H5. Vì sao dùng macro-F1 mà không dùng độ chính xác?**
- Trả lời: dữ liệu lệch lớp; độ chính xác 0,85 che mất việc CREATOR chỉ nhận ra 37,5%.
- Bằng chứng: ma trận nhầm lẫn ở mục 7 (9/24).
- Hạn chế: trên tập 200 máy, lớp CREATOR chỉ có 24 máy nên recall dao động nhiều.

**H6. Vì sao không đưa giá vào mô hình?**
- Trả lời: để phân khúc theo cấu hình, không theo giá (quyết định D-04); có test chặn `test_price_not_in_classifier`.
- Ví dụ: hai máy cùng cấu hình khác giá vẫn phải cùng phân khúc.

**H7. Khi AI không chắc thì sao?**
- Trả lời: độ tin cậy dưới 0,6 thì NEEDS_REVIEW, người xác nhận, có thể khóa nhãn.
- Bằng chứng: `segment.service.ts:138`; Demo 2 (Helios 0051, 43%).

**H8. Điểm yếu lớn nhất?**
- Trả lời: CREATOR hay bị nhầm thành GAMING (14/24 trên tập giữ riêng; 49/120 trên kiểm thử chéo).
- Cách xử lý: hàng đợi Duyệt nhãn, xuất nhãn đã duyệt để huấn luyện lại.

**H9. Dữ liệu lấy ở đâu? Nhãn do ai gán?**
- Trả lời: 1.000 máy trong `data/processed/catalog_vn.csv`, do `data/generate_catalog.py` sinh theo ràng buộc thực tế
  (chỉ ghép CPU–GPU có trên thị trường, giá theo cấu hình). Nhãn phân khúc được gán bằng công thức điểm có cộng nhiễu.
- Bằng chứng: `data/README.md`; `generate_catalog.py:379-406`; Phần 2 mục D0.1.
- Hạn chế nói thẳng: đây là **dữ liệu tổng hợp**; 0,787 là khả năng khôi phục luật gán nhãn có nhiễu, chưa kiểm chứng trên
  nhãn thị trường thật. Hướng khắc phục: thay bằng catalog thu thập thật và để hai người gán nhãn độc lập (tính Cohen's kappa).

**H10. "Học 800 máy, thử 200 máy" là làm thế nào, sao không chấm trên chính 800 máy?**
- Trả lời: kNN học bằng cách ghi nhớ 800 máy đã chuẩn hóa. 200 máy giữ riêng không được nhìn trong lúc học, dùng làm "đề thi".
  Chấm trên chính 800 máy thì mỗi máy tìm thấy chính nó nên điểm cao giả.
- Bằng chứng: `train.py:83` (chia), `classifier.py:50` (học), `train.py:104-112` (thi); `knn._fit_X.shape = (800, 11)`.
- Ví dụ: Helios 0051 thuộc 200 máy giữ riêng; TUF Gaming 0001 thuộc 800 máy học (Phần 2 mục D0.5, D5).

**H11. Nếu thay ngưỡng 0,6 bằng 0,7 thì chuyện gì xảy ra?**
- Trả lời: ngưỡng được đọc từ cấu hình mỗi lần gán nhãn nên áp dụng ngay cho máy mới, không áp dụng ngược cho máy đã có nhãn.
  Với k = 7, xác suất chỉ là bội số của 1/7 nên 0,6 và 0,7 cho kết quả giống nhau (đều cần ít nhất 5/7 phiếu).
- Bằng chứng: `segment.service.ts:52-56, 135, 138`; `labels.routes.ts:24`; Phần 2 mục D7b.
- Hạn chế nói thẳng: giao diện còn hai chỗ cố định 0,6 (`SegmentSuggester.tsx:118`, `ConfidenceIndicator.tsx:13`).

**H12. Kiểm thử chéo (CV) là gì, khác gì thi cuối 200 máy?**
- Trả lời: CV chia 800 máy học thành 5 phần, lần lượt lấy 1 phần làm đề thi, rồi lấy điểm trung bình; dùng để chọn tham số.
  200 máy giữ riêng chỉ dùng một lần ở cuối để báo cáo.
- Bằng chứng: `classifier.py:46`; 5 điểm 0,7714 / 0,8409 / 0,7703 / 0,8542 / 0,7321, trung bình 0,7938 (Phần 2 mục D8, D9).

---

## 12. Danh sách tự kiểm tra trước khi lên nói

- [ ] Nói trơn đoạn mở đầu 30 giây (mục 0) không nhìn tài liệu.
- [ ] Giải thích được "kNN là thuật toán, Euclidean là cách đo gần" bằng một câu.
- [ ] Đọc được `PARAM_GRID` và nói 16 × 2 × 2 = 64, nhân 5 phần = 320 lần học.
- [ ] Chỉ được trên ma trận nhầm lẫn ô nào là 0,375 (9 trên 24).
- [ ] Nêu được ba số của macro-F1 (0,787 test; 0,794 GridSearch; 0,773 chạy lại) và biết khi nào dùng số nào.
- [ ] Làm trôi chảy Demo 1 và Demo 2, kết thúc bằng nút **Hủy**.
- [ ] Biết nói "chưa đo" với những gì chưa đo (so với Random Forest, xếp hạng 11 đặc trưng).
- [ ] Chỉ được file nào chia 800/200 (`train.py:83`), file nào học (`classifier.py:50`), file nào dữ liệu (`catalog_vn.csv`).
- [ ] Nói thẳng được "nhãn là dữ liệu tổng hợp" mà không bị lúng túng (mục 3b, H9).
- [ ] Không nói "tập test đóng băng" (mục D0.7).
- [ ] Giải thích được CV bằng ví dụ "5 đề ôn, lần lượt lấy 1 đề thi thử" (mục D8).
- [ ] Nói đúng khi đổi ngưỡng: chỉ áp dụng máy mới, và 0,6 với 0,7 giống nhau khi k = 7 (mục D7b).

---
---

# PHẦN 2 — ĐI SÂU: từng dòng code, từng phép tính, kèm thao tác trên giao diện

> **Cách đọc phần này:** đi theo đúng thứ tự một lần bấm nút trên giao diện, từ trình duyệt → backend → ML → quay về.
> Mỗi mục có 4 khối: **(a) Trên giao diện** bấm gì, thấy gì · **(b) Code** từng dòng, câu mẫu "A gọi B" ·
> **(c) Tính từng bước** bằng số thật · **(d) Tổng kết 30 giây**.
> Số liệu lấy bằng cách chạy chính `model.joblib` đang dùng (`clf-2026.09.27-160831`) trên `data/processed/catalog_vn.csv`,
> và đã so khớp với giao diện ngày 10/10/2026. Máy ví dụ xuyên suốt: **Acer Predator Helios 0051** (nhãn thật CREATOR,
> thuộc 200 máy giữ riêng nên mô hình chưa từng "thấy").

**Bản đồ cả chuyến đi của một lần bấm nút**

```
[D0] NGOẠI TUYẾN, TRƯỚC ĐÓ  generate_catalog.py -> catalog_vn.csv (1.000 máy) -> train.py chia 800 học / 200 thử
        │                    -> kNN ghi nhớ 800 máy -> model.joblib       (ML nạp file này khi khởi động)
        ▼
[D1] Trình duyệt  SegmentSuggester.tsx:48   api.post('/laptops/predict-segment')
        │
[D2] Backend      laptops.routes.ts:258     -> predictSegment()  segment.service.ts:59
        │         tra điểm CPU/GPU, tính ppi, gói 11 đặc trưng, mlClient.post('/predict-segment')
        │
[D3] ML           main.py:88 predict_segment()
        │           [D4] chuẩn hóa: log2 + z-score  (features.py:187)
        │           [D5] đo khoảng cách tới 800 máy, lấy 7 máy gần nhất
        │           [D6] đếm phiếu -> xác suất, chọn nhãn
        │
[D2] Backend      trả JSON cho trình duyệt -> hiện "Dự đoán ... %", 7 khoảng cách
        │
[D7] Khi bấm Lưu  applySegmentLabel()  segment.service.ts:106 -> so ngưỡng 0,6 -> VERIFIED / NEEDS_REVIEW
```

Những thứ dùng ở D4–D6 (trung bình, độ lệch chuẩn, 800 máy, k = 7) đều được **tạo ra lúc huấn luyện** (mục D8–D10).

---

## D0. Trước khi có nút bấm: dữ liệu từ đâu, mô hình "học 800 máy, thử 200 máy" như thế nào

> Đây là phần **chạy ngoại tuyến, một lần**, xảy ra **trước** mọi bước D1–D7. Mọi thứ D4–D6 dùng (800 máy, trung bình,
> độ lệch chuẩn, k = 7) đều được tạo ở đây.

> **Đừng nhầm hai thư mục tên `data`:** dữ liệu học nằm ở **`D:\QL_Laptop\data\processed\`** (thư mục `data` ở gốc dự án, cùng cấp với
> `ml-service`, `backend`, `frontend`). Còn `ml-service\app\data\` là thư mục **mã nguồn** (`features.py`, `data_check.py`), không có
> thư mục `processed`. Trong `train.py`, `ROOT = ...parents[3]` chính là thư mục gốc `D:\QL_Laptop`.

### D0.1 Dữ liệu học đến từ đâu (chuỗi tạo ra file)

```
data/generate_catalog.py  ──ghi──►  data/raw/catalog_vn_raw.xlsx           (bản Excel thô, 1.000 dòng)
(chạy: python data/generate_catalog.py)  data/processed/catalog_vn.csv     (1.000 dòng, 23 cột, có nhãn segment)  ◄── HUẤN LUYỆN ĐỌC FILE NÀY
                                         data/processed/cpu_benchmark.csv  (29 CPU, điểm PassMark tham chiếu)
                                         data/processed/gpu_benchmark.csv  (21 GPU)
```

- **Không có catalog thật được thu thập.** `generate_catalog.py` sinh máy theo ràng buộc thực tế (chỉ ghép CPU–GPU có trên
  thị trường, giá là hàm của cấu hình x thương hiệu x nhiễu, 35% máy đang giảm giá). Dòng `source_url` trong CSV là
  `https://example-retailer.vn/mock`. Mô tả đầy đủ: `data/README.md`.
- **Nhãn `segment` được gán bằng công thức có nhiễu**, `generate_catalog.py:379-406`:

```python
gaming  = 2.8 * gpu_n + 0.8 * cpu_n + 1.0 * (refresh_hz >= 144) + 0.6 * dedicated - 0.6 * (weight_kg < 1.6)
creator = 1.5 * cpu_n + 1.2 * gpu_n + 1.0 * srgb_100 + 0.7 * (ppi > 190) + 0.5 * (ram_gb >= 32) - 0.6 * (refresh_hz >= 165)
...                                                                              # ultra, office tương tự
noisy = {k: v + np.random.normal(0, 0.32) for k, v in scores.items()}            # cộng nhiễu ngẫu nhiên
return max(noisy, key=noisy.get)                                                  # nhãn = lớp có điểm cao nhất sau nhiễu
```

  Công thức dùng **chính các cột cấu hình** mà mô hình cũng nhìn thấy; phần nhiễu làm cho các phân khúc chồng lấn tự nhiên
  (GAMING và CREATOR hay lẫn nhau). Hệ quả khi trình bày: **điểm 0,787 đo khả năng khôi phục luật gán nhãn có nhiễu, chưa phải
  độ đúng trên nhãn thị trường thật.** Docs/01 (quyết định D-02) từng dự định dùng nhãn thật của nhà bán lẻ; hiện nhóm đang dùng
  dữ liệu tổng hợp và `data/README.md` ghi rõ điều này.
- **Kiểm tra định dạng trước khi học:** `check_catalog_format` (`ml-service/app/data/data_check.py:32`) báo lỗi bằng tiếng Việt
  nếu thiếu cột, có ô không phải số, hoặc `segment` không thuộc 4 giá trị. Chạy riêng: `python -m app.data.data_check`.
- **Database của web (1.000 laptop trong trang "Laptop") cũng được nạp từ chính file CSV này** (`backend/prisma/seed.ts:110`),
  nhưng **huấn luyện không đọc database**. Thêm/sửa máy trên web không tự làm mô hình học thêm. Muốn đưa nhãn đã duyệt vào
  học thì dùng nút "Xuất nhãn đã duyệt (CSV)" rồi gộp vào `catalog_vn.csv` (docs/15 mục 1.14).

### D0.2 Ai chạy huấn luyện, và chạy ở đâu

- Dòng lệnh: `python -m app.lifecycle.train` (chạy từ thư mục `ml-service`); hoặc
- Giao diện: **Trí tuệ → Quản lý mô hình → Huấn luyện mô hình mới** → backend `models.routes.ts:35`
  → ML `main.py:218` (`/train`) → `train_module.run_training()`. Kết quả luôn là bản **Dự phòng**, không đổi mô hình đang dùng.
  **Khi demo đừng bấm nút này** (mất thời gian và tạo thêm một phiên bản).

### D0.3 Từng bước `run_training` (`ml-service/app/lifecycle/train.py`)

| # | Dòng | Việc | Dữ liệu vào → ra |
|---|---|---|---|
| 1 | 76 `load_dataset()` (định nghĩa dòng 35-54) | đọc CSV, kiểm định dạng, tra điểm CPU/GPU, tính ppi, điền ô thiếu | 1.000 dòng thô → bảng 1.000 máy có 11 cột số + `segment` |
| 2 | 83 `train_test_split(...)` | **chia 800 học / 200 thử** | 1.000 → `X_train` (800), `X_test` (200) |
| 3 | 96 `grid_search(X_train, y_train)` (`classifier.py:43`) | chọn tham số, chấm trên chính 800 máy | 800 máy → bộ tham số tốt nhất và mô hình đã học |
| 4 | 104 `best_pipe.predict(X_test[...])` | **thử 200 máy chưa từng thấy** | 200 máy (bỏ nhãn) → 200 nhãn đoán |
| 5 | 110-112 | so nhãn đoán với nhãn thật của 200 máy | → macro-F1, ma trận nhầm lẫn |
| 6 | 129 `joblib.dump(best_pipe, ...)` | lưu mô hình | → `artifacts/<phiên bản>/model.joblib` |

Phần "học" thực sự nằm ở bước 3, dòng `classifier.py:50`: `search.fit(X[MODEL_A_FEATURES], y)`.
`GridSearchCV` thử 64 tổ hợp x 5 phần (mục D8, D9), rồi **học lại bộ thắng trên đủ 800 máy** và trả về `best_estimator_`.

### D0.4 "Học 800 máy" với kNN nghĩa cụ thể là gì

kNN không rút ra công thức. "Học" = **ghi nhớ**:

1. `StandardScaler` tính trung bình và độ lệch chuẩn từ 800 máy (D4).
2. Biến 800 máy thành 800 dòng số đã chuẩn hóa.
3. Cất cả 800 dòng đó cùng nhãn vào bộ nhớ. Kiểm tra trên mô hình đang dùng: `knn._fit_X.shape = (800, 11)`,
   `knn._y.shape = (800,)`, và `_fit_X` đúng bằng `prep.transform(X_train)`.

Ví dụ một "dòng ghi nhớ": `ASUS TUF Gaming 0001` (thuộc 800 máy học) được cất dưới dạng
`[-1,0031; -1,1685; -0,1218; 0,7290; 2,0038; -0,8654; 0,9716; 1,1988; 0,7616; 1; 1]` kèm nhãn **GAMING**.
Lúc dự đoán, mô hình chỉ đo khoảng cách từ máy mới tới 800 dòng như vậy (D5). Vì thế file `model.joblib` chỉ nặng 166 KB.

### D0.5 "Thử 200 máy": quy trình chấm điểm

Ví dụ **Acer Predator Helios 0051**, thuộc 200 máy giữ riêng (kiểm tra bằng code: có trong `X_test`, không có trong `X_train`):

| Bước | Việc | Kết quả |
|---|---|---|
| 1 | Bỏ nhãn thật (CREATOR), chỉ đưa 11 đặc trưng vào `predict` | mô hình chưa từng thấy máy này |
| 2 | Mô hình tìm 7 láng giềng trong 800 máy học (D5) | 3 CREATOR, 3 ULTRABOOK, 1 OFFICE |
| 3 | `predict()` chọn nhãn | **CREATOR** (hòa 3-3, `predict` lấy lớp đứng trước trong thứ tự `CREATOR, GAMING, OFFICE, ULTRABOOK`) |
| 4 | So với nhãn thật CREATOR | **đúng**, đóng góp 1 vào ô chéo CREATOR của ma trận nhầm lẫn (D10) |

Làm như vậy với cả 200 máy rồi đếm ra ma trận nhầm lẫn và macro-F1 0,7866.
**Nói thẳng:** hai đoạn code xử lý hòa phiếu khác nhau. `predict()` dùng lúc chấm điểm chọn CREATOR cho Helios,
còn `main.py:111` (API, giao diện) hiện **Mỏng nhẹ**. Chỉ xảy ra khi hòa phiếu và không đổi điểm chung nhiều, nhưng nếu
hội đồng thấy Helios hiện "Mỏng nhẹ" trong khi bạn nói mô hình đoán đúng thì đây là lý do.

### D0.6 Vì sao phải giữ riêng 200 máy

Nếu chấm bằng chính 800 máy đã học, mỗi máy sẽ tìm thấy chính nó (khoảng cách 0) và tự bỏ phiếu cho nhãn của mình, điểm
cao giả (như Demo 1 với TUF Gaming 0001). 200 máy giữ riêng đóng vai "đề thi chưa gặp bao giờ". Hai tầng kiểm tra:

| Tầng | Dùng dữ liệu nào | Để làm gì | Con số |
|---|---|---|---|
| Kiểm thử chéo 5 phần | chỉ 800 máy học, chia 640/160 | **chọn** tham số | macro-F1 0,7938 |
| Thi cuối | 200 máy giữ riêng | **báo cáo** độ tốt | macro-F1 0,7866 |

`random_state=42` nên 200 máy giữ riêng cố định miễn là `catalog_vn.csv` không đổi. Đã kiểm: mã băm (SHA-256) của CSV hiện tại,
`8f75c4cc7a44...`, **trùng** `dataset_hash` ghi trong `metadata.json` của phiên bản đang dùng, tức mô hình này được huấn luyện đúng trên file hiện tại.

### D0.7 Một điểm lệch cần biết: `golden_test.csv`

Ở lần huấn luyện đầu tiên, `train.py:87-91` lưu 200 máy giữ riêng ra `artifacts/golden_test.csv` với chú thích "đóng băng".
Kiểm tra thực tế (10/2026):
- File này có 200 dòng nhưng phân bố nhãn khác tập giữ riêng hiện tại (71/65/38/26 so với 69/67/40/24) và **chỉ 9 mã SKU còn
  trùng catalog hiện tại**, vì catalog đã được sinh lại sau ngày 27/9.
- **Không có đoạn code nào đọc file này** (tìm trong `ml-service` và `backend/src` chỉ thấy đoạn ghi file).
- Cổng khi bấm "Đưa vào sử dụng" (`models.routes.ts:63-83`) so `test.f1_macro` đã lưu của hai phiên bản, mỗi con số
  chấm trên tập giữ riêng **của lần huấn luyện đó**, chứ không phải trên `golden_test.csv`. Comment "tập test đóng băng" ở
  dòng 63-64 vì thế chưa đúng với cách chạy thật.
- **Khi trình bày:** không nói "mô hình được chấm trên tập test đóng băng". Nói "200 máy giữ riêng cố định bằng seed 42".

### D0.8 Tổng kết 30 giây

- **Một câu:** dữ liệu là 1.000 máy tổng hợp trong `catalog_vn.csv`; `train.py:83` chia 800 để học, 200 để thử; "học" của kNN là ghi nhớ
  800 máy đã chuẩn hóa vào `model.joblib`, rồi chấm trên 200 máy chưa thấy.
- **Luồng:** `generate_catalog.py` → `catalog_vn.csv` → `load_dataset` (`train.py:35`) → `train_test_split` (`:83`)
  → `grid_search` (`classifier.py:43`) → `predict` 200 máy (`:104`) → `model.joblib` (`:129`).
- **Cách đọc:** chia dữ liệu và seed là cấu hình; "học" do scikit-learn làm, không có hàm học tự viết; điểm cuối ở `metadata.json`.
- **Lưu ý:** nhãn là dữ liệu tổng hợp; `golden_test.csv` đã lệch và không được dùng.

**Tự kiểm tra bằng tay (chạy từ thư mục `ml-service`, PowerShell):**

```powershell
cd D:\QL_Laptop\ml-service
$env:PYTHONIOENCODING = "utf-8"
python -W ignore -c "import joblib; from app.lifecycle.train import ARTIFACTS_DIR; m = joblib.load(ARTIFACTS_DIR / 'clf-2026.09.27-160831' / 'model.joblib'); print(m.named_steps['knn']._fit_X.shape)"
```

Kết quả mong đợi: `(800, 11)`.

---

## D1. Trình duyệt: nút "AI gợi ý phân khúc từ cấu hình"

**(a) Trên giao diện.** Dữ liệu → Laptop → tìm `Predator Helios 0051` → **Sửa** → bấm **AI gợi ý phân khúc từ cấu hình**.
Nút này **chỉ xem trước, không lưu** (bấm Hủy là không có gì thay đổi).

**(b) Code** — `frontend/src/components/admin/SegmentSuggester.tsx`

```tsx
// dòng 39-45: kiểm tra đủ dữ liệu trước khi gọi
const requiredBase = ['cpuId', 'gpuId', 'ramGb', 'ssdGb', 'screenInch', 'weightKg'];
...
if (missingBase.length || missingResolution) {
  message.warning('Hãy nhập đủ CPU, GPU, RAM, SSD, màn hình, độ phân giải và trọng lượng trước.');
  return;
}
// dòng 48-59: gửi thông số trong form sang backend
const r = await api.post('/laptops/predict-segment', {
  cpuId: v.cpuId, gpuId: v.gpuId,          // chỉ gửi MÃ CPU/GPU, chưa phải điểm
  ramGb: v.ramGb, ssdGb: v.ssdGb, screenInch: v.screenInch, resWidth, resHeight,
  refreshHz: v.refreshHz ?? 60,            // bỏ trống -> 60 Hz
  srgb100: !!v.srgb100,
  weightKg: v.weightKg,
  batteryWh: v.batteryWh ?? 55,            // bỏ trống -> 55 Wh
});
// dòng 62-63: ô Phân khúc đang trống thì điền sẵn nhãn AI, đã chọn rồi thì không ghi đè
if (!form.getFieldValue('segment')) form.setFieldValue('segment', p.label);
```

- **[CẤU TRÚC]** `api.post(đường dẫn, dữ liệu)`; khối `try / catch / finally`.
- **[DỮ LIỆU/CẤU HÌNH]** danh sách ô bắt buộc; giá trị mặc định 60 Hz, 55 Wh.
- Dòng 62-63 giải thích Demo 2: ô Phân khúc của Helios đã có "Đồ họa – Kỹ thuật" nên không bị ghi đè, và giao diện báo
  "Bạn đang chọn phân khúc khác với AI".

**Câu mẫu:** *"Hàm `suggest` trong `SegmentSuggester.tsx` (dòng 27, lời gọi ở dòng 48) gọi sang backend `/laptops/predict-segment` để **lấy
phân khúc dự đoán**. Nó gửi **mã CPU/GPU và 9 thông số trong form**, nhận về **nhãn, xác suất 4 lớp và 7 láng giềng**."*

---

## D2. Backend: `predictSegment` gói 11 đặc trưng

**(a) Trên giao diện.** Không thấy trực tiếp; nếu CPU/GPU đã chọn không còn trong bảng benchmark, giao diện hiện thông báo "Không tìm thấy CPU/GPU đã chọn…" (dòng 66-72).

**(b) Code** — `backend/src/modules/laptops/laptops.routes.ts:258-260` nhận yêu cầu, chỉ cho STAFF/ADMIN:

```ts
laptopsRouter.post('/predict-segment', requireAuth, requireRole('STAFF', 'ADMIN'), async (req, res, next) => {
  res.json({ success: true, data: await predictSegment(req.body) });   // chỉ dự đoán, không lưu
```

`backend/src/modules/laptops/segment.service.ts:59-100`:

```ts
const [cpu, gpu] = await Promise.all([                       // 61-64: tra BẢNG BENCHMARK lấy điểm
  prisma.cpuBenchmark.findUnique({ where: { id: f.cpuId } }),
  prisma.gpuBenchmark.findUnique({ where: { id: f.gpuId } }),
]);
if (!cpu || !gpu) { throw new AppError(404, 'BENCHMARK_NOT_FOUND', ...) }   // 66-72
const r = await mlClient.post('/predict-segment', {          // 74: khớp @app.post("/predict-segment") bên main.py
  items: [{
    cpu_score: cpu.score, gpu_score: gpu.score,              // 77-78: điểm thang 0-100
    gpu_dedicated: gpu.dedicated ? 1 : 0,                    // 79: card rời -> 1
    ram_gb: f.ramGb, ssd_gb: f.ssdGb, screen_inch: f.screenInch,
    ppi: computePpi(f.resWidth, f.resHeight, f.screenInch),  // 83: mật độ điểm ảnh (Pytago)
    refresh_hz: f.refreshHz ?? 60,
    srgb_100: f.srgb100 ? 1 : 0,
    weight_kg: f.weightKg,
    battery_wh: f.batteryWh ?? 55,
  }],
});
const item = r.data.items[0];                                // 92: gửi 1 máy nên lấy phần tử đầu
```

**(c) Tính từng bước: ppi của Helios 0051** (`laptops.service.ts:10-11`: `Math.sqrt(w² + h²) / inch`)

| Bước | Phép tính | Kết quả |
|---|---|---|
| Đầu vào | độ phân giải 2560 x 1600, màn 13,6" (cột Rộng/Cao/Màn hình trên trang Laptop) | |
| 1 | 2560² = 2560 x 2560 | 6.553.600 |
| 2 | 1600² = 1600 x 1600 | 2.560.000 |
| 3 | cộng | 9.113.600 |
| 4 | √9.113.600 (đường chéo tính bằng điểm ảnh) | 3.018,87 |
| 5 | 3.018,87 ÷ 13,6 | **221,976** |

Bảng 11 đặc trưng backend gửi đi cho Helios 0051:

| ram_gb | ssd_gb | cpu_score | gpu_score | screen_inch | ppi | refresh_hz | weight_kg | battery_wh | gpu_dedicated | srgb_100 |
|---|---|---|---|---|---|---|---|---|---|---|
| 32 | 512 | 42,4324 | 16,6667 | 13,6 | 221,976 | 120 | 1,74 | 55 | 1 | 1 |

**Lưu ý nói thẳng:** khi bỏ trống pin, backend điền 55 Wh, còn lúc huấn luyện pin thiếu được điền bằng trung vị cùng phân khúc
(`features.py:147-149`). Hai cách điền khác nhau; ảnh hưởng nhỏ vì pin chỉ là 1 trong 11 cột.

**(d) Tổng kết 30 giây.** Backend đổi mã CPU/GPU thành điểm, tính ppi, gói đủ 11 đặc trưng rồi gọi ML.
`SegmentSuggester.tsx:48 -> laptops.routes.ts:258 -> segment.service.ts:74 -> main.py:88`.

---

## D3. ML: `predict_segment` từng dòng

**(a) Trên giao diện.** Kết quả của hàm này chính là khối "Dự đoán: …", 4 dòng phần trăm và 7 dòng "#n · khoảng cách".

**(b) Code** — `ml-service/app/main.py:88-122`

| Dòng | Code | Làm gì |
|---|---|---|
| 88 | `@app.post("/predict-segment")` | **[CẤU TRÚC]** gắn hàm vào đường dẫn; phải khớp chữ với `mlClient.post` của backend |
| 91-92 | `if registry.model is None: raise HTTPException(503, ...)` | chưa nạp mô hình thì báo lỗi rõ |
| 93 | `X = pd.DataFrame(req.items)` | biến JSON thành bảng: 1 máy = 1 hàng, 11 cột |
| 95-97 | `for col in MODEL_A_FEATURES: ... X[col] = 0` | lưới an toàn nếu thiếu cột |
| 98 | `proba = registry.model.predict_proba(X[MODEL_A_FEATURES])` | **dòng chính:** chuẩn hóa → 7 láng giềng → tỷ lệ phiếu (D4–D6) |
| 99 | `labels = registry.model.classes_` | thứ tự 4 nhãn: `CREATOR, GAMING, OFFICE, ULTRABOOK` (theo bảng chữ cái) |
| 103-104 | `prep = ...["prep"]`, `knn = ...["knn"]` | tách Pipeline thành 2 bước để lấy riêng láng giềng |
| 105 | `knn.kneighbors(prep.transform(...))` | trả **7 khoảng cách** và **vị trí** 7 máy trong 800 máy học |
| 106 | `train_labels = knn.classes_[knn._y]` | đổi nhãn đã mã hóa (0,1,2,3) về tên nhãn |
| 111 | `order = np.argsort(row_proba)[::-1]` | sắp xác suất giảm dần |
| 113-114 | `"label": labels[order[0]]`, `"proba": ...` | nhãn đứng đầu và độ tin cậy của nó |
| 116 | `"distribution": {...}` | 4 phần trăm hiện trên giao diện |
| 117-120 | `"neighbors": [...]` | 7 dòng "#n · khoảng cách" (làm tròn 4 chữ số; giao diện làm tròn 2) |
| 122 | `return {"items": results, "modelVersion": registry.version}` | trả về backend |

**(c) Vì sao hòa 3-3 lại hiện "Mỏng nhẹ"? (dòng 111)**

| Bước | Giá trị |
|---|---|
| `row_proba` theo thứ tự `classes_` [CREATOR, GAMING, OFFICE, ULTRABOOK] | [0,4286; 0; 0,1429; 0,4286] |
| `np.argsort` sắp tăng dần (trả vị trí) | GAMING, OFFICE, CREATOR, ULTRABOOK |
| `[::-1]` đảo ngược thành giảm dần | ULTRABOOK, CREATOR, OFFICE, GAMING |
| `labels[order[0]]` | **ULTRABOOK** (= "Mỏng nhẹ – Di động") |

CREATOR và ULTRABOOK bằng nhau 0,4286; ai đứng đầu chỉ do cách sắp xếp xử lý hai số bằng nhau
(còn `predict()` dùng lúc chấm điểm lại chọn CREATOR cho cùng máy này, xem mục D0.5). Vì thế khi hòa,
**nhãn hiển thị không có ý nghĩa**; điều quan trọng là độ tin cậy 43% < 60% nên máy phải được người xác minh.

**(d) Tổng kết 30 giây.** `predict_segment` nhận 11 số, gọi `predict_proba` (dòng 98) để lấy tỷ lệ phiếu, gọi
`kneighbors` (dòng 105) để lấy 7 máy đã bỏ phiếu, rồi trả nhãn cao nhất. **Câu mẫu:** *"Hàm A `predictSegment`
(`segment.service.ts:74`) gọi hàm B `predict_segment` (`main.py:88`) để lấy phân khúc. B nhận 11 đặc trưng, xử lý qua
dòng 98 (chuẩn hóa, 7 láng giềng, đếm phiếu) và dòng 105 (lấy danh sách láng giềng), rồi trả nhãn, xác suất và 7 khoảng cách
cho A."*

---

## D4. Bên trong `predict_proba` (1): chuẩn hóa log2 + z-score

**(a) Trên giao diện.** Không hiện; nhưng nếu thiếu bước này, khoảng cách hiện trên giao diện sẽ bị cột ppi (số hàng trăm)
"nuốt" hết các cột khác.

**(b) Code** — `ml-service/app/data/features.py:195-214`

```python
("log", Pipeline([
    ("impute", SimpleImputer(strategy="median")),                          # ô trống -> trung vị
    ("log", FunctionTransformer(np.log2, feature_names_out="one-to-one")), # 32 -> 5, 512 -> 9
    ("sc", StandardScaler()),                                              # (x - TB) / ĐLC
]), NUMERIC_LOG),
("num", Pipeline([("impute", ...), ("sc", StandardScaler())]), NUMERIC),
("bin", "passthrough", BINARY),                                            # 0/1 giữ nguyên
```

Lúc dự đoán, `StandardScaler` **không tính lại** trung bình/độ lệch chuẩn; nó dùng số đã học trên 800 máy, lưu trong
`model.joblib`.

**(c) Tính từng bước cho Helios 0051.** Công thức `z = (giá trị − TB) ÷ ĐLC`. TB, ĐLC lấy từ `model.joblib`; đã tính lại
độc lập trên 800 máy học (độ lệch chuẩn kiểu "chia n", tức Excel `STDEV.P`) và khớp đến 4 chữ số.

| Cột | Giá trị | Sau log2 | TB | ĐLC | Thay số | z |
|---|---|---|---|---|---|---|
| ram_gb | 32 | 5 (vì 2⁵ = 32) | 3,7938 | 0,7913 | (5 − 3,7938) ÷ 0,7913 = 1,2062 ÷ 0,7913 | **1,5243** |
| ssd_gb | 512 | 9 (vì 2⁹ = 512) | 8,9125 | 0,7809 | (9 − 8,9125) ÷ 0,7809 = 0,0875 ÷ 0,7809 | **0,1120** |
| cpu_score | 42,4324 | | 48,9933 | 20,5806 | (42,4324 − 48,9933) ÷ 20,5806 = −6,5609 ÷ 20,5806 | **−0,3188** |
| gpu_score | 16,6667 | | 30,9521 | 28,9868 | (16,6667 − 30,9521) ÷ 28,9868 = −14,2854 ÷ 28,9868 | **−0,4928** |
| screen_inch | 13,6 | | 15,3732 | 0,9616 | (13,6 − 15,3732) ÷ 0,9616 = −1,7732 ÷ 0,9616 | **−1,8442** |
| ppi | 221,976 | | 156,7983 | 34,0465 | (221,976 − 156,7983) ÷ 34,0465 = 65,1777 ÷ 34,0465 | **1,9144** |
| refresh_hz | 120 | | 98,7750 | 46,5490 | (120 − 98,775) ÷ 46,549 = 21,225 ÷ 46,549 | **0,4560** |
| weight_kg | 1,74 | | 1,8325 | 0,5652 | (1,74 − 1,8325) ÷ 0,5652 = −0,0925 ÷ 0,5652 | **−0,1636** |
| battery_wh | 55 | | 58,8963 | 14,5795 | (55 − 58,8963) ÷ 14,5795 = −3,8963 ÷ 14,5795 | **−0,2672** |
| gpu_dedicated | 1 | | | | giữ nguyên | **1** |
| srgb_100 | 1 | | | | giữ nguyên | **1** |

**Cách đọc z:** z = 1,9144 ở ppi nghĩa là màn Helios nét hơn trung bình gần 2 "độ lệch chuẩn"; z = −1,8442 ở màn hình
nghĩa là nhỏ hơn hẳn trung bình (13,6" so với 15,37"). Sau bước này mọi cột cùng một thước đo.

**Tự kiểm tra:** lệnh xem TB/ĐLC ở docs/17; trong Excel, `=AVERAGE(...)` và `=STDEV.P(...)` trên cột tương ứng của 800 máy
học (RAM, SSD lấy `=LOG(x;2)` trước).

**(d) Tổng kết 30 giây.** RAM/SSD lấy log2 rồi chuẩn hóa, 7 cột số chuẩn hóa thẳng, 2 cột 0/1 giữ nguyên. Thước đo lấy từ
800 máy học, không tính lại lúc dự đoán.

---

## D5. Bên trong `predict_proba` (2): đo khoảng cách, lấy 7 máy gần nhất

**(a) Trên giao diện.** 7 dòng `#1 · khoảng cách 1.80` … `#7 · khoảng cách 2.29` ở Demo 2.

**(b) Code.** Không có hàm tự viết; `KNeighborsClassifier` (khai báo ở `classifier.py:39`) với `metric="euclidean"`,
`n_neighbors=7` đã chọn lúc huấn luyện. Nó so máy mới với **cả 800 máy** đã ghi nhớ (đã kiểm: `knn._fit_X` đúng bằng 800 máy
học sau chuẩn hóa).

**(c) Tính từng bước: khoảng cách Helios 0051 → láng giềng #1 Gigabyte G5 0276** (z của máy #1 xem docs/15 mục 1.13)

| Cột | z Helios | z Gigabyte | Hiệu | Hiệu² |
|---|---|---|---|---|
| ram_gb | 1,5243 | 0,2606 | 1,2637 | 1,5969 |
| ssd_gb | 0,1120 | 0,1120 | 0 | 0 |
| cpu_score | −0,3188 | −0,4370 | 0,1182 | 0,0140 |
| gpu_score | −0,4928 | −0,1335 | −0,3594 | 0,1291 |
| screen_inch | −1,8442 | −2,1561 | 0,3120 | 0,0973 |
| ppi | 1,9144 | 2,8948 | −0,9804 | 0,9612 |
| refresh_hz | 0,4560 | 0,4560 | 0 | 0 |
| weight_kg | −0,1636 | 0,4556 | −0,6193 | 0,3835 |
| battery_wh | −0,2672 | −0,0615 | −0,2058 | 0,0423 |
| gpu_dedicated | 1 | 1 | 0 | 0 |
| srgb_100 | 1 | 1 | 0 | 0 |
| | | | **Tổng** | **3,2244** |

Euclidean = √3,2244 = **1,7957** (giao diện làm tròn **1.80**). Nếu dùng Manhattan thì cộng trị tuyệt đối của cột Hiệu:
1,2637 + 0,1182 + 0,3594 + 0,3120 + 0,9804 + 0,6193 + 0,2058 = **3,8588**. Hai cách cho số khác nhau, nhưng thứ tự gần/xa
thường giống nhau, nên điểm cuối cùng tương đương (Phần 1 mục 4).

Làm như vậy với cả 800 máy, giữ 7 số nhỏ nhất:

| # | Máy | Nhãn | Khoảng cách | Giao diện hiện |
|---|---|---|---|---|
| 1 | Gigabyte G5 0276 | CREATOR | 1,7957 | 1.80 |
| 2 | Dell G15 0228 | CREATOR | 2,0203 | 2.02 |
| 3 | Apple MacBook Pro 0645 | CREATOR | 2,1111 | 2.11 |
| 4 | HP ProBook 0390 | OFFICE | 2,1276 | 2.13 |
| 5 | Huawei MateBook X 0557 | ULTRABOOK | 2,1909 | 2.19 |
| 6 | Avita Liber 0426 | ULTRABOOK | 2,1944 | 2.19 |
| 7 | Apple MacBook Air 0140 | ULTRABOOK | 2,2928 | 2.29 |

**So với Demo 1 (TUF Gaming 0001):** láng giềng #1 có khoảng cách **0,00** vì TUF 0001 **nằm trong 800 máy học**, nên nó tìm
thấy chính nó và tự bỏ một phiếu. Kết quả "100%" vì thế hơi dễ. Muốn demo công bằng thì dùng máy thuộc 200 máy giữ riêng
như Helios 0051. (Láng giềng #4 của TUF là "LG Gram Pro 0094" mang nhãn GAMING, cho thấy dữ liệu tổng hợp có chỗ chưa tự nhiên.)

**(d) Tổng kết 30 giây.** Mỗi máy mới được đo khoảng cách Pytago 11 chiều tới 800 máy, giữ 7 máy gần nhất. RAM, ppi và
cân nặng đóng góp nhiều nhất cho khoảng cách 1,7957 (49,5%, 29,8%, 11,9% tổng).

---

## D6. Bên trong `predict_proba` (3): đếm phiếu ra xác suất

**(a) Trên giao diện.** "Văn phòng 14% / Mỏng nhẹ 43% / Gaming 0% / Đồ họa 43%", nhãn **Cần xác minh**.

**(b) Code.** `weights="uniform"` (chọn lúc huấn luyện, `classifier.py:30`): mỗi láng giềng 1 phiếu, xác suất = số phiếu ÷ 7.

**(c) Tính từng bước**

| Nhãn | Láng giềng | Số phiếu | Phép tính | Xác suất | Giao diện |
|---|---|---|---|---|---|
| CREATOR (Đồ họa) | #1, #2, #3 | 3 | 3 ÷ 7 | 0,4286 | 43% |
| ULTRABOOK (Mỏng nhẹ) | #5, #6, #7 | 3 | 3 ÷ 7 | 0,4286 | 43% |
| OFFICE (Văn phòng) | #4 | 1 | 1 ÷ 7 | 0,1429 | 14% |
| GAMING | | 0 | 0 ÷ 7 | 0 | 0% |
| | | **7** | | **1,0000** | |

**Đối chiếu: nếu dùng `distance` (phiếu nặng = 1 ÷ khoảng cách)**

| Nhãn | Cộng 1 ÷ khoảng cách | Tổng | Tỷ lệ |
|---|---|---|---|
| CREATOR | 1÷1,7957 + 1÷2,0203 + 1÷2,1111 = 0,5569 + 0,4950 + 0,4737 | 1,5256 | 1,5256 ÷ 3,3438 = **0,4562** |
| ULTRABOOK | 1÷2,1909 + 1÷2,1944 + 1÷2,2928 = 0,4564 + 0,4557 + 0,4361 | 1,3482 | 1,3482 ÷ 3,3438 = 0,4032 |
| OFFICE | 1÷2,1276 | 0,4700 | 0,4700 ÷ 3,3438 = 0,1406 |
| | | **3,3438** | |

Với `distance`, Helios sẽ được đoán đúng CREATOR (vì 3 máy CREATOR gần hơn), nhưng 0,4562 vẫn dưới 0,6 nên vẫn vào hàng đợi.
Trên toàn bộ 800 máy, `distance` được 0,7920 còn `uniform` được 0,7938 (mục D9), nên hệ thống giữ `uniform`.
**Một ví dụ không quyết định cách nào tốt hơn; điểm trung bình trên nhiều máy mới quyết định.**

**Tự kiểm tra ngưỡng:** 5 ÷ 7 = 0,714 ≥ 0,6 (qua); 4 ÷ 7 = 0,571 < 0,6 (không qua). Vậy với `uniform`, k = 7, máy cần
**từ 5/7 phiếu** mới được tự duyệt.

**(d) Tổng kết 30 giây.** 7 láng giềng mỗi máy 1 phiếu, xác suất là số phiếu chia 7. Helios hòa 3-3 nên chỉ 43%.

---

## D6b. Icon "!" trên giao diện: giải thích toán học ngay tại chỗ khi thầy hỏi

Sau khi bấm **AI gợi ý phân khúc từ cấu hình**, mỗi láng giềng `#1 … #7` có một icon **"!"** và sau `#7` có nút **"! Chi tiết"**.
Bấm vào là ra bảng toán học, không cần mở Excel hay terminal. Số trong bảng là số **thật của mô hình đang dùng**, và đã đối chiếu
với phần tính tay ở D4–D6 (ví dụ Helios 0051: tổng hiệu² = 3,2244; khoảng cách = 1,7957; 3 ÷ 7 = 0,4286).

**(a) Thao tác:** Dữ liệu → Laptop → tìm `Predator Helios 0051` → **Sửa** → **AI gợi ý phân khúc từ cấu hình** →
- bấm **"!"** cạnh `#1 · khoảng cách 1.80`: cửa sổ **"Vì sao máy #1 cách 1.80?"**
  - *Bước 1:* bảng đổi 11 thông số của máy đang nhập sang z-score, mỗi dòng có phép tính `(x − TB) ÷ ĐLC = z`;
  - *Bước 2:* bảng so với máy #1: giá trị gốc hai máy, z hai máy, hiệu, hiệu², % của tổng, dòng **Tổng hiệu² = 3.2244**;
  - kết luận **Khoảng cách = √3.2244 = 1.7957**.
- bấm **"! Chi tiết"** (sau `#7`): cửa sổ **"Vì sao độ tin cậy là 43%?"**, gồm **5 bước đi từ đầu đến cuối**
  - *Bước 1:* chuẩn hóa 11 thông số của máy đang nhập (cùng bảng z-score ở trên);
  - *Bước 2:* đo khoảng cách tới 800 máy đã ghi nhớ, giữ 7 máy gần nhất: bảng 7 máy với **tổng hiệu² của 11 cột**, **khoảng cách = √ tổng**, và cột "Hệ thống trả về" để đối chiếu;
  - *Bước 3:* mỗi láng giềng bỏ phiếu (nhãn, khoảng cách, 1 phiếu mỗi máy);
  - *Bước 4:* đếm phiếu `3 ÷ 7 = 0.4286` cho từng phân khúc (khớp xác suất hệ thống trả về);
  - *Bước 5:* so với ngưỡng 60% (cần ít nhất 5/7 phiếu), kết luận "43% < 60%: vào hàng đợi Cần xác minh", kèm ghi chú nếu hòa phiếu.
  - Nếu láng giềng #1 cách 0.0000 (máy đang xét đã nằm trong 800 máy học, ví dụ `Avita Pura 0874` ra 100%) thì có thêm dòng lưu ý
    "máy này tự bỏ một phiếu cho chính mình".
- Đóng bằng dấu X; **Hủy** để không lưu gì.

**(b) Code**

| Việc | File và dòng |
|---|---|
| Icon "!" trên từng chip, nút "Chi tiết", mở cửa sổ | `frontend/src/components/admin/SegmentSuggester.tsx:105-133` (state ở dòng 28) |
| Hai cửa sổ toán học (bảng z-score, bảng hiệu, bảng khoảng cách tới 7 máy, đếm phiếu, so ngưỡng) | `frontend/src/components/admin/SegmentMathModal.tsx` (`NeighborMath` dòng 79, `ZScoreTable` dòng 191, `VoteMath` dòng 242) |
| ML trả thêm số liệu giải thích cho mỗi máy: trung bình, độ lệch chuẩn, z của máy đang xét, z và giá trị gốc của 7 láng giềng | `ml-service/app/models/segment_explain.py` (`build_explain`); gắn vào kết quả ở `ml-service/app/main.py:124` |
| Backend chỉ chuyển tiếp trường `explain` | `backend/src/modules/laptops/segment.service.ts:50, 101` |
| Test: cộng hiệu² rồi lấy căn phải ra đúng khoảng cách của kNN | `ml-service/tests/test_segment_explain.py` |

**Lỗi giao diện đã sửa cùng lúc (bảng Laptop):** cột Phân khúc và cột Sửa/Xóa trước đây bị bóp (chữ bị bẻ từng chữ, hai nút chồng lên nhau)
vì 18 cột được chia đều chiều rộng. Nay mỗi cột có độ rộng riêng (`AdminLaptops.tsx`, hằng `COLUMN_WIDTH`; `CrudTable.tsx`, trường
`tableWidth` và `scroll={{ x: 'max-content' }}`); bảng cuộn ngang được và cột Hành động cố định bên phải.

**Câu mẫu:** *"Hàm `build_explain` (`segment_explain.py`) được `predict_segment` (`main.py:124`) gọi để lấy số liệu giải thích. Nó nhận
pipeline đã huấn luyện, dòng 11 đặc trưng của máy và vị trí 7 láng giềng, rồi trả trung bình, độ lệch chuẩn, z của máy đang xét và
z của 7 láng giềng. Giao diện (`SegmentMathModal.tsx`) dùng đúng các số đó để dựng bảng."*

**(c) Khi thầy hỏi "43% ở đâu ra?", nói theo thứ tự này:**
1. Bấm "! Chi tiết": "Mô hình lấy 7 máy giống nhất rồi mỗi máy bỏ 1 phiếu."
2. Chỉ bảng Bước 2: "3 máy Đồ họa, 3 máy Mỏng nhẹ, 1 máy Văn phòng; 3 chia 7 bằng 0,4286, tức 43%."
3. Chỉ Bước 3: "43% thấp hơn ngưỡng 60% nên máy này cần người xác minh." Muốn đi sâu hơn thì đóng cửa sổ, bấm "!" cạnh `#1` để chỉ ra
   cách ra khoảng cách 1,80.

**(d) Lưu ý trung thực**
- Cửa sổ so với ngưỡng **mặc định 60%** (cố định trong `SegmentMathModal.tsx:38`), không đọc cấu hình đã đổi (cùng điểm lệch ở D7b).
- Bảng chỉ có giá trị gốc của **máy đang nhập** và **giá trị gốc đã quy ngược** của láng giềng; không có tên láng giềng vì mô hình chỉ ghi
  nhớ số, không ghi tên máy (D0.4).
- Nếu ML là bản cũ chưa trả `explain` thì icon và nút không hiện.
- Kích hoạt mô hình khác: nếu mô hình đang dùng chọn `distance` hoặc `manhattan`, bảng tự đổi công thức (1 ÷ khoảng cách; |hiệu|).
  Phần này đã viết theo code nhưng **chưa thử trên giao diện** vì mô hình hiện tại là `uniform` + `euclidean`.

---

## D7. Khi bấm Lưu: `applySegmentLabel` quyết định VERIFIED hay NEEDS_REVIEW

**(a) Trên giao diện.** Demo 3 (thêm máy, để trống Phân khúc, bấm **Lưu**). Nếu độ tin cậy thấp, thông báo có dạng
"AI chỉ tin cậy 43% (dưới ngưỡng 60%) — đã gán tạm … và đưa vào hàng đợi cần xác minh." Demo này ghi vào DB: **xóa máy thử sau đó**.

**(b) Code** — `backend/src/modules/laptops/segment.service.ts:106-160`

| Dòng | Code | Làm gì |
|---|---|---|
| 112-116 | `if (existing?.locked && !requested) return ...` | nhãn đã **khóa** và người không chọn lại → giữ nguyên, không hỏi AI |
| 119-124 | `try { prediction = await predictSegment(features) } catch { logger.warn(...) }` | ML lỗi vẫn lưu được laptop (không trả lỗi 500) |
| 126-133 | `if (!requested && !prediction) return { warning: ... }` | không chọn và AI lỗi → báo máy sẽ chưa được gợi ý |
| 135 | `const threshold = await getConfidenceThreshold()` | đọc ngưỡng từ bảng cấu hình tri thức, mặc định 0,6 (dòng 25, 52-56) |
| 136 | `const segment = requested ?? prediction.label` | người chọn thì dùng nhãn người, không thì dùng nhãn AI |
| 137 | `const source = ...` | ghi ai quyết định: `MODEL` hay `ADMIN` |
| 138 | `const status = ...` | **dòng chính:** so độ tin cậy với ngưỡng |
| 149-153 | `prisma.segmentLabel.upsert(...)` | có nhãn rồi thì sửa, chưa có thì tạo |
| 155-158 | `warning = ... Math.round(prediction.proba * 100) ...` | câu cảnh báo hiện trên giao diện |

**(c) Bảng các trường hợp của dòng 137-138**

| Người dùng chọn ô Phân khúc? | AI đoán | Độ tin cậy | `segment` | `source` | `status` |
|---|---|---|---|---|---|
| Không | GAMING | 1,0000 (7/7) | GAMING | MODEL | VERIFIED (1,0 ≥ 0,6) |
| Không | ULTRABOOK (hòa) | 0,4286 (3/7) | ULTRABOOK | MODEL | **NEEDS_REVIEW** (0,4286 < 0,6) |
| Có, chọn CREATOR | ULTRABOOK | 0,4286 | CREATOR | ADMIN (khác AI) | VERIFIED (người đã quyết) |
| Có, chọn GAMING | GAMING | 1,0000 | GAMING | MODEL (trùng AI) | VERIFIED |

Câu cảnh báo cho dòng thứ hai: `Math.round(0,4286 x 100)` = `Math.round(42,86)` = **43** → "AI chỉ tin cậy 43% (dưới ngưỡng 60%)".

**(d) Tổng kết 30 giây.** Lưu laptop luôn kết thúc bằng một nhãn. Người chọn thì nhãn người thắng. Người không chọn thì
nhãn AI, tự duyệt nếu từ 0,6 trở lên, ngược lại vào hàng đợi. Nhãn đã khóa thì AI không được đổi.

---

## D7b. Đổi ngưỡng 0,6 thành giá trị khác: hệ thống xử lý thế nào

**(a) Trên giao diện.** **Trí tuệ → Cấu hình tri thức**, kéo slider "Ngưỡng tin cậy để tự động duyệt nhãn phân khúc" (30% đến 95%,
bước 5%), bấm **Lưu** → thông báo "Đã lưu cấu hình." (`AdminKnowledge.tsx:320-326`, hàm `save` dòng 300-312).

**(b) Code.** Giao diện ghi `saveConfig('confidence_threshold', giá trị)` (`AdminKnowledge.tsx:304`) vào bảng `KnowledgeConfig`.
Backend đọc lại **mỗi lần gán nhãn**, không cần khởi động lại:

```ts
// segment.service.ts:52-56 và 135, 138
const row = await prisma.knowledgeConfig.findUnique({ where: { key: 'confidence_threshold' } });
const threshold = await getConfidenceThreshold();                  // chưa cấu hình thì dùng mặc định 0,6 (dòng 25)
const status = ... prediction!.proba >= threshold ? 'VERIFIED' : 'NEEDS_REVIEW';
```

**(c) Ba điều cần nhớ khi nói về chuyện đổi ngưỡng:**

1. **Không áp dụng cho máy đã có nhãn.** `status` được lưu vào DB lúc gán nhãn; hàng đợi chỉ lọc theo cột này
   (`labels.routes.ts:24`, `where: { status: 'NEEDS_REVIEW' }`). Đổi ngưỡng không kéo máy cũ vào hàng đợi và không đẩy máy cũ ra.
   Chỉ các máy được gán nhãn **sau khi lưu** mới chịu ngưỡng mới.
2. **Với k = 7 và `uniform`, xác suất chỉ là bội số của 1/7**, nên nhiều mức ngưỡng cho kết quả y hệt nhau:

   | Số phiếu | 3/7 | 4/7 | 5/7 | 6/7 | 7/7 |
   |---|---|---|---|---|---|
   | Xác suất | 0,429 | 0,571 | 0,714 | 0,857 | 1,000 |

   Mọi ngưỡng trong khoảng **0,58 đến 0,71** đều tương đương (cần ít nhất 5/7). Đổi 0,6 thành 0,7 **không đổi kết quả** nào.
   Từ **0,75 đến 0,85** cần ít nhất 6/7; từ **0,90** trở lên cần 7/7.
3. **Giao diện vẫn cố định 0,6 ở hai chỗ, không đọc cấu hình:**
   - cảnh báo "Hệ thống chưa chắc chắn" ở nút AI (`SegmentSuggester.tsx:118`, `pred.proba < 0.6`);
   - nhãn "Cần xác minh" trên thanh xác suất (`ConfidenceIndicator.tsx:13`, mặc định `threshold = 0.6`; hai nơi gọi
     `SegmentSuggester.tsx:84` và `AdminReviewQueue.tsx:120` đều không truyền ngưỡng).

   Cảnh báo tự động `LOW_CONFIDENCE_RATE` cũng dùng 0,6 cố định (`alertScan.ts:139`). Hệ quả: đặt ngưỡng 0,8 thì máy 5/7 phiếu
   vào hàng đợi (backend), nhưng nút AI vẫn không hiện cảnh báo vì 0,714 > 0,6.

**Cách tự thử không phá dữ liệu:** kéo slider lên 90% rồi Lưu → vào **Dữ liệu → Duyệt nhãn**, số máy chờ vẫn là 6 (điểm 1).
Muốn thấy ngưỡng tác động thật thì thêm một máy mới, để trống Phân khúc, Lưu; máy 5/7 phiếu giờ vào hàng đợi. **Xóa máy thử và
đặt lại slider về 60%** sau khi demo.

**(d) Tổng kết 30 giây.** Ngưỡng đọc từ `KnowledgeConfig` mỗi lần gán nhãn; chỉ ảnh hưởng máy gán nhãn từ sau khi lưu; với k = 7
phải đặt từ 0,75 trở lên mới đổi được kết quả; giao diện còn hai chỗ cố định 0,6.
Luồng: `AdminKnowledge.tsx:326` → `saveConfig` (dòng 304) → `KnowledgeConfig` → `segment.service.ts:52` → so ở dòng 138
→ `status` lưu DB → hàng đợi lọc theo `status` (`labels.routes.ts:24`).

---

## D8. Huấn luyện (1): chia 800 / 200 và chia 5 phần

**(a) Trên giao diện.** Trí tuệ → **Quản lý mô hình**: 2 dòng `clf-2026.10.04-124455` (Dự phòng, 78,7%) và
`clf-2026.09.27-160831` (**Đang sử dụng**, 78,7%, 1000 mẫu). Cột "macro-F1 (test)" 78,7% chính là 0,7866 làm tròn.
**Không bấm** "Huấn luyện mô hình mới" khi demo (tạo thêm một phiên bản).

**(b) Code** — `ml-service/app/lifecycle/train.py:83-85` và `classifier.py:46`

```python
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, stratify=y, random_state=RANDOM_STATE)    # 20% giữ riêng; giữ tỷ lệ 4 lớp; seed 42
cv = StratifiedKFold(5, shuffle=True, random_state=RANDOM_STATE)   # chia 800 máy học thành 5 phần
```

**(c) Tính từng bước: `stratify` giữ tỷ lệ**

| Lớp | Cả 1.000 | x 0,8 | Tập học (800) | Tập giữ riêng (200) | Tỷ lệ trong 200 |
|---|---|---|---|---|---|
| OFFICE | 344 | 275,2 | 275 | 69 | 34,5% |
| GAMING | 335 | 268,0 | 268 | 67 | 33,5% |
| ULTRABOOK | 201 | 160,8 | 161 | 40 | 20,0% |
| CREATOR | 120 | 96,0 | 96 | 24 | 12,0% |
| Tổng | 1.000 | | 800 | 200 | |

**5 phần của 800 máy** (mỗi lần: học 640, kiểm tra 160)

| Lần | Học | Kiểm tra | Kiểm tra gồm OFFICE / GAMING / ULTRABOOK / CREATOR |
|---|---|---|---|
| 1 | 640 | 160 | 55 / 54 / 32 / 19 |
| 2 | 640 | 160 | 55 / 54 / 32 / 19 |
| 3 | 640 | 160 | 55 / 54 / 32 / 19 |
| 4 | 640 | 160 | 55 / 53 / 33 / 19 |
| 5 | 640 | 160 | 55 / 53 / 32 / 20 |

Mỗi máy trong 800 máy được làm "bài kiểm tra" đúng 1 lần và làm "tài liệu học" 4 lần. 200 máy giữ riêng **không tham gia** 5 phần này.

**CV (Cross-Validation, kiểm thử chéo) là gì?** Chính là cách làm ở bảng trên: chia dữ liệu học thành 5 phần, lần lượt lấy 1 phần
làm đề thi, 4 phần còn lại để học, lặp 5 lần rồi lấy điểm trung bình. "Chéo" nghĩa là các phần luân phiên đổi vai.
Ví dụ bộ tham số thắng (k = 7, uniform, euclidean) được 5 điểm 0,7714; 0,8409; 0,7703; 0,8542; 0,7321, trung bình **0,7938**
(`cv_f1_macro_mean` trong `metadata.json`).

**Vì sao chuẩn hóa phải nằm TRONG Pipeline?** Ở mỗi lần, 160 máy "đề thi" phải hoàn toàn lạ với mô hình. Nếu tính trung bình và
độ lệch chuẩn trên cả 800 máy trước khi chia 5 phần thì 160 máy đề thi đã góp vào con số chuẩn hóa ("nhìn lén đề"). Đặt trong
Pipeline thì mỗi lần chỉ tính từ 640 máy học của lần đó. Đã đo: chuẩn hóa ngoài Pipeline làm điểm lệch rất nhỏ (0,7938 so với
0,7923); vẫn làm đúng cách và có test chặn (`test_scaler_inside_pipeline`).

| | CV 5 phần | Thi cuối 200 máy |
|---|---|---|
| Dữ liệu | chỉ 800 máy học | 200 máy giữ riêng |
| Mục đích | **chọn** tham số | **báo cáo** độ tốt |
| Điểm | 0,7938 | 0,7866 |

**(d) Tổng kết 30 giây.** Giữ riêng 200 máy để chấm cuối; 800 máy còn lại chia 5 phần để chọn tham số. Cả hai lần chia
đều giữ tỷ lệ 4 phân khúc và cố định seed 42.

---

## D9. Huấn luyện (2): `grid_search` thử 64 tổ hợp, tính điểm trung bình

**(b) Code** — `classifier.py:43-51`

```python
pipe = build_pipeline()                                       # 45: chuẩn hóa + kNN (chuẩn hóa nằm TRONG pipeline)
search = GridSearchCV(pipe, PARAM_GRID, cv=cv, scoring="f1_macro", n_jobs=-1, return_train_score=True)
search.fit(X[MODEL_A_FEATURES], y)                            # 50: 64 x 5 = 320 lần học, rồi học lại bộ thắng trên 800 máy
```

- `scoring="f1_macro"`: chấm mỗi lần bằng macro-F1 (cách tính ở D10).
- `n_jobs=-1`: chạy song song trên mọi nhân CPU cho nhanh.
- Sau 320 lần, GridSearch **học lại** bộ thắng trên đủ 800 máy; đó là `best_estimator_` được lưu thành `model.joblib`
  (`train.py:97, 129`).

**(c) Tính từng bước: điểm 0,7938 của bộ thắng (k = 7, uniform, euclidean)**

| Lần | 1 | 2 | 3 | 4 | 5 |
|---|---|---|---|---|---|
| macro-F1 trên 160 máy kiểm tra | 0,7714 | 0,8409 | 0,7703 | 0,8542 | 0,7321 |

- Trung bình: (0,7714 + 0,8409 + 0,7703 + 0,8542 + 0,7321) ÷ 5 = 3,9689 ÷ 5 = **0,7938**
- Độ lệch từng lần so với 0,7938: −0,0224; +0,0471; −0,0235; +0,0604; −0,0617
- Bình phương: 0,000501; 0,002220; 0,000551; 0,003651; 0,003804 → cộng = 0,010727 → ÷ 5 = 0,002145
- Độ lệch chuẩn = √0,002145 = **0,0463** (khớp `cv_f1_macro_std` trong `metadata.json`)

Cùng một bộ tham số mà 5 lần chấm dao động từ 0,73 đến 0,85. Vì thế các chênh lệch dưới khoảng 0,03–0,05 giữa các tổ hợp
không nên coi là "hơn hẳn".

**8 tổ hợp đứng đầu** (trong 64, chạy lại hôm nay, khớp `metadata.json`):

| Hạng | k | weights | metric | macro-F1 TB | ĐLC |
|---|---|---|---|---|---|
| 1 | 7 | uniform | euclidean | **0,7938** | 0,0463 |
| 2 | 7 | distance | euclidean | 0,7920 | 0,0374 |
| 3 | 7 | uniform | manhattan | 0,7855 | 0,0273 |
| 4 | 9 | distance | euclidean | 0,7854 | 0,0311 |
| 5 | 9 | distance | manhattan | 0,7852 | 0,0294 |
| 6 | 9 | uniform | euclidean | 0,7844 | 0,0289 |
| 7 | 11 | distance | manhattan | 0,7840 | 0,0411 |
| 8 | 7 | distance | manhattan | 0,7812 | 0,0331 |

**Cách nói:** "Hạng 1 và hạng 2 chỉ chênh 0,0018; hệ thống chọn theo điểm cao nhất, nhưng 8 tổ hợp đầu đều quanh 0,78–0,79,
tức mô hình ổn định với nhiều cách đặt tham số."

**(d) Tổng kết 30 giây.** `grid_search` thử 64 tổ hợp, mỗi tổ hợp chấm 5 lần trên 160 máy, lấy trung bình; bộ cao nhất là
k = 7, uniform, euclidean với 0,7938 ± 0,0463.

---

## D10. Chấm cuối trên 200 máy: precision, recall, F1, macro-F1

**(a) Trên giao diện.** Quản lý mô hình → **Xem chi tiết** ở dòng Đang sử dụng (`AdminModels.tsx:220-275`). Trang này có
4 khối, theo thứ tự: bảng **So với đường cơ sở** (kNN 78,7%, Luôn đoán phân khúc đông nhất 12,8%, Luật đơn giản 63,2%);
**Đường cong chọn k** (đường đứt nét "k đã chọn" ở k = 7); bảng **Precision / Recall / F1 theo từng phân khúc**
(CREATOR recall 37,5%); **Ma trận nhầm lẫn**. Ảnh tĩnh cho slide: `artifacts/clf-2026.09.27-160831/confusion_matrix.png`
và `k_curve.png`.

**(b) Code** — `train.py:104-112`

```python
y_pred_test = best_pipe.predict(X_test[MODEL_A_FEATURES])           # 104: đoán 200 máy giữ riêng
test_f1_macro = f1_score(y_test, y_pred_test, average="macro")     # 110: F1 từng lớp, trung bình đều
report = classification_report(y_test, y_pred_test, output_dict=True)
cm = confusion_matrix(y_test, y_pred_test, labels=sorted(y.unique()))
```

**(c) Tính từng bước từ ma trận nhầm lẫn** (hàng = thật, cột = đoán)

| thật \ đoán | CREATOR | GAMING | OFFICE | ULTRABOOK | Tổng hàng |
|---|---|---|---|---|---|
| CREATOR | **9** | 14 | 1 | 0 | 24 |
| GAMING | 3 | **63** | 1 | 0 | 67 |
| OFFICE | 0 | 1 | **65** | 3 | 69 |
| ULTRABOOK | 0 | 0 | 7 | **33** | 40 |
| Tổng cột | 12 | 78 | 74 | 36 | 200 |

Định nghĩa (ô chéo = đúng):
- **Precision** = ô chéo ÷ tổng **cột** ("AI nói là X thì đúng bao nhiêu phần").
- **Recall** = ô chéo ÷ tổng **hàng** ("máy thật là X thì AI nhận ra bao nhiêu phần").
- **F1** = 2 x P x R ÷ (P + R) (trung bình điều hòa, thấp nếu một trong hai thấp).

| Lớp | Precision | Recall | 2 x P x R | P + R | F1 |
|---|---|---|---|---|---|
| CREATOR | 9 ÷ 12 = 0,7500 | 9 ÷ 24 = 0,3750 | 0,5625 | 1,1250 | **0,5000** |
| GAMING | 63 ÷ 78 = 0,8077 | 63 ÷ 67 = 0,9403 | 1,5190 | 1,7480 | **0,8690** |
| OFFICE | 65 ÷ 74 = 0,8784 | 65 ÷ 69 = 0,9420 | 1,6549 | 1,8204 | **0,9091** |
| ULTRABOOK | 33 ÷ 36 = 0,9167 | 33 ÷ 40 = 0,8250 | 1,5125 | 1,7417 | **0,8684** |

- **macro-F1** = (0,5000 + 0,8690 + 0,9091 + 0,8684) ÷ 4 = 3,1465 ÷ 4 = **0,7866**
- **Độ chính xác (accuracy)** = tổng ô chéo ÷ 200 = (9 + 63 + 65 + 33) ÷ 200 = 170 ÷ 200 = **0,85**
- **F1 có trọng số theo số máy** (để đối chiếu) = (0,5 x 24 + 0,8690 x 67 + 0,9091 x 69 + 0,8684 x 40) ÷ 200
  = (12,00 + 58,22 + 62,73 + 34,74) ÷ 200 = 167,69 ÷ 200 = **0,8384**

**Vì sao chọn macro-F1:** accuracy 0,85 và F1 có trọng số 0,8384 đều cao vì lớp đông (GAMING, OFFICE) làm tốt và chiếm nhiều
máy. macro-F1 cho CREATOR (chỉ 24 máy) **cùng tiếng nói** với các lớp khác, nên kéo điểm xuống 0,7866. Đó là điều ta muốn
thấy: điểm yếu không bị che.

**Đọc hàng CREATOR:** 24 máy CREATOR thật thì 9 đoán đúng, **14 bị đoán thành GAMING**, 1 thành OFFICE.

**(d) Tổng kết 30 giây.** Precision chia theo cột, recall chia theo hàng, F1 kết hợp hai số; macro-F1 là trung bình đều
4 lớp = 0,7866. CREATOR có recall 0,375 là điểm yếu.

---

## D11. Hai mốc so sánh: tính tay 0,128 và 0,632

**(b) Code** — `classifier.py:54-74`, `train.py:115-120`

```python
clf = DummyClassifier(strategy="most_frequent")   # luôn đoán lớp đông nhất của tập học
...
if row["gpu_dedicated"] and row["refresh_hz"] >= 120:  preds.append("GAMING")     # card rời + màn nhanh
elif row["srgb_100"] and row["cpu_score"] >= p70_cpu:  preds.append("CREATOR")    # màn chuẩn màu + CPU top 30%
elif row["weight_kg"] <= 1.4:                         preds.append("ULTRABOOK")  # nhẹ
else:                                                 preds.append("OFFICE")
```

**(c) Tính tay mốc Dummy.** Lớp đông nhất trong 800 máy học là OFFICE (275) → đoán **OFFICE cho cả 200 máy**.

| Lớp | Precision | Recall | F1 |
|---|---|---|---|
| OFFICE | 69 ÷ 200 = 0,345 | 69 ÷ 69 = 1 | 2 x 0,345 x 1 ÷ 1,345 = 0,690 ÷ 1,345 = **0,5130** |
| CREATOR, GAMING, ULTRABOOK | không đoán lần nào | 0 | **0** |

macro-F1 = (0,5130 + 0 + 0 + 0) ÷ 4 = **0,1283**. Trong khi accuracy của Dummy là 69 ÷ 200 = 0,345: lại một ví dụ accuracy
"nhìn đỡ tệ" hơn macro-F1.

**Tính tay mốc luật if-else.** Ma trận nhầm lẫn của luật trên cùng 200 máy:

| thật \ đoán | CREATOR | GAMING | OFFICE | ULTRABOOK |
|---|---|---|---|---|
| CREATOR (24) | **5** | 13 | 6 | 0 |
| GAMING (67) | 4 | **52** | 11 | 0 |
| OFFICE (69) | 1 | 1 | **47** | 20 |
| ULTRABOOK (40) | 1 | 0 | 2 | **37** |

Ví dụ lớp CREATOR: precision = 5 ÷ (5 + 4 + 1 + 1) = 5 ÷ 11 = 0,4545; recall = 5 ÷ 24 = 0,2083;
F1 = 2 x 0,4545 x 0,2083 ÷ (0,4545 + 0,2083) = 0,1894 ÷ 0,6628 = **0,2857**.
Bốn lớp: 0,2857; 0,7820 (GAMING); 0,6963 (OFFICE); 0,7629 (ULTRABOOK) → macro-F1 = 2,5269 ÷ 4 = **0,6317**.

**So sánh:** kNN 0,7866 hơn luật 0,6317 là **+0,1549**; hơn Dummy là **+0,6583**. Ở lớp khó nhất CREATOR, luật chỉ được F1 0,29,
kNN được 0,50.

**Lưu ý nói thẳng:** trong code, mốc "CPU top 30%" (`p70_cpu`) được tính trên chính 200 máy đang chấm (`rule_based_baseline(X_test)`).
Lần này giá trị trùng với khi tính trên 800 máy học (đều 62,1622), nên không ảnh hưởng kết quả; nhưng về nguyên tắc nên tính
trên tập học.

**(d) Tổng kết 30 giây.** Đoán bừa lớp đông được 0,128; luật tay được 0,632; kNN được 0,787. kNN thắng rõ, nhất là ở CREATOR.

---

## D12. Hàng đợi Duyệt nhãn và nút Xuất CSV

**(a) Trên giao diện.** Dữ liệu → **Duyệt nhãn** (huy hiệu 6). Mỗi thẻ: tên máy, CPU/GPU, giá, "Dự đoán: … %",
**Cần xác minh**, 4 phần trăm, ô chọn phân khúc, checkbox **Khóa nhãn, không cho mô hình thay đổi**, nút **Duyệt (giữ nhãn AI)**.
Nút **Xuất nhãn đã duyệt (CSV)** ở trên cùng. Chỉ xem, không bấm Duyệt nếu không định đổi dữ liệu.

**(c) Kiểm tra số trên thẻ.** Thẻ "Avita Pura 0874: Văn phòng 52%, Mỏng nhẹ 41%, Gaming 5%, Đồ họa 2%". Với k = 7 uniform,
xác suất chỉ có thể là 0/7 … 7/7, tức 0%, 14%, 29%, 43%, 57%, 71%, 86%, 100%. 52% không nằm trong danh sách, nên thẻ này không
do mô hình hiện tại tạo ra. Đúng vậy: trong DB, cột `predictedBy` của 6 thẻ là `demo-seed-review-queue`, tạo bởi
`backend/scripts/seedReviewQueue.ts` để có sẵn dữ liệu demo hàng đợi.
**Cách nói:** "Sáu thẻ này là dữ liệu mẫu để minh họa giao diện. Một máy thật vào hàng đợi thì xác suất sẽ là bội số của 1/7,
như Helios 0051 ở Demo 2 là 43%."

**(d) Tổng kết 30 giây.** Máy dưới ngưỡng vào hàng đợi; người chọn nhãn, có thể khóa; nhãn đã duyệt xuất CSV để huấn luyện lần sau.

---

## D13. Tự luyện: 5 bài tính lại (đáp án bên dưới, che lại trước khi làm)

1. Máy RAM 16GB: log2 bằng bao nhiêu, z bằng bao nhiêu? (TB 3,7938; ĐLC 0,7913)
2. 7 láng giềng là 5 GAMING, 2 CREATOR: nhãn, độ tin cậy, VERIFIED hay NEEDS_REVIEW?
3. Từ ma trận nhầm lẫn D10, tính precision và recall của OFFICE mà không nhìn bảng.
4. Nếu macro-F1 bốn lớp là 0,6; 0,9; 0,9; 0,9 thì macro-F1 bằng bao nhiêu? Accuracy có thể vẫn cao không, vì sao?
5. Màn 1920 x 1080, 15,6": ppi bằng bao nhiêu?

**Đáp án:**
1. log2(16) = 4; z = (4 − 3,7938) ÷ 0,7913 = 0,2062 ÷ 0,7913 = **0,2606**.
2. GAMING; 5 ÷ 7 = **0,7143**; 0,7143 ≥ 0,6 nên **VERIFIED**.
3. Precision = 65 ÷ 74 = **0,8784**; recall = 65 ÷ 69 = **0,9420**.
4. (0,6 + 0,9 + 0,9 + 0,9) ÷ 4 = 3,3 ÷ 4 = **0,825**. Accuracy vẫn có thể cao nếu lớp 0,6 là lớp ít máy, vì accuracy đếm theo số máy.
5. 1920² + 1080² = 3.686.400 + 1.166.400 = 4.852.800; √4.852.800 = 2.202,91; 2.202,91 ÷ 15,6 = **141,21**.
