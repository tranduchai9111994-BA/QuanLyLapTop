# 03 — Dữ liệu và tiền xử lý

## 1. Tổng quan nguồn dữ liệu

Catalog hiện tại là **dữ liệu tổng hợp có logic** (không phải thu thập thủ công từ nhà bán lẻ, không dùng thêm bộ dữ liệu ngoài như Kaggle). Toàn bộ được sinh bằng `data/generate_catalog.py` (`RANDOM_STATE = 42` để tái lập được), theo các ràng buộc mô phỏng đúng thị trường thay vì random thuần:

- **1000 dòng**, mỗi lần sinh có thể thay đổi phân bố nhẹ vì có thành phần nhiễu ngẫu nhiên, nhưng seed cố định nên chạy lại đúng script cho kết quả giống hệt.
- **12 hãng** (`BRANDS`), mỗi hãng có `brand_tier` (1–5) và hệ số nhân giá (`price_mult`): Apple (tier 5, ×1.45), Dell (5, ×1.15), LG (4, ×1.20), Lenovo (4, ×1.05), HP (4, ×1.04), ASUS (4, ×1.00), MSI (3, ×1.02), Acer (3, ×0.90), Gigabyte (3, ×0.95), Huawei (3, ×0.98), Masstel (1, ×0.78), Avita (1, ×0.80).
- **28 mẫu CPU** và **21 mẫu GPU** với điểm PassMark tham chiếu thật (CPU Mark / G3D Mark), phân theo tier (entry/U/P/H/Apple Silicon…). Hàm `gpu_compatible()` chặn các tổ hợp phi thực tế: Apple Silicon chỉ đi với GPU Apple, iGPU phải cùng hãng CPU, GPU rời yêu cầu CPU đạt tier tối thiểu, CPU tier entry không được ghép GPU rời.
- **Kiến trúc máy** (`pick_archetype`) chọn theo trọng số: budget_office 0.26, mainstream 0.20, thin_light 0.15, gaming_entry 0.15, gaming_high 0.10, creator 0.09, workstation 0.05. RAM/SSD được chọn theo 3 ngưỡng điểm CPU (11000/18000/25000) — máy càng mạnh càng có xác suất RAM/SSD cao hơn.
- **Giá** (`price_vnd`): `base_cost = cpu_cost + gpu_cost + ram_cost(0,18 tr/GB) + ssd_cost(0,0022 tr/GB) + screen_cost + chassis_cost`, nhân với `brand_mult × noise(N(1.0, 0.07), tối thiểu 0.85) × 1.38` (hệ số bán lẻ/VAT), làm tròn 10.000đ, sàn 5.500.000đ. 35% số máy có khuyến mãi (`original_price_vnd` cao hơn `price_vnd` 5–25%). `sales_count` tương quan với `value_index`, `brand_tier`, tình trạng khuyến mãi và nhiễu Gauss.
- **Gán nhãn phân khúc** (`assign_segment`): tính 4 điểm số có trọng số (gaming/creator/ultrabook/office) từ `cpu_score`, `gpu_score`, `gpu_dedicated`, `refresh_hz`, `weight_kg`, `srgb_100`, `ppi`, `ram_gb`, `price_vnd`, cộng nhiễu Gaussian `N(0, 0.32)` rồi lấy `argmax`. Cách này **cố ý tạo chồng lấn tự nhiên** giữa các phân khúc liền kề (thay vì luật if-else tách bạch tuyệt đối), đúng theo góp ý cần dữ liệu "khó" hơn để chứng minh giá trị của kNN so với luật cứng.
- `series` (dòng máy hiển thị, ví dụ "Gram Pro", "Legion") được gán **sau khi** đã có `segment`, chọn từ đúng nhóm series phù hợp phân khúc đó — tránh lỗi tên dòng máy văn phòng bị gắn nhãn Gaming.

