# 04 — Mô hình kNN

## 1. Tổng quan luồng khuyến nghị

```
Nhu cầu người dùng (wizard hoặc câu tự do)
        │
        ▼
[0] (nếu gõ câu tự do) Mô hình C: TF-IDF + kNN ──► nhóm nhu cầu, ngân sách, ưu tiên, ràng buộc
        │
        ▼
[1] Mô hình A: kNN phân lớp (nếu chọn "Chưa rõ") ──► suy phân khúc từ hoạt động
        │
        ▼
[2] Lọc cứng (ngân sách, bắt buộc, loại/ghim) ── backend, trả về candidateIds
        │
        ▼
[3] Dựng vector nhu cầu lý tưởng q trong tập ứng viên
        │
        ▼
[4] Mô hình B: kNN truy hồi, khoảng cách MỘT PHÍA có trọng số
        │
        ▼
[5] % phù hợp + giải thích tiếng Việt
```

Ba mô hình kNN độc lập, mỗi mô hình dùng lớp scikit-learn khác nhau vì giải hai *loại bài toán* khác nhau:

| Mô hình | Bài toán | Lớp scikit-learn | File |
|---|---|---|---|
| A — Phân loại phân khúc | "Cấu hình này thuộc phân khúc nào?" | `KNeighborsClassifier` | `app/models/classifier.py` |
| B — Truy hồi gợi ý | "Máy nào gần nhu cầu nhất?" | `NearestNeighbors` + metric tự viết | `app/models/retriever.py` |
| C — Phân loại câu tự do | "Câu này thuộc nhóm nhu cầu nào?" | `KNeighborsClassifier` (qua `Pipeline`) | `app/models/text_classifier.py` |

## 2. Cơ sở lý thuyết

kNN (Fix & Hodges, 1951; Cover & Hart, 1967) phân lớp/truy hồi một mẫu mới dựa trên k mẫu đã biết gần nhất theo một hàm khoảng cách. Các bước chung: (1) chọn k; (2) tính khoảng cách từ điểm truy vấn đến mọi mẫu; (3) sắp xếp tăng dần, lấy k láng giềng gần nhất; (4) tổng hợp kết quả — bỏ phiếu đa số (phân loại) hoặc trả nguyên danh sách đã sắp hạng (truy hồi).

Khoảng cách dùng trong đồ án:
- Euclidean: `d(x, y) = √Σ (xᵢ − yᵢ)²` — Mô hình A (một trong hai lựa chọn của `GridSearchCV`) và `similar_items()` của Mô hình B.
- Manhattan: `d(x, y) = Σ |xᵢ − yᵢ|` — lựa chọn còn lại trong `GridSearchCV` của Mô hình A.
- Cosine — Mô hình C, phù hợp với vector TF-IDF thưa, nhiều chiều.
- **Khoảng cách một phía có trọng số** (Mô hình B, xem mục 4) — biến thể tự thiết kế của đồ án, không phải công thức sách giáo khoa.

Biến thể bỏ phiếu theo khoảng cách (`weights="distance"`): láng giềng gần hơn có phiếu nặng hơn (trọng số 1/d), là một trong các tham số được `GridSearchCV` dò ở Mô hình A.

## 3. Mô hình A — kNN phân lớp phân khúc (`KNeighborsClassifier`)

### 3.1 Mục đích sử dụng
1. Gợi ý phân khúc khi nhân viên thêm laptop mới (endpoint `/predict-segment`).
2. Suy phân khúc từ hoạt động khi người dùng wizard chọn "Chưa rõ" (endpoint `/infer-segment`, dùng lại chính mô hình đã huấn luyện qua `app/models/segment_inference.py`).

### 3.2 Cấu hình — `build_pipeline()` + `grid_search()` ([ml-service/app/models/classifier.py](../ml-service/app/models/classifier.py))

