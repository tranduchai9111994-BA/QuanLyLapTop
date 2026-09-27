# Giải thích thuật toán kNN trong SmartLap (kèm dẫn chứng code + cách kiểm tra)

> **LƯU Ý (đọc trước)**: file này được viết ở một giai đoạn SỚM của đồ án (khi dữ liệu còn là bản
> mô phỏng đầu tiên). Sau đó dữ liệu và thuật toán đã được sửa nhiều lần theo góp ý giảng viên
> (khoảng cách một phía, thêm khuyến mãi/lượt bán, k tối ưu đổi từ 1 → 7...). Tài liệu **cập nhật
> và đầy đủ nhất** hiện nay là [GIAI_THICH_THUAT_TOAN_KNN.md](GIAI_THICH_THUAT_TOAN_KNN.md) — bắt
> đầu đọc từ đó. File này được GIỮ LẠI vì vẫn còn vài đoạn giải thích code hữu ích (chuẩn bị đặc
> trưng Mô hình A, cách dò tham số bằng GridSearchCV, danh sách test), nhưng 2 điểm sau ĐÃ LỖI
> THỜI so với code hiện tại, đừng dùng khi trả lời hội đồng:
> - Mục 2.3 mô tả "mẹo nhân `sqrt(w)`" — code HIỆN TẠI không dùng mẹo này nữa, mà truyền thẳng một
>   hàm khoảng cách MỘT PHÍA tuỳ biến vào `NearestNeighbors(metric=callable)` (xem
>   [GIAI_THICH_THUAT_TOAN_KNN.md](GIAI_THICH_THUAT_TOAN_KNN.md) mục 4.2 và
>   [ml-service/app/retriever.py:214-229](../ml-service/app/retriever.py)).
> - Mục 1.3 nói `k=1` là tham số tốt nhất — đây là số liệu CŨ trên dữ liệu mô phỏng đầu tiên. Sau
>   khi dữ liệu được làm thực tế hơn (phân khúc chồng lấn, nhiễu gán nhãn hợp lý), tham số tốt
>   nhất hiện tại là `k=7, metric=euclidean, weights=uniform` (xem
>   [KET_QUA_THUC_NGHIEM.md](KET_QUA_THUC_NGHIEM.md) mục 2).

Các liên kết `[...](...)` trong file này trỏ tương đối từ chính thư mục `docs/`; các đường dẫn
code viết dạng chữ thường (vd `app/features.py`) tính từ thư mục `ml-service/`. Xem thêm lý
thuyết gốc ở [04_MO_HINH_KNN.md](04_MO_HINH_KNN.md).

## 0. Vì sao có 2 mô hình kNN, không phải 1?

SmartLap dùng kNN cho **hai việc khác nhau**, dễ nhầm nếu không phân biệt rõ:

| | Mô hình A | Mô hình B |
|---|---|---|
| Tên trong code | `classifier.py` | `retriever.py` |
| Loại bài toán | **Phân lớp** (classification) | **Truy hồi** (nearest-neighbor retrieval) |
| Lớp scikit-learn | `KNeighborsClassifier` | `NearestNeighbors` |
| Input | Đặc trưng của 1 laptop | Vector "nhu cầu lý tưởng" của người dùng |
| Output | Nhãn phân khúc (`OFFICE`/`ULTRABOOK`/`GAMING`/`CREATOR`) | Top-N laptop gần nhất |
| Dùng khi nào | Người dùng chọn "Chưa rõ", hoặc thêm laptop mới cần gợi ý nhãn | Sau khi đã biết phân khúc, tìm máy cụ thể để gợi ý |

Cả hai đều là kNN (cùng công thức khoảng cách), chỉ khác **mục đích dùng k láng giềng để làm gì**:
Mô hình A cho k láng giềng **bỏ phiếu ra 1 nhãn**; Mô hình B trả về **chính k láng giềng đó** làm kết quả.

---

## 1. Mô hình A — kNN phân lớp phân khúc

### 1.1 Chuẩn bị đặc trưng — [`app/features.py`](../ml-service/app/features.py)

kNN đo khoảng cách giữa các điểm, nên **mọi thứ phải là số, cùng thang đo**. Tên CPU/GPU là chuỗi
→ phải quy đổi ra điểm số trước:

```python
# app/features.py — build_bench_lookup() + match_score()
def build_bench_lookup(bench_df: pd.DataFrame) -> dict[str, float]:
    max_raw = bench_df["raw_score"].max()
    lookup: dict[str, float] = {}
    for _, row in bench_df.iterrows():
        score = 100.0 * row["raw_score"] / max_raw   # quy ve thang 0-100
        lookup[normalize_name(row["pattern"])] = score
        lookup[normalize_name(row["display_name"])] = score
    return lookup
```