Việc dùng dữ liệu tổng hợp là lựa chọn thực tế cho quy mô đồ án: cho phép sinh đủ số mẫu mỗi lớp (mọi phân khúc đều ≥ 100 mẫu, vượt xa mốc tối thiểu 50/lớp) và tránh rủi ro pháp lý khi crawler dữ liệu nhà bán lẻ. Hạn chế cần nêu rõ khi bảo vệ: dữ liệu không phải giá/cấu hình thị trường thật 100%, và chưa có bước gán nhãn độc lập hai người (Cohen's kappa) vì không có bước gán nhãn thủ công trên dữ liệu thật.

### 1.1 Các file dữ liệu

| File | Vai trò |
|---|---|
| `data/generate_catalog.py` | Script sinh catalog tổng hợp (nguồn của mọi file bên dưới) |
| `data/raw/catalog_vn_raw.xlsx` | Catalog thô, 1000 dòng, đúng cột ở mục 2 |
| `data/processed/catalog_vn.csv` | Bản đã có `segment`, `discount_percent`/giá gốc, `sales_count` — dùng huấn luyện Mô hình A và B |
| `data/processed/cpu_benchmark.csv`, `data/processed/gpu_benchmark.csv` | Điểm PassMark tham chiếu (CPU Mark / G3D Mark) cho từng mẫu CPU/GPU dùng trong catalog |
| `data/personas/personas.json` | 30 hồ sơ nhu cầu kiểm thử (script `data/generate_personas.py`), **không** dùng để huấn luyện |
| `data/need_phrases.json` | 132 câu tiếng Việt viết tay, dữ liệu huấn luyện Mô hình C (TF-IDF + kNN) |

## 2. Cột dữ liệu catalog (`catalog_vn.csv` / `catalog_vn_raw.xlsx`)

| Cột | Kiểu | Ghi chú |
|---|---|---|
| `sku` | text | Duy nhất, kiểm tra trùng ở `data_check.py` |
| `brand` | text | 1 trong 12 hãng ở mục 1 |
| `name`, `series` | text | Tên hiển thị, dòng máy |
| `cpu_model` | text | Tra `cpu_benchmark.csv` |
| `gpu_model` | text | Tra `gpu_benchmark.csv`; iGPU ghi đúng tên (vd Intel Iris Xe) |
| `ram_gb`, `ssd_gb` | int | |
| `screen_inch` | float | |
| `resolution` | text | Dạng `WxH`, dùng tính `ppi` |
| `refresh_hz` | int | Thiếu → mặc định 60 khi làm giàu đặc trưng |
| `srgb_100` | bool (0/1) | 1 nếu công bố ≥ 100% sRGB hoặc DCI-P3 |
| `weight_kg`, `battery_wh` | float | |
| `price_vnd`, `original_price_vnd` | int | Giá hiện tại / giá gốc trước khuyến mãi (nếu có) |
| `sales_count` | int | Số lượt bán mô phỏng, dùng tính `sales_score` |
| `brand_tier` | int (1–5) | Uy tín thương hiệu, ảnh hưởng `value_index` hiển thị và Mô hình B |
| `segment` | text | Nhãn phân khúc: `OFFICE` / `ULTRABOOK` / `GAMING` / `CREATOR` |

## 3. Bảng benchmark CPU / GPU

`data/processed/cpu_benchmark.csv` và `gpu_benchmark.csv` có các cột `pattern`, `display_name`, `raw_score` (điểm PassMark thô: CPU Mark cho CPU, G3D Mark cho GPU), `source`; `gpu_benchmark.csv` còn có cột `dedicated` (0/1) nếu có sẵn.

- `build_bench_lookup()` ([ml-service/app/features.py:63](../ml-service/app/features.py)) quy đổi điểm thô về thang 0–100: `score = 100 × raw_score / max(raw_score)` trên toàn bảng — máy mạnh nhất trong bảng benchmark được 100 điểm.
- Khớp tên (`match_score()`, [features.py:83](../ml-service/app/features.py)): chuẩn hoá chuỗi bằng `normalize_name()` (viết thường, bỏ `"(r)"`, `"(tm)"`, `"processor"`, gọn khoảng trắng), khớp chính xác trước, nếu không có thử khớp một phần (chuỗi trong catalog chứa `pattern` hoặc ngược lại). Không khớp được → `enrich_catalog()` raise `ValueError` liệt kê toàn bộ tên CPU/GPU không khớp — **không tự đoán mò**.
- `gpu_dedicated`: ưu tiên cột `dedicated` thật trong `gpu_benchmark.csv` nếu có; nếu bảng cũ chưa có cột này thì suy từ từ khoá trong tên GPU (`geforce`, `radeon rx`, `rtx`, `quadro`, `arc a` → `is_gpu_dedicated()`, [features.py:102](../ml-service/app/features.py)).

## 4. Làm giàu đặc trưng — `enrich_catalog()` ([ml-service/app/features.py:120](../ml-service/app/features.py))

Hàm bắt buộc chạy trước khi đưa dữ liệu vào bất kỳ mô hình kNN nào (`train.py`, `evaluate.py`, và `main.py` lúc `/catalog/sync`). Từ catalog thô, tính thêm:

| Cột sinh ra | Công thức / cách tính |
|---|---|
| `cpu_score`, `gpu_score` | Tra bảng benchmark, thang 0–100 (mục 3) |
| `gpu_dedicated` | 0/1, ưu tiên cột `dedicated` thật (mục 3) |
| `ppi` | `compute_ppi()`: `sqrt(w² + h²) / screen_inch`, `w, h` lấy từ `resolution` |
| `refresh_hz` | Thiếu → 60 |
| `battery_wh` | Thiếu → trung vị **theo từng phân khúc** (`groupby("segment").transform(median)`), không lấy trung vị chung toàn catalog |
| `brand_tier` | Catalog cũ thiếu cột → mặc định 3 (tương thích ngược) |
| `performance_index` | `0,5·cpu_score + 0,35·gpu_score + 0,1·(100·ram_norm) + 0,05·(100·ssd_norm)`, thang 0–100 — chỉ số **hiển thị**, không đưa vào mô hình |
| `value_index` | `performance_index / (price_vnd / 1.000.000)` — "hiệu năng trên mỗi triệu đồng", dùng cho huy hiệu "Đáng tiền nhất" **và** là một đặc trưng thật trong Mô hình B |
| `discount_percent` | `(original_price_vnd − price_vnd) / original_price_vnd × 100`, không có khuyến mãi → 0 |
| `sales_score` | `100 × log1p(sales_count) / max(log1p(sales_count))` — log hoá vì lượt bán lệch phải mạnh (vài máy bán rất chạy, đa số còn lại ít) |

## 5. Tập đặc trưng đưa vào mô hình

| Đặc trưng | Biến đổi | Mô hình A | Mô hình B |
|---|---|---|---|
| `ram_gb`, `ssd_gb` | log2 → StandardScaler | ✅ | ✅ |
| `cpu_score`, `gpu_score`, `screen_inch`, `ppi`, `refresh_hz`, `weight_kg`, `battery_wh` | StandardScaler | ✅ | ✅ |
| `gpu_dedicated`, `srgb_100` | passthrough (đã là 0/1) | ✅ | ✅ |
| `price_vnd`, `brand_tier`, `value_index`, `discount_percent`, `sales_score` | StandardScaler (qua `fit_scaler` của Mô hình B) | ❌ | ✅ |

`MODEL_A_FEATURES = NUMERIC_LOG + NUMERIC + BINARY` ([features.py:35](../ml-service/app/features.py)); `MODEL_B_FEATURES = MODEL_A_FEATURES + ["price_vnd", "brand_tier", "value_index", "discount_percent", "sales_score"]` ([features.py:44](../ml-service/app/features.py)).

**`price_vnd` cố ý không có mặt trong Mô hình A** (quyết định thiết kế D-04, được test `test_price_not_in_classifier` chặn tái phát): nếu đưa giá vào, mô hình sẽ "học" phân khúc theo giá thay vì theo cấu hình thật — hai máy cùng cấu hình nhưng khác giá vẫn phải cùng phân khúc. Giá chỉ tham gia xếp hạng ở Mô hình B.

### 5.1 Vì sao phải chuẩn hoá

kNN dựa trên khoảng cách. Không chuẩn hoá thì `price_vnd` (hàng chục triệu) và `ssd_gb` (hàng trăm) sẽ lấn át hoàn toàn `weight_kg` (1–3 kg). Dùng `log2` cho `ram_gb`/`ssd_gb` vì chênh 8→16 GB có ý nghĩa ngang 16→32 GB (cùng là gấp đôi), không phải bằng 1/2 giá trị tuyệt đối.

### 5.2 Pipeline thật — `build_model_a_preprocessor()` ([features.py:225](../ml-service/app/features.py))

```python
ColumnTransformer([
    ("log", Pipeline([
        ("impute", SimpleImputer(strategy="median")),
        ("log", FunctionTransformer(np.log2, feature_names_out="one-to-one")),
        ("sc", StandardScaler()),
    ]), NUMERIC_LOG),        # ram_gb, ssd_gb
    ("num", Pipeline([
        ("impute", SimpleImputer(strategy="median")),
        ("sc", StandardScaler()),
    ]), NUMERIC),            # cpu_score, gpu_score, screen_inch, ppi, refresh_hz, weight_kg, battery_wh
    ("bin", "passthrough", BINARY),   # gpu_dedicated, srgb_100
])
```

Bước này nằm **trong** `Pipeline` của Mô hình A ([ml-service/app/classifier.py:41](../ml-service/app/classifier.py)) để `StandardScaler`/`SimpleImputer` chỉ được `fit` trên tập train ở mỗi fold cross-validation — tránh rò rỉ dữ liệu (data leakage). Với Mô hình B, chuẩn hoá dùng `fit_scaler()` ([ml-service/app/retriever.py:81](../ml-service/app/retriever.py)) — một `StandardScaler` đơn fit trên toàn catalog hiện hành (không cross-validate, vì đây là bài toán truy hồi không có nhãn).

Thiếu dữ liệu vượt 10% một cột → `data_check.py` báo lỗi, không tự động loại cột.

## 6. Persona và câu nhu cầu tự do (dữ liệu kiểm thử, không dùng để huấn luyện Mô hình A/B)

- `data/personas/personas.json`: 30 hồ sơ nhu cầu (sinh bởi `data/generate_personas.py`), mỗi hồ sơ có ràng buộc kiểm chứng được (`expect`), dùng cho `ml-service/tests/test_personas.py` và `test_priority_sensitivity.py`, đo tỷ lệ persona đạt kỳ vọng.
- `data/need_phrases.json`: 132 câu tiếng Việt viết tay gắn nhãn 1 trong 6 nhóm nhu cầu (`VAN_PHONG`, `HOC_TAP`, `LAP_TRINH`, `DO_HOA`, `GAMING`, `DI_DONG`) — **đây mới là dữ liệu huấn luyện thật** của Mô hình C (kNN phân loại văn bản, xem `docs/04_MO_HINH_KNN.md` và `docs/13_GIAI_THICH_THUAT_TOAN_KNN.md`).

## 7. Kiểm tra chất lượng dữ liệu — `ml-service/app/data_check.py`

Chạy `python -m app.data_check` (từ thư mục `ml-service/`). Kiểm tra trên `data/processed/catalog_vn.csv`:

- Trùng `sku` → lỗi.
- CPU/GPU không khớp bảng benchmark (cùng logic khớp tên ở mục 3) → lỗi, liệt kê tên không khớp.
- Giá ngoài khoảng [5 triệu, 150 triệu] → cảnh báo.
- Trọng lượng ngoài khoảng [0,8; 4,5] kg → cảnh báo.
- `ram_gb` không thuộc {4, 8, 12, 16, 24, 32, 64} → cảnh báo.
- Cột thiếu dữ liệu quá 10% (bỏ qua các cột tuỳ chọn `retailer_category_2`, `image_url`, `label_note`) → lỗi.
- Phân khúc dưới 50 mẫu → cảnh báo. In bảng phân bố số mẫu mỗi phân khúc để đưa vào báo cáo (số liệu cụ thể xem `docs/14_KET_QUA_THUC_NGHIEM.md`, vì catalog có thể tái sinh và số liệu thay đổi nhẹ mỗi lần chạy `generate_catalog.py`).