```python
RANDOM_STATE = 42

def build_pipeline() -> Pipeline:
    return Pipeline([
        ("prep", build_model_a_preprocessor()),   # 03 §5.2 — StandardScaler nằm TRONG pipeline
        ("knn", KNeighborsClassifier()),
    ])

PARAM_GRID = {
    "knn__n_neighbors": list(range(1, 32, 2)),   # 1,3,...,31 (lẻ để giảm hoà phiếu)
    "knn__weights": ["uniform", "distance"],
    "knn__metric": ["euclidean", "manhattan"],
}
# => 16 x 2 x 2 = 64 cấu hình

search = GridSearchCV(
    build_pipeline(), PARAM_GRID,
    cv=StratifiedKFold(5, shuffle=True, random_state=RANDOM_STATE),
    scoring="f1_macro", n_jobs=-1, return_train_score=True,
)
```

`StratifiedKFold` giữ đúng tỉ lệ 4 phân khúc trong mỗi fold — quan trọng vì lớp CREATOR ít mẫu hơn hẳn GAMING/OFFICE.

### 3.3 Tách dữ liệu — `app/lifecycle/train.py`

- `train_test_split(test_size=0.2, stratify=y, random_state=42)` trên toàn bộ catalog đã làm giàu đặc trưng.
- `GridSearchCV` chỉ chạy trên 80% train (5-fold CV nội bộ). 20% test chỉ được chạm **một lần** để tính `test_metrics` cuối cùng.
- Lần chạy `python -m app.lifecycle.train` đầu tiên sẽ đóng băng 20% test đó thành `artifacts/golden_test.csv` (chỉ ghi nếu file chưa tồn tại) để so sánh công bằng giữa các phiên bản huấn luyện sau này.

### 3.4 Vì sao macro-F1

`GridSearchCV` chấm điểm bằng `scoring="f1_macro"`, không phải accuracy. Lớp CREATOR ít mẫu — accuracy có thể cao dù mô hình gần như bỏ qua lớp này; macro-F1 tính F1 riêng từng lớp rồi lấy trung bình đều, nên phạt rõ việc bỏ qua lớp nhỏ.

### 3.5 Suy phân khúc từ hoạt động — `app/models/segment_inference.py`

Không huấn luyện mô hình mới. `ACTIVITY_TARGETS` ánh xạ từng hoạt động (`choi_game`, `do_hoa`, `dung_video`, `di_chuyen_nhieu`, `van_phong`, `hoc_tap`, `lap_trinh`, `thiet_ke`, `xem_phim`) sang phân vị mục tiêu cho từng đặc trưng. `build_activity_vector()` gộp nhiều hoạt động cho cùng một đặc trưng bằng cách lấy giá trị **lệch xa trung vị (50) nhất**, không phải trung bình cộng — hoạt động "đòi hỏi cao nhất" quyết định. Vector giả định thu được đưa qua `predict_proba()` của chính Mô hình A đã huấn luyện; `infer_segment()` còn trả về danh sách k láng giềng đã "bỏ phiếu" để giải thích.

## 4. Mô hình B — kNN truy hồi có trọng số, khoảng cách MỘT PHÍA (`NearestNeighbors`)

Khác biệt quan trọng nhất so với kNN "sách giáo khoa": Euclidean chuẩn phạt hai chiều như nhau (máy mạnh hơn nhu cầu bị coi "xa" y hệt máy yếu hơn nhu cầu). Theo góp ý cần **không phạt máy mạnh hơn/rẻ hơn/nhẹ hơn mức cần**, đồ án tự thiết kế khoảng cách một phía và đưa thẳng vào tham số `metric` của `NearestNeighbors` (không xếp hạng lại ở ngoài).

### 4.1 Bước 1 — Dựng vector nhu cầu lý tưởng q — `build_ideal_vector()` ([ml-service/app/models/retriever.py:88](../ml-service/app/models/retriever.py))

Với mỗi mức ưu tiên p ∈ {1..5}, tra `PERCENTILE_BY_PRIORITY = {1: 25, 2: 40, 3: 55, 4: 75, 5: 90}` để lấy phân vị trong tập ứng viên `candidates` (đã qua lọc cứng ở backend):

