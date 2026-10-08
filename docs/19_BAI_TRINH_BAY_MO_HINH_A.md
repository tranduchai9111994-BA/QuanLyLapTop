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
# ml-service/app/data/features.py:20-30
NUMERIC_LOG = ["ram_gb", "ssd_gb"]   # nhóm 1: log2 rồi chuẩn hóa (8->16GB và 16->32GB đều "gấp đôi")
NUMERIC = ["cpu_score", "gpu_score", "screen_inch", "ppi", "refresh_hz", "weight_kg", "battery_wh"]  # nhóm 2
BINARY = ["gpu_dedicated", "srgb_100"]   # nhóm 3: giữ 0/1
MODEL_A_FEATURES = NUMERIC_LOG + NUMERIC + BINARY   # 11 cột = 2 + 7 + 2
```

```python
# features.py:188-215 (rút gọn): cùng một bộ tiền xử lý, đặt TRONG Pipeline
("log", Pipeline([impute trung vị, FunctionTransformer(np.log2), StandardScaler()]), NUMERIC_LOG),
("num", Pipeline([impute trung vị, StandardScaler()]), NUMERIC),
("bin", "passthrough", BINARY),
```

- **[CẤU TRÚC]** thứ tự: điền thiếu → log2 (chỉ RAM/SSD) → z-score `(x − trung bình) ÷ độ lệch chuẩn`.
- **[DỮ LIỆU/CẤU HÌNH]** danh sách cột nào vào nhóm nào.
- Trung bình và độ lệch chuẩn tính trên **800 máy huấn luyện**, lưu trong `model.joblib`
  (xem lệnh ở docs/17; cách tự kiểm tra ở docs/15 mục 1.11).

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
3. Bấm **Hủy**.
   *Lời nói:* "Hai nhóm hòa 3-3 nên độ tin cậy 43%, dưới ngưỡng 60%, máy vào hàng đợi cho người xác nhận.
   Khi hòa phiếu giao diện hiện nhãn đứng sau là Mỏng nhẹ, nhưng đó là hòa."

**Demo 3: để trống phân khúc, AI tự gán khi Lưu**
1. **+ Thêm mới**: CPU `Intel Core i9-13900H`, GPU `RTX 4070`, RAM 32, SSD 1024, màn 16", 240 Hz, nặng 2,6 kg, giá 45 triệu,
   SKU bất kỳ, **để trống ô Phân khúc**.
2. Bấm **Lưu**; mong đợi thông báo "Đã gán phân khúc: Gaming".
3. **Xóa máy thử** sau khi demo (nút Xóa ở dòng đó). Demo này ghi dữ liệu thật vào DB nên bắt buộc dọn.

**Demo 4: hàng đợi Duyệt nhãn**
Menu **Dữ liệu → Duyệt nhãn** (huy hiệu số máy đang chờ). Mỗi thẻ có phân bố xác suất, ô chọn phân khúc, checkbox
"Khóa nhãn, không cho mô hình thay đổi", nút Duyệt. Hiện có 6 máy MODEL ở trạng thái NEEDS_REVIEW chờ duyệt.

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

---

## 12. Danh sách tự kiểm tra trước khi lên nói

- [ ] Nói trơn đoạn mở đầu 30 giây (mục 0) không nhìn tài liệu.
- [ ] Giải thích được "kNN là thuật toán, Euclidean là cách đo gần" bằng một câu.
- [ ] Đọc được `PARAM_GRID` và nói 16 × 2 × 2 = 64, nhân 5 phần = 320 lần học.
- [ ] Chỉ được trên ma trận nhầm lẫn ô nào là 0,375 (9 trên 24).
- [ ] Nêu được ba số của macro-F1 (0,787 test; 0,794 GridSearch; 0,773 chạy lại) và biết khi nào dùng số nào.
- [ ] Làm trôi chảy Demo 1 và Demo 2, kết thúc bằng nút **Hủy**.
- [ ] Biết nói "chưa đo" với những gì chưa đo (so với Random Forest, xếp hạng 11 đặc trưng).