`normalize_name()` hạ chữ thường, bỏ `(R)`/`(TM)`/`Processor` rồi so khớp chuỗi — để `"Intel Core
i5-12500H"` và `"i5-12500H"` (trong bảng benchmark) khớp được với nhau.

Sau khi có `cpu_score`, `gpu_score` (số), pipeline chuẩn hóa toàn bộ đặc trưng:

```python
# app/features.py — build_model_a_preprocessor()
ColumnTransformer([
    ("log", Pipeline([SimpleImputer, FunctionTransformer(np.log2), StandardScaler]), NUMERIC_LOG),  # ram_gb, ssd_gb
    ("num", Pipeline([SimpleImputer, StandardScaler]), NUMERIC),  # cpu_score, gpu_score, ppi, ...
    ("bin", "passthrough", BINARY),  # gpu_dedicated, srgb_100 (đã là 0/1)
])
```

**Vì sao log trước rồi mới chuẩn hóa (StandardScaler)?** RAM 8→16GB quan trọng ngang 16→32GB (gấp
đôi), không phải "hơn 8GB". Lấy `log2` biến "gấp đôi" thành "cộng thêm 1 đơn vị" — hợp lý hơn cho
khoảng cách Euclidean. Xem thêm docs/03 §5.2.

**Vì sao `price_vnd` KHÔNG có trong `MODEL_A_FEATURES`?** Đây là quyết định thiết kế D-04 (docs/01):
nếu đưa giá vào, mô hình sẽ "học" theo giá thay vì cấu hình thật — hai máy cấu hình giống hệt nhau
nhưng giá khác vẫn phải được phân cùng 1 phân khúc. Xem hằng số:

```python
# app/features.py
MODEL_A_FEATURES = NUMERIC_LOG + NUMERIC + BINARY   # KHONG co price_vnd
MODEL_B_FEATURES = MODEL_A_FEATURES + ["price_vnd"] # Mo hinh B moi can gia
```

### 1.2 Bản thân thuật toán kNN — [`app/classifier.py`](../ml-service/app/classifier.py)

```python
def build_pipeline() -> Pipeline:
    return Pipeline([
        ("prep", build_model_a_preprocessor()),   # buoc 1: chuan hoa (o tren)
        ("knn", KNeighborsClassifier()),           # buoc 2-5: thuat toan kNN that su
    ])
```

`KNeighborsClassifier` của scikit-learn làm đúng 5 bước lý thuyết (docs/04 §2):
1. Chọn `k` (siêu tham số, dò bằng grid search — xem 1.3).
2. Tính khoảng cách từ laptop cần đoán đến **toàn bộ** laptop trong tập huấn luyện.
3. Sắp xếp tăng dần, lấy `k` láng giềng gần nhất.
4. Lấy nhãn phân khúc của `k` láng giềng đó.
5. Bỏ phiếu: `weights="uniform"` → mỗi láng giềng 1 phiếu; `weights="distance"` → láng giềng gần
   hơn có phiếu nặng hơn (`1/khoảng_cách`).

Khoảng cách dùng `metric="euclidean"` hoặc `"manhattan"` — cả hai đều là tham số dò được (bên dưới).

### 1.3 Dò tham số tốt nhất — `grid_search()` trong `classifier.py`

```python
PARAM_GRID = {
    "knn__n_neighbors": list(range(1, 32, 2)),      # k = 1,3,5,...,31 (le de tranh hoa phieu)
    "knn__weights": ["uniform", "distance"],
    "knn__metric": ["euclidean", "manhattan"],
}
search = GridSearchCV(pipe, PARAM_GRID, cv=StratifiedKFold(5, shuffle=True, random_state=42),
                       scoring="f1_macro", n_jobs=-1)
```

Chạy thật: [`app/train.py`](../ml-service/app/train.py) gọi `grid_search()`, thử **tất cả tổ hợp** k ×
weights × metric (16 × 2 × 2 = 64 cấu hình), mỗi cấu hình chạy 5-fold cross-validation, chọn cấu
hình có `f1_macro` trung bình cao nhất. Kết quả hiện tại (dữ liệu mô phỏng):

```
Best params: {'knn__metric': 'euclidean', 'knn__n_neighbors': 1, 'knn__weights': 'uniform'}
```