| Nhóm ưu tiên | Đặc trưng | Cách đặt q |
|---|---|---|
| Hiệu năng (`performance`) | `cpu_score`, `gpu_score`, `ram_gb`, `ssd_gb` | phân vị(p) |
| Di động (`mobility`) | `weight_kg` | phân vị(**100 − p**) — càng ưu tiên di động càng cần q ở phân vị **thấp** của cân nặng |
| | `battery_wh` | phân vị(p) |
| Màn hình (`display`) | `ppi`, `refresh_hz` | phân vị(p); `srgb_100 = 1` chỉ khi p ≥ 4 |
| Tiết kiệm (`price`) | `price_vnd` | `Bmin + (1 − (p−1)/4)·(Bmax − Bmin)` — p=5 → q ≈ Bmin, p=1 → q ≈ Bmax |
| | `value_index` | phân vị(p) |
| (cố định, không theo ưu tiên) | `screen_inch` | trung vị `candidates` |
| | `gpu_dedicated` | 1 nếu `segment == "GAMING"`, ngược lại lấy trung vị `candidates` |
| | `brand_tier` | phân vị 50 |
| | `discount_percent`, `sales_score` | phân vị 80 (nhóm "độ phổ biến", không có thanh trượt riêng) |

Ràng buộc bắt buộc đẩy q lên nếu có: `q["ram_gb"] = max(q["ram_gb"], must["ramMin"])`.

**Vì sao đặt `price_vnd`/`value_index` ở biên thay vì trung vị:** với khoảng cách một phía, máy rẻ hơn q không hề bị phạt — nếu q đặt giữa khoảng ngân sách thì mọi máy rẻ hơn đều có phạt = 0, mất khả năng phân biệt, khiến người ưu tiên tiết kiệm vẫn bị gợi ý máy đắt. Do đó q của các đặc trưng một phía phải nằm ở **biên mong muốn**.

### 4.2 Bước 2 — Trọng số đặc trưng — `build_weights()` ([retriever.py:150](../ml-service/app/models/retriever.py))

```
w_nhóm(thô) = mức_ưu_tiên(1..5) × base_nhóm(phân_khúc)
w_đặc_trưng = w_nhóm(thô) / số đặc trưng trong nhóm
```

`BASE_WEIGHT_BY_SEGMENT` — trọng số nền theo phân khúc, chỉnh được qua Cấu hình tri thức (FR-13, `base_weights_override`):

| Phân khúc | performance | mobility | display | price | brand |
|---|---|---|---|---|---|
| GAMING | 1.3 | 0.7 | 1.0 | 1.0 | 0.5 |
| ULTRABOOK | 0.8 | 1.4 | 1.0 | 1.0 | 0.7 |
| CREATOR | 1.2 | 0.8 | 1.3 | 0.8 | 0.6 |
| OFFICE | 0.8 | 1.0 | 0.8 | 1.3 | 0.6 |

Nhóm `brand` nhân thêm `brand_weight` (chỉ tăng khi câu nhu cầu tự do có từ khoá "bền"/"uy tín", xem `text_classifier.PRIORITY_HINTS`), không có thanh trượt riêng cho người dùng. Nhóm `popularity` (`discount_percent`, `sales_score`) dùng trọng số **cố định** `POPULARITY_WEIGHT = 0.12`, không phụ thuộc mức ưu tiên. `screen_inch` cố định `0,05`; `gpu_dedicated` cố định `0,06`. Toàn bộ trọng số cuối cùng được chia cho tổng để Σw = 1.

### 4.3 Bước 3 — Khoảng cách một phía và kNN thật — `one_sided_distance()` + `make_one_sided_metric()` ([retriever.py:201–241](../ml-service/app/models/retriever.py))

```python
# Hướng "tốt" của từng đặc trưng (FEATURE_DIRECTION):
#  +1 = càng cao càng tốt   (cpu_score, gpu_score, ram_gb, ssd_gb, ppi, refresh_hz, srgb_100,
#                             battery_wh, brand_tier, gpu_dedicated, value_index,
#                             discount_percent, sales_score)
#  -1 = càng thấp càng tốt  (weight_kg, price_vnd)
#   0 = hai phía            (screen_inch)

def one_sided_distance(x, q, weights_vec, directions):
    diff = x - q
    pen = where(direction == +1, max(0, -diff),          # phạt khi x < q (thiếu)
         where(direction == -1, max(0, diff),             # phạt khi x > q (vượt)
               abs(diff)))                                # hai phía: luôn phạt
    return sqrt(sum(weights_vec * pen**2))

def metric(a, b):          # sklearn gọi metric(query, x) — TỰ ĐẢO cho đúng thứ tự (x, q) cần
    return one_sided_distance(b, a, weights_vec, directions)

nn = NearestNeighbors(n_neighbors=top_n, algorithm="brute", metric=metric)
nn.fit(Xs); dist, idx = nn.kneighbors(qs)
```

`OVERSHOOT_PENALTY = 0.0`: máy vượt yêu cầu theo hướng có lợi (mạnh hơn/rẻ hơn/nhẹ hơn) không bị phạt gì.

> **Lỗi từng gặp, đáng nêu khi bảo vệ**: `scikit-learn` gọi `metric(a, b)` theo thứ tự `(điểm truy vấn q, điểm trong catalog x)` — ngược với thứ tự `(x, q)` công thức một phía cần, và hàm này không đối xứng (`d(x,q) ≠ d(q,x)`) nên gọi sai thứ tự sẽ lật dấu phạt. Lỗi được chặn tái phát bằng test `test_one_sided_metric_argument_order` ([ml-service/tests/test_one_sided_metric.py](../ml-service/tests/test_one_sided_metric.py)).

`algorithm="brute"` bắt buộc vì metric tuỳ biến không tương thích với cấu trúc chỉ mục KD-Tree/Ball-Tree; với quy mô ~1000 máy, brute-force vẫn đủ nhanh.

### 4.4 Bước 4 — Lọc mềm theo phân khúc ([retriever.py:271–277](../ml-service/app/models/retriever.py))

Thay vì loại cứng các máy khác phân khúc mong muốn, độ khớp phân khúc được thêm làm **một đặc trưng nữa** trong metric: nối thêm cột `seg_match ∈ {0,1}` vào `Xs`/`qs`, trọng số cố định `SEGMENT_SOFT_WEIGHT = 0.18`, hướng `+1` (khớp phân khúc càng cao càng tốt, nhưng không khớp chỉ bị phạt nhẹ chứ không loại). Nhờ vậy một máy tốt vượt trội ở các mặt khác vẫn có cơ hội lọt top-N dù khác phân khúc mong muốn.

### 4.5 Ghim / loại

Lọc cứng (ngân sách, RAM tối thiểu, máy bị cấm) xảy ra ở **backend**, trước khi gọi `/recommend` — Mô hình B chỉ xếp hạng trong tập `candidateIds` đã được backend thu hẹp sẵn, không tự lọc lại từ đầu.

### 4.6 Máy tương tự (item-item) — `similar_items()` ([retriever.py:303](../ml-service/app/models/retriever.py))

Dùng lại `MODEL_B_FEATURES` và `scaler` của Mô hình B nhưng Euclidean **hai phía** thông thường (ở đây cần tìm máy *giống nhau*, mạnh hơn hay yếu hơn đều tính là khác biệt): điểm truy vấn là chính vector của máy đang xem, `k+1` láng giềng rồi bỏ phần tử đầu (chính nó, khoảng cách 0).

## 5. Lựa chọn k và các vấn đề kỹ thuật

### 5.1 Chọn k (Mô hình A)
- k nhỏ (1–3): nhạy nhiễu, dễ overfit. k lớn: làm mờ ranh giới, thiên về lớp đông.
- `k_curve()` ([ml-service/app/models/classifier.py:113](../ml-service/app/models/classifier.py)) tính macro-F1 trung bình (5-fold CV) cho từng k lẻ từ 1 đến 31, giữ nguyên `weights`/`metric` tốt nhất — sinh biểu đồ `k_curve.png` trong artifact mỗi lần `python -m app.lifecycle.train`.
- k thật sự được chọn là kết quả `GridSearchCV` (dò đồng thời k, weights, metric), không chọn tay từ đường cong.

### 5.2 Số chiều đặc trưng
11 đặc trưng ở Mô hình A là ít, khoảng cách vẫn còn ý nghĩa phân biệt. Không mã hoá one-hot hãng máy vào Mô hình A vì sẽ tăng chiều và gây thiên lệch theo hãng — `brand_tier` chỉ dùng ở Mô hình B.