`k=1` được chọn vì dữ liệu mô phỏng có ranh giới phân khúc quá rõ ràng (xem cảnh báo ở
[ml-service/README.md](../ml-service/README.md)) — **với dữ liệu thật, `k` tối ưu gần như chắc chắn sẽ
lớn hơn 1** (k=1 rất nhạy nhiễu, đây là dấu hiệu dữ liệu giả lập "quá sạch", không phải lỗi code.

### 1.4 Suy phân khúc từ nhu cầu (khi người dùng chọn "Chưa rõ")

[`app/segment_inference.py`](../ml-service/app/segment_inference.py) — không train mô hình mới, mà
**dựng một vector đặc trưng giả định** từ các hoạt động người dùng chọn (`choi_game`, `van_phong`,...),
rồi đưa vector đó qua **Mô hình A đã huấn luyện** ở trên để lấy `predict_proba()`:

```python
def infer_segment(model, catalog, activities):
    vector = build_activity_vector(catalog, activities)   # dung phan vi cua catalog
    proba = model.predict_proba(pd.DataFrame([vector])[MODEL_A_FEATURES])[0]
    ...
```

`build_activity_vector()` tra bảng `ACTIVITY_TARGETS` (vd. `choi_game` → cần `gpu_score` ở phân vị
75, `refresh_hz` ở phân vị 75, `gpu_dedicated=1`) và lấy giá trị **lệch xa trung vị (50) nhất** khi
nhiều hoạt động cùng ảnh hưởng một đặc trưng.

---

## 2. Mô hình B — kNN truy hồi có trọng số

### 2.1 Dựng "hồ sơ lý tưởng" q — `build_ideal_vector()` trong `retriever.py`

Đây là bước dễ hiểu lầm nhất: **q không phải là một laptop có thật**, mà là một điểm trong không
gian đặc trưng được tính từ mức ưu tiên (1–5) người dùng chọn:

```python
PERCENTILE_BY_PRIORITY = {1: 25, 2: 40, 3: 55, 4: 75, 5: 90}

for feat in ["cpu_score", "gpu_score", "ram_gb", "ssd_gb"]:
    p = priorities.get("performance", 3)
    q[feat] = candidates[feat].quantile(PERCENTILE_BY_PRIORITY[p] / 100)
```

Ưu tiên "hiệu năng" càng cao (5) → `q` càng lấy giá trị ở phân vị cao (90%) của **tập ứng viên đã
lọc cứng** (`candidates`, không phải toàn catalog). Với `weight_kg` (nhẹ = tốt), logic đảo ngược:
`quantile(100 - p)`. Với giá, công thức nội suy tuyến tính giữa min/max ngân sách theo mức ưu tiên
tiết kiệm.

### 2.2 Trọng số đặc trưng — `build_weights()`

```python
BASE_WEIGHT_BY_SEGMENT = {
    "GAMING": {"performance": 1.3, "mobility": 0.7, "display": 1.0, "price": 1.0},
    ...
}
def build_weights(priorities, segment):
    base = BASE_WEIGHT_BY_SEGMENT[segment]
    for group, feats in GROUPS.items():           # vd "performance": [cpu_score, gpu_score, ram_gb, ssd_gb]
        w_group = priorities[group] * base[group]  # muc uu tien nguoi dung x trong so mac dinh phan khuc
        for f in feats:
            raw[f] = w_group / len(feats)           # chia deu cho cac dac trung trong nhom
    return {k: v / sum(raw.values()) for k, v in raw.items()}   # chuan hoa tong = 1
```

### 2.3 kNN có trọng số — vì sao nhân `sqrt(w)` chứ không nhân `w`?

Đây là điểm hay bị hỏi khi bảo vệ. Công thức khoảng cách Euclidean có trọng số:

```
d_w(x, q) = sqrt( Σ wⱼ (xⱼ - qⱼ)² )
```

scikit-learn's `NearestNeighbors` chỉ tính Euclidean **không trọng số**: `sqrt(Σ (xⱼ - qⱼ)²)`. Để
"lừa" nó tính đúng công thức có trọng số mà không phải tự viết lại thuật toán kNN, ta nhân từng cột
đặc trưng với `sqrt(wⱼ)` **trước khi** đưa vào kNN:

```python
# app/retriever.py — recommend()
sqrt_w = np.sqrt(w)
nn = NearestNeighbors(n_neighbors=n_neighbors, metric="euclidean")
nn.fit(Xs * sqrt_w)              # nhan moi cot voi sqrt(w)
dist, idx = nn.kneighbors(qs * sqrt_w)
```

Vì sao đúng? Khai triển:
`Euclidean(x·√w, q·√w) = sqrt(Σ (xⱼ√wⱼ - qⱼ√wⱼ)²) = sqrt(Σ wⱼ(xⱼ-qⱼ)²) = d_w(x, q)` — **chính xác
công thức có trọng số**. Đây là mẹo toán học chuẩn, không phải xấp xỉ.

`match_pct()` đổi khoảng cách thành phần trăm dễ hiểu cho người dùng: `100 · e^(-distance/τ)` với
`τ` = trung vị khoảng cách trong lần truy vấn đó (càng gần 0 → càng gần 100%).

### 2.4 "Laptop tương tự" (item-item) — `similar_items()`

Cùng cơ chế `NearestNeighbors`, nhưng **query = chính vector của laptop đang xem** (không phải hồ
sơ lý tưởng), trọng số đều nhau (không nhân `sqrt_w`), rồi bỏ kết quả đầu tiên (luôn là chính nó,
khoảng cách 0):

```python
dist, idx = nn.kneighbors(Xs[laptop_idx : laptop_idx + 1])
return dist[0][1:], idx[0][1:]   # bo phan tu dau (chinh no)
```

### 2.5 Giải thích kết quả — [`app/explain.py`](../ml-service/app/explain.py)

`build_explanation()` không phải AI sinh văn bản — nó là **luật if/else dựa trên chênh lệch giữa
laptop thật và vector lý tưởng q**, trả về mã code (`gpu_dedicated`, `perf_above`, `weight_over`,...)
kèm tham số. Frontend (`frontend/src/utils/explainText.ts`) mới là nơi dịch mã đó thành câu tiếng
Việt hoàn chỉnh — tách riêng để dễ kiểm thử (so mã, không so chuỗi) và dễ đổi ngôn ngữ sau này.

---

## 3. Cách kiểm tra thuật toán chạy đúng

### 3.1 Chạy bộ test tự động (nhanh nhất, nên làm trước)

```bash
cd ml-service
pytest -v
```

9 test hiện có, mỗi test chặn đúng 1 loại lỗi kNN hay gặp — xem file trong `ml-service/tests/`:

| Test | File | Chặn lỗi gì |
|---|---|---|
| `test_scaler_inside_pipeline` | `test_classifier.py` | Scaler bị fit ngoài pipeline → rò rỉ dữ liệu khi cross-validate |
| `test_price_not_in_classifier` | `test_classifier.py` | Ai đó vô tình thêm `price_vnd` vào đặc trưng Mô hình A (vi phạm D-04) |
| `test_reproducible` | `test_classifier.py` | Cùng seed 42 nhưng train ra kết quả khác nhau (code có random không kiểm soát) |
| `test_scale_invariance` | `test_classifier.py` | Đổi đơn vị giá VND↔nghìn VND làm đổi kết quả phân lớp (giá không được ảnh hưởng) |
| `test_identity_top1` | `test_retriever.py` | Truy vấn đúng bằng vector của chính 1 máy → máy đó phải ra hạng 1, khoảng cách ≈ 0 |
| `test_weight_changes_ranking` | `test_retriever.py` | Tăng ưu tiên "di động" nhưng top-5 không hề nhẹ hơn → trọng số bị tính sai |
| `test_budget_hard_constraint` | `test_retriever.py` | Có kết quả vượt ngân sách tối đa dù đã lọc cứng trước |
| `test_explanation_schema` | `test_retriever.py` | Có kết quả không có nổi 1 điểm mạnh nào để giải thích |
| `test_personas` | `test_personas.py` | Mô phỏng cả 30 persona qua đúng luồng (suy phân khúc → lọc cứng → Mô hình B), yêu cầu ≥ 90% đạt `expect` |

Muốn hiểu sâu hơn 1 test, mở file tương ứng — mỗi test dài 5–20 dòng, đọc trực tiếp là hiểu ngay.

### 3.2 Tự kiểm tra bằng tay (hiểu cặn kẽ từng bước)

```bash
cd ml-service
python -c "
import pandas as pd
from app.features import enrich_catalog, MODEL_A_FEATURES
from app.classifier import build_pipeline

catalog = pd.read_csv('../data/processed/catalog_vn.csv')
cpu = pd.read_csv('../data/processed/cpu_benchmark.csv')
gpu = pd.read_csv('../data/processed/gpu_benchmark.csv')
df = enrich_catalog(catalog, cpu, gpu)

pipe = build_pipeline()
pipe.set_params(knn__n_neighbors=5, knn__weights='distance', knn__metric='euclidean')
pipe.fit(df[MODEL_A_FEATURES], df['segment'])

# Lay 1 may GAMING, xem 5 lang gieng gan nhat va nhan cua no
sample = df[df['segment'] == 'GAMING'].iloc[[0]]
knn = pipe.named_steps['knn']
Xs = pipe.named_steps['prep'].transform(sample[MODEL_A_FEATURES])
dist, idx = knn.kneighbors(Xs, n_neighbors=5)
print('Nhan that:', sample['segment'].values[0])
print('5 lang gieng:', df.iloc[idx[0]]['segment'].tolist())
print('Khoang cach:', dist[0].round(3).tolist())
print('Du doan:', pipe.predict(sample[MODEL_A_FEATURES])[0])
"
```

Kỳ vọng: nhãn 5 láng giềng phần lớn là `GAMING`, khoảng cách tăng dần (đã sắp xếp), và dự đoán khớp
nhãn thật. Nếu không khớp → có thể catalog có nhiễu, hoặc `k` chưa phù hợp.

### 3.3 Xem báo cáo huấn luyện đầy đủ

```bash
python -m app.train
```

Sinh ra `ml-service/artifacts/<version>/`:
- `metadata.json` — tham số tốt nhất, macro-F1 CV/test, confusion matrix (dạng số), so sánh baseline
- `confusion_matrix.png` — ảnh trực quan: hàng = nhãn thật, cột = nhãn dự đoán, đường chéo càng đậm
  càng tốt (dự đoán đúng); ô ngoài đường chéo là nhầm lẫn (vd hàng GAMING cột CREATOR = số máy Gaming
  bị đoán nhầm thành Creator)
- `k_curve.png` — trục X là k, trục Y là macro-F1 trung bình CV; đường cong nên có 1 đỉnh rõ ràng ở
  vùng k vừa phải (k=1 hoàn hảo trên dữ liệu mô phỏng là dấu hiệu bất thường, xem mục 1.3)

```bash
python -m app.ablation
```

In ra bảng so sánh: có/không `StandardScaler`, bỏ từng đặc trưng, đổi Manhattan↔Euclidean, và 3
cách xử lý mất cân bằng lớp (`uniform`/`distance`/`RandomOverSampler`). Dùng bảng này để trả lời câu
"sao biết chuẩn hóa là cần thiết?" — xem `experiments.json` trong thư mục artifact mới nhất.

### 3.4 Kiểm tra qua API thật (từ backend đến ML service)

```bash
# Dam bao ML service (8001) va backend (4000) dang chay
curl -X POST http://localhost:4000/api/recommendations -H "Content-Type: application/json" -d '{
  "segment": "GAMING",
  "activities": [],
  "budget": {"min": 15000000, "max": 30000000},
  "priorities": {"performance": 5, "mobility": 1, "display": 3, "price": 3},
  "must": {}, "topN": 5
}'
```

Đổi `priorities.mobility` từ 1 → 5, chạy lại, so sánh `weightKg` trung bình của 5 máy trả về — phải
**giảm** (đúng như `test_weight_changes_ranking` kiểm tra). Đây là cách nhanh nhất để "cảm nhận" kNN
có trọng số hoạt động thật, không phải chỉ tin vào test.

---

## 4. Câu hỏi hay gặp khi bảo vệ

**"Sao không dùng if-else phân loại luôn, cần gì kNN?"** → Xem bảng so sánh baseline luật trong
`ml-service/README.md`: luật thủ công (`gpu_dedicated & refresh≥120 → GAMING`, ...) cứng nhắc, không
học được ranh giới mờ giữa các phân khúc trên dữ liệu thật có nhiễu; kNN tổng quát hóa tốt hơn khi
dữ liệu không rơi đúng vào các ngưỡng luật đặt ra.

**"k=1 có phải overfitting không?"** → Đúng, và đây là hạn chế đã biết của **dữ liệu mô phỏng**
(mục 1.3), không phải lỗi thuật toán. Cross-validation (5-fold) đáng lẽ phải phạt k=1 nếu dữ liệu
có nhiễu thật; catalog VN thật sẽ có nhiễu tự nhiên (2 máy cấu hình giống hệt nhưng khác phân khúc
do nhà bán lẻ xếp loại khác nhau) khiến k tối ưu tăng lên.

**"Tại sao Mô hình B không dùng `KNeighborsClassifier` luôn cho tiện?"** → Vì Mô hình B không phân
lớp — nó cần **trả về chính các máy láng giềng** (kèm khoảng cách) để xếp hạng và giải thích, không
cần bỏ phiếu ra 1 nhãn. Đó là lý do dùng `NearestNeighbors` (chỉ tìm láng giềng) thay vì
`KNeighborsClassifier`/`KNeighborsRegressor`.