### 5.3 Mất cân bằng lớp — `app/lifecycle/ablation.py::run_imbalance_configs()`
So sánh trên cùng cross-validation:
1. Không xử lý gì thêm.
2. `weights="distance"`.
3. `RandomOverSampler` (imbalanced-learn) đặt **trong** `Pipeline` — chỉ nhân bản mẫu ở fold train, fold validation giữ nguyên mẫu thật.

## 6. Đánh giá

### 6.1 Mô hình A — `python -m app.lifecycle.train`

| Chỉ số | Mục tiêu |
|---|---|
| Macro-F1 trên test (20% giữ lại) | ≥ 0,75 |
| Vượt baseline đa số (`DummyClassifier`) | ≥ +0,30 macro-F1 |
| Vượt baseline luật if-else | ≥ +0,05 macro-F1 |

Baseline dùng để so sánh, cả hai định nghĩa trong `app/models/classifier.py`:
- `dummy_baseline()`: `DummyClassifier(strategy="most_frequent")`.
- `rule_based_baseline()`: có GPU rời và refresh ≥ 120Hz → GAMING; sRGB 100% và CPU thuộc top 30% (phân vị 70) → CREATOR; nhẹ ≤ 1,4kg → ULTRABOOK; còn lại → OFFICE.

Đầu ra `python -m app.lifecycle.train` ghi vào `artifacts/<version>/`: `metadata.json` (tham số tốt nhất, macro-F1 CV và test, classification report, confusion matrix dạng số, baseline, đường cong k), `confusion_matrix.png`, `k_curve.png`, `model.joblib` (Mô hình A), `text_model.joblib` (Mô hình C). Số liệu thật gần nhất xem `docs/14_KET_QUA_THUC_NGHIEM.md`.

> Nếu không đạt mục tiêu, báo cáo trung thực con số và phân tích nhầm lẫn giữa lớp nào (thường là GAMING ↔ CREATOR do cùng đòi hỏi cấu hình mạnh) từ ma trận nhầm lẫn.

### 6.2 Mô hình B — `python -m app.lifecycle.evaluate`

`app/lifecycle/evaluate.py::evaluate_model_a()` và các hàm liên quan đo:

| Chỉ số | Cách đo |
|---|---|
| P@5 / nDCG@5 | So khuyến nghị kNN một phía với 3 baseline: sắp giá tăng dần, sắp `value_index` giảm dần, ngẫu nhiên — trên bộ persona |
| Tuân thủ ngân sách | Mọi kết quả ≤ Bmax |
| Tỷ lệ persona đạt | 30 persona (`data/personas/personas.json`), đạt khi thỏa toàn bộ điều kiện `expect` |
| "Công sức tìm kiếm" | So số máy trung bình phải duyệt thủ công so với dùng hệ thống (top-5) |

### 6.3 Thí nghiệm cắt bỏ (ablation) — `python -m app.lifecycle.ablation`

`run_ablation()` so trên cùng cross-validation: baseline đầy đủ, bỏ `StandardScaler`, bỏ `refresh_hz`, bỏ `srgb_100`, đổi Manhattan thay Euclidean. Kết quả ghi vào `artifacts/<version>/experiments.json`, dùng minh chứng cho `03_DU_LIEU_VA_TIEN_XU_LY.md` §5.1 (vì sao phải chuẩn hoá) bằng số liệu thay vì chỉ lý thuyết.

## 7. Mô hình C — kNN phân loại câu nhu cầu tự do

Xem chi tiết thuật toán, ví dụ tính tay và câu hỏi thường gặp ở `docs/13_GIAI_THICH_THUAT_TOAN_KNN.md` mục 4.3. Tóm tắt cấu hình:

```python
FeatureUnion([
    ("word", TfidfVectorizer(analyzer="word", ngram_range=(1, 2), sublinear_tf=True, min_df=1)),
    ("char", TfidfVectorizer(analyzer="char_wb", ngram_range=(3, 5), sublinear_tf=True, min_df=1)),
])
KNeighborsClassifier(n_neighbors=k, metric="cosine", weights="distance")
```

6 nhãn nhu cầu (`VAN_PHONG`, `HOC_TAP`, `LAP_TRINH`, `DO_HOA`, `GAMING`, `DI_DONG`), huấn luyện trên `data/need_phrases.json` (132 câu viết tay). `k` được chọn bằng `StratifiedKFold(5)` cross-validation trên `k ∈ {1, 3, 5, 7}` trong `train.py::train_text_model()`. Mô hình C **không nạp từ artifact lúc chạy service** — `main.py` huấn luyện lại ngay khi khởi động (`NeedTextModel(n_neighbors=7).fit()`) vì tập dữ liệu nhỏ, huấn luyện tức thời. `python -m app.lifecycle.train` vẫn lưu `text_model.joblib` và số liệu (`best_k`, `cv_f1_macro`, `f1_macro_by_k`) vào `metadata.json["text_model"]` để tra cứu/so sánh phiên bản.

Phần trích số cụ thể (ngân sách, ràng buộc RAM/cân nặng) trong câu tự do dùng regex (`extract_budget()`, `extract_constraints()`), không phải kNN — vì đây là tri thức hỗ trợ (trích số), khác với việc phân loại nhóm nhu cầu (cần hiểu ý nghĩa, mới cần kNN).

## 8. Giải thích (Explanation Facility)

### 8.1 Mô hình A
Trả về `distribution` (xác suất từng nhãn) và `neighbors` (k láng giềng thật kèm nhãn, khoảng cách) trong response `/predict-segment` — ví dụ hiển thị "5/7 máy gần nhất là Gaming → dự đoán Gaming (71%)".

### 8.2 Mô hình B — `build_explanation()` ([ml-service/app/models/explain.py](../ml-service/app/models/explain.py))
Không phải văn bản do AI sinh: so từng đặc trưng của máy với vector lý tưởng `q`, trả về **mã** (`perf_above`, `gpu_dedicated`, `weight_over`, `price_under`, `ram_low`, `display_good`, …) kèm tham số và `tone: positive|warning`. Frontend (`frontend/src/utils/explainText.ts`) dịch mã đó thành câu tiếng Việt — tách riêng để dễ kiểm thử (so mã, không so chuỗi) và dễ đổi cách diễn đạt sau này.

## 9. Artifact và phiên bản

```
ml-service/artifacts/
├── LATEST                        # tên version đang active (text thuần)
├── golden_test.csv               # 20% test đóng băng từ lần train đầu tiên
├── evaluation.json               # kết quả python -m app.lifecycle.evaluate (P@5, nDCG@5, search effort)
└── clf-2026.09.27-160831/        # 1 thư mục / lần chạy python -m app.lifecycle.train
    ├── model.joblib               # Pipeline Mô hình A đầy đủ (prep + knn)
    ├── text_model.joblib          # Pipeline Mô hình C
    ├── metadata.json
    ├── confusion_matrix.png
    ├── k_curve.png
    └── experiments.json           # chỉ có nếu đã chạy python -m app.lifecycle.ablation cho version này
```

`metadata.json`: `version`, `type`, `trained_at`, `dataset_hash` (SHA-256 của `catalog_vn.csv`), `n_samples`, `class_counts`, `best_params`, `cv_f1_macro_mean/std`, `test_metrics` (macro-F1, classification report, confusion matrix, labels), `baseline` (dummy/rule macro-F1), `k_curve`, `feature_list`, `sklearn_version`, `text_model` (metadata Mô hình C). `app/lifecycle/registry.py` (`registry.activate_latest()`, `registry.activate(version)`) quản lý việc nạp/kích hoạt/rollback giữa các version, gọi từ `main.py` lúc khởi động và ở endpoint `/models/{version}/activate`.

## 10. Endpoint FastAPI (`ml-service/app/main.py`)

| Method | Path | Mô hình liên quan | Mô tả |
|---|---|---|---|
| GET | `/health` | — | Trạng thái service, `clfVersion`, `catalogSize`, `indexBuiltAt` |
| POST | `/catalog/sync` | B | Nhận toàn bộ catalog từ backend, thay thế hoàn toàn state trong RAM, fit lại `scaler` |
| POST | `/predict-segment` | A | Dự đoán phân khúc + phân bố xác suất + k láng giềng đã bỏ phiếu |
| POST | `/parse-need` | C | Câu tự do → hồ sơ nhu cầu đầy đủ |
| POST | `/infer-segment` | A | Suy phân khúc từ danh sách hoạt động khi người dùng chọn "Chưa rõ" |
| POST | `/recommend` | B | 5 bước ở mục 4: `build_ideal_vector` → `build_weights` → `recommend` (kNN một phía) → `match_pct` → `build_explanation` |
| POST | `/similar` | B | "Máy tương tự" (item-item, Euclidean hai phía) |
| POST | `/train` | A + C | Chạy lại `train.main()` từ xa, kích hoạt artifact mới ngay |
| POST | `/models/{version}/activate` | — | Rollback / kích hoạt một phiên bản artifact cụ thể |
| GET | `/models/{version}` | — | Xem metadata chi tiết của một phiên bản |

Toàn bộ trạng thái (`_state`: catalog, scaler, index_built_at, text_model) chỉ giữ trong RAM của tiến trình FastAPI — không dùng chung DB với backend, nên backend phải gọi lại `/catalog/sync` mỗi khi ML service khởi động lại.

## 11. Kiểm thử bắt buộc (`ml-service/tests/`, 6 file)

| File | Test | Chặn lỗi gì |
|---|---|---|
| `test_classifier.py` | `test_scaler_inside_pipeline` | Fit scaler ngoài Pipeline (rò rỉ dữ liệu khi CV) |
| | `test_price_not_in_classifier` | `price_vnd` vô tình lọt vào `MODEL_A_FEATURES` (D-04) |
| | `test_reproducible` | Cùng seed 42, huấn luyện 2 lần ra kết quả khác nhau |
| | `test_scale_invariance` | Đổi đơn vị giá (VND ↔ nghìn VND) làm đổi kết quả phân lớp |
| | `test_neighbors_explain_the_vote` | Danh sách láng giềng trả về không khớp tỉ lệ `predict_proba` thật |
| `test_retriever.py` | `test_identity_top1` | Truy vấn bằng chính vector 1 máy không ra máy đó ở hạng 1 |
| | `test_weight_changes_ranking` | Tăng ưu tiên di động nhưng top-5 không nhẹ hơn |
| | `test_budget_hard_constraint` | Kết quả vượt ngân sách tối đa |
| | `test_explanation_schema` | Kết quả không có ≥ 1 điểm mạnh / mã giải thích hợp lệ |
| `test_one_sided_metric.py` | `test_stronger_and_cheaper_not_penalized` | Máy mạnh hơn/rẻ hơn nhu cầu bị phạt oan |
| | `test_one_sided_metric_argument_order` | Lỗi đảo thứ tự tham số `metric(q, x)` của sklearn tái phát (mục 4.3) |
| | `test_cheap_priority_returns_cheaper_machines` | Ưu tiên tiết kiệm nhưng kết quả không rẻ hơn |
| | `test_soft_segment_filter_keeps_other_segments` | Lọc mềm phân khúc bị biến thành lọc cứng |
| `test_personas.py` | `test_personas` | 30 persona chạy hết luồng, yêu cầu ≥ 90% đạt kỳ vọng |
| | `test_need_text_model_on_personas` | Mô hình C hiểu sai câu nhu cầu của persona |
| | `test_need_text_produces_valid_query` | Kết quả Mô hình C không dùng được làm đầu vào Mô hình B |
| `test_priority_sensitivity.py` | `test_performance_priority_raises_power`, `test_mobility_priority_lowers_weight`, `test_price_priority_lowers_price`, `test_display_priority_improves_screen` (quét theo từng phân khúc) | Kéo thanh ưu tiên lên nhưng kết quả không đổi đúng hướng |
| | `test_priority_changes_actually_change_results`, `test_conflicting_priorities_still_reasonable`, `test_all_extreme_combinations_return_results` | Trường hợp ưu tiên mâu thuẫn / tổ hợp cực trị làm hệ thống lỗi hoặc trả về rỗng |
| `conftest.py` | fixture `enriched_catalog`, `personas` | Dữ liệu dùng chung cho toàn bộ test trên, đọc từ `catalog_vn.csv` và `personas.json` |

Chạy toàn bộ: `cd ml-service && pytest -v`.
