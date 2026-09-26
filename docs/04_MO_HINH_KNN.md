# 04 — Mô hình kNN

## 1. Tổng quan luồng khuyến nghị

```
Nhu cầu người dùng (wizard)
        │
        ▼
[1] Dựng hồ sơ nhu cầu ──► [2] Mô hình A: kNN phân lớp
        │                         → phân khúc + độ tin cậy
        ▼
[3] Lọc cứng (ngân sách, bắt buộc, loại/ghim) ── backend
        │
        ▼
[4] Dựng vector lý tưởng q trong phân khúc
        │
        ▼
[5] Mô hình B: kNN truy hồi, Euclidean có trọng số
        │
        ▼
[6] Xếp hạng + huy hiệu + giải thích tiếng Việt
```

## 2. Cơ sở lý thuyết (đoạn đưa vào báo cáo C2)

kNN (Fix & Hodges, 1951; Cover & Hart, 1967) phân lớp một mẫu mới dựa trên k mẫu huấn luyện gần nhất. Theo slide C2, thuật toán gồm 5 bước: (1) chọn k; (2) tính khoảng cách từ điểm truy vấn đến mọi mẫu huấn luyện; (3) sắp xếp tăng dần, lấy k láng giềng; (4) lấy nhãn của k láng giềng; (5) bỏ phiếu theo đa số.

Khoảng cách dùng trong đề tài:
- Euclidean: `d(x, y) = √Σ (xᵢ − yᵢ)²`
- Manhattan: `d(x, y) = Σ |xᵢ − yᵢ|`
- Euclidean có trọng số (Mô hình B): `d_w(x, q) = √Σ wⱼ (xⱼ − qⱼ)²`, Σ wⱼ = 1

Biến thể bỏ phiếu theo khoảng cách (`weights="distance"`): láng giềng gần hơn có phiếu nặng hơn, trọng số 1/d.

## 3. Mô hình A — kNN phân lớp phân khúc

### 3.1 Mục đích sử dụng
1. Gợi ý phân khúc cho laptop mới nhập (FR-09).
2. Suy ra phân khúc từ nhu cầu khi người dùng chọn "Chưa rõ" (FR-01).
3. Phát hiện nhãn đáng ngờ: mẫu có nhãn khác hẳn đa số láng giềng → đưa vào hàng đợi duyệt.

### 3.2 Cấu hình

```python
pipe = Pipeline([
    ("prep", preprocess),                   # 03 §5.3
    ("knn", KNeighborsClassifier()),
])
param_grid = {
    "knn__n_neighbors": list(range(1, 32, 2)),   # 1,3,...,31 (lẻ để giảm hòa phiếu)
    "knn__weights": ["uniform", "distance"],
    "knn__metric": ["euclidean", "manhattan"],
}
search = GridSearchCV(pipe, param_grid,
                      cv=StratifiedKFold(5, shuffle=True, random_state=42),
                      scoring="f1_macro", n_jobs=-1, return_train_score=True)
```

### 3.3 Tách dữ liệu (D-05)
- `train_test_split(test_size=0.2, stratify=y, random_state=42)`.
- Grid search chỉ trên 80% train. 20% test chỉ chạm **một lần** ở cuối.
- Tập test phiên bản đầu tiên được **đóng băng** thành `golden_test.csv` để so sánh công bằng mọi phiên bản sau (09 §2.3).

### 3.4 Vì sao macro-F1
Lớp CREATOR ít mẫu. Accuracy có thể cao dù mô hình bỏ qua lớp nhỏ; macro-F1 lấy trung bình đều giữa các lớp nên phạt việc đó.

### 3.5 Suy ra phân khúc từ nhu cầu
Ánh xạ hoạt động → giá trị đặc trưng mục tiêu (bảng tri thức `activity_profiles`, admin chỉnh được):

| Hoạt động | Ảnh hưởng tới vector nhu cầu |
|---|---|
| `choi_game` | gpu_score ≥ P75 toàn catalog, refresh_hz ≥ 144, gpu_dedicated = 1 |
| `do_hoa`, `dung_video` | srgb_100 = 1, cpu_score ≥ P75, ram ≥ 16, gpu ≥ P60 |
| `di_chuyen_nhieu` | weight_kg ≤ P25, battery_wh ≥ P75 |
| `van_phong`, `hoc_tap` | giá trị trung vị |
| `lap_trinh` | cpu ≥ P60, ram ≥ 16 |

Các hoạt động được gộp bằng cách lấy giá trị "đòi hỏi cao nhất" cho từng đặc trưng; đặc trưng không bị hoạt động nào tác động lấy trung vị. Vector thu được đưa qua Mô hình A → `predict_proba`.

## 4. Mô hình B — kNN truy hồi có trọng số

### 4.1 Dựng vector lý tưởng q
Cho phân khúc s, tập ứng viên C_s (đã qua lọc cứng), mức ưu tiên p ∈ {1..5}:

Mức ưu tiên → phân vị trong C_s: `{1: 25, 2: 40, 3: 55, 4: 75, 5: 90}`

| Nhóm ưu tiên | Đặc trưng | Hướng tốt | q |
|---|---|---|---|
| Hiệu năng | cpu_score, gpu_score, ram_gb, ssd_gb | cao | phân vị(p) |
| Di động & pin | weight_kg | thấp | phân vị(100 − p) |
| | battery_wh | cao | phân vị(p) |
| Màn hình | ppi, refresh_hz, srgb_100 | cao | phân vị(p); srgb_100 = 1 nếu p ≥ 4 |
| Tiết kiệm chi phí | price_vnd | thấp | `Bmin + (1 − (p−1)/4 · 0,7)·(Bmax − Bmin)` |
| (không nhóm) | screen_inch | — | trung vị C_s |

Yêu cầu bắt buộc đẩy q lên: `q_ram = max(q_ram, ram_min)`.
Ví dụ: ưu tiên giá mức 1 → q giá ≈ Bmax; mức 5 → q giá ≈ Bmin + 0,3·(Bmax − Bmin).

### 4.2 Trọng số đặc trưng
- Trọng số nhóm `W_g = p_g × base_g(s)` với `base_g(s)` là trọng số mặc định theo phân khúc (bảng tri thức, ví dụ Gaming: hiệu năng 1,3; Mỏng nhẹ: di động 1,4).
- Trọng số nhóm chia đều cho đặc trưng trong nhóm; `screen_inch` cố định 0,05; chuẩn hóa Σ w = 1.

### 4.3 Cài đặt
```python
Xs = prep_B.transform(C_s)                     # z-score, fit trên toàn catalog
qs = prep_B.transform(q_df)
sqrt_w = np.sqrt(w)
nn = NearestNeighbors(n_neighbors=min(N, len(C_s)), metric="euclidean")
nn.fit(Xs * sqrt_w)                            # nhân cột với √w ⇒ Euclidean có trọng số
dist, idx = nn.kneighbors(qs * sqrt_w)
match_pct = 100 * np.exp(-dist / tau)          # tau = trung vị khoảng cách, hiệu chỉnh trên persona
```
Catalog ~300 máy → brute force đủ nhanh (< 5 ms). Khi lớn hơn có thể dùng KD-tree / Ball-tree (nêu trong phần hướng phát triển).

### 4.4 Ghim / loại
- Máy bị loại: bỏ khỏi C_s trước bước 4.3.
- Máy được ghim: nếu thỏa ràng buộc và chưa có trong top-N → chèn vào vị trí cuối, gắn nhãn "Đề xuất từ cửa hàng" (minh bạch, không giả làm kết quả AI).

### 4.5 Laptop tương tự (item-item)
Cùng `prep_B`, trọng số đều, truy vấn là chính vector của máy đang xem, `n_neighbors = 7`, bỏ phần tử đầu (chính nó).

## 5. Lựa chọn k và các vấn đề kỹ thuật

### 5.1 Chọn k
- k nhỏ (1–3): nhạy nhiễu, overfit. k lớn: làm mờ ranh giới, thiên về lớp đông.
- Vẽ đường cong **macro-F1 trung bình CV theo k** (train và validation) → chọn điểm cao nhất; nếu chênh < 0,01 thì chọn k lớn hơn (mô hình mượt hơn). Biểu đồ này đưa vào báo cáo và màn Mô hình.

### 5.2 Lời nguyền số chiều
11 đặc trưng là ít, khoảng cách còn ý nghĩa (Beyer và cộng sự, 1999). Không thêm đặc trưng mã hóa one-hot hãng máy vào Mô hình A vì làm tăng chiều và gây thiên lệch theo hãng.

### 5.3 Mất cân bằng lớp
So sánh 3 cấu hình trên CV, chọn tốt nhất theo macro-F1:
1. Không xử lý.
2. `weights="distance"`.
3. `RandomOverSampler` (imblearn) **đặt trong pipeline** để chỉ nhân bản trong fold train, fold validation giữ nguyên mẫu thật (He & Garcia, 2009).

## 6. Đánh giá

### 6.1 Mô hình A

| Chỉ số | Mục tiêu |
|---|---|
| Macro-F1 trên test | ≥ 0,75 (catalog VN) |
| Vượt baseline đa số | ≥ +0,30 macro-F1 |
| Vượt baseline luật | ≥ +0,05 macro-F1 |
| Recall từng lớp | ≥ 0,6 |

Baseline:
- `DummyClassifier(strategy="most_frequent")`.
- Luật thủ công: `gpu_dedicated & refresh ≥ 120 → GAMING`; `srgb_100 & cpu ≥ P70 → CREATOR`; `weight ≤ 1,4 → ULTRABOOK`; còn lại OFFICE. (Bảng so sánh này trả lời câu "sao không dùng if-else?")

Đầu ra bắt buộc: bảng tham số tốt nhất, classification report, confusion matrix (ảnh + JSON), đường cong k, bảng baseline.

> Nếu không đạt mục tiêu, báo cáo trung thực con số và phân tích nhầm lẫn giữa lớp nào (thường là GAMING ↔ CREATOR). Hội đồng đánh giá cao phân tích hơn con số đẹp.

### 6.2 Mô hình B

| Chỉ số | Cách đo | Mục tiêu |
|---|---|---|
| Kiểm tra đồng nhất | Truy vấn bằng chính vector một máy → máy đó hạng 1 | 100% |
| Segment precision@5 | Leave-one-out: mỗi máy làm truy vấn (trọng số đều), tỷ lệ 5 láng giềng cùng phân khúc | ≥ 0,7 |
| Tuân thủ ngân sách | Mọi kết quả ≤ Bmax (hoặc ≤ 1,1·Bmax khi có thông báo nới) | 100% |
| Tỷ lệ persona đạt | 30 persona, đạt khi thỏa toàn bộ `expect` | ≥ 90% |
| Tỷ lệ 👍 trực tuyến | Từ telemetry | ≥ 50% |

### 6.3 Thí nghiệm cắt bỏ (ablation)
| Biến thể | Kỳ vọng |
|---|---|
| Không StandardScaler | Macro-F1 giảm mạnh — minh chứng 03 §5.2 |
| Bỏ `refresh_hz` | GAMING recall giảm |
| Bỏ `srgb_100` | CREATOR recall giảm |
| Manhattan thay Euclidean | So sánh |

### 6.4 Thí nghiệm đối chứng Kaggle
Chạy nguyên pipeline Mô hình A trên Kaggle (đặc trưng giao nhau). Báo cáo thành một bảng riêng, nhấn mạnh phương pháp tái lập được trên dữ liệu công khai.

## 7. Giải thích (Explanation Facility)

### 7.1 Mô hình A
- "5 trong 7 máy có cấu hình gần nhất là **Gaming** → dự đoán Gaming (71%)." Kèm danh sách 7 láng giềng (tên, nhãn, khoảng cách).
- Độ tin cậy < 0,6 → "Hệ thống chưa chắc chắn, cần nhân viên xác minh."

### 7.2 Mô hình B
Đóng góp của đặc trưng j vào khoảng cách: `cⱼ = wⱼ (xⱼ − qⱼ)² / d²`.
- **Điểm mạnh**: 2 đặc trưng có wⱼ lớn nhất trong số những đặc trưng có cⱼ nhỏ **hoặc** vượt kỳ vọng theo hướng tốt.
- **Lưu ý**: tối đa 2 đặc trưng có cⱼ lớn nhất lệch theo hướng xấu.
- Diễn đạt bằng đơn vị gốc qua mẫu câu:

| Mã | Mẫu câu |
|---|---|
| `perf_above` | "Hiệu năng CPU cao hơn mức bạn cần ({pct}% so với hồ sơ lý tưởng)" |
| `gpu_dedicated` | "Có card đồ họa rời {gpu} — chơi game và dựng hình tốt" |
| `weight_over` | "Nặng {x} kg, hơn mức mong muốn {d} kg" |
| `price_under` | "Rẻ hơn ngân sách tối đa {money}" |
| `ram_low` | "RAM {x} GB, thấp hơn mức đề xuất {y} GB — có thể nâng cấp" (nếu `ram_upgradable`) |
| `display_good` | "Màn {refresh} Hz, {srgb}" |

Hàm `build_explanation()` trả về JSON có cấu trúc (`code`, `params`, `tone: positive|warning`) để frontend tự dựng câu — dễ kiểm thử, dễ dịch.

## 8. Artifact và phiên bản

```
ml-service/artifacts/
└── clf-2026.10.05-01/
    ├── model.joblib         # Pipeline Mô hình A đầy đủ
    ├── retriever.joblib     # prep_B đã fit trên catalog
    └── metadata.json
```
`metadata.json`: `version`, `type`, `trained_at`, `dataset_hash` (SHA-256 file train), `n_samples`, `class_counts`, `best_params`, `cv_f1_macro_mean/std`, `test_metrics`, `golden_metrics`, `feature_list`, `sklearn_version`.

## 9. Kiểm thử bắt buộc (`ml-service/tests/`)

| Test | Chặn lỗi gì |
|---|---|
| `test_scaler_inside_pipeline` | Fit scaler ngoài pipeline (rò rỉ dữ liệu) |
| `test_identity_top1` | Truy vấn bằng vector máy X phải ra X hạng 1 |
| `test_weight_changes_ranking` | Tăng ưu tiên di động → trọng lượng trung bình top-5 phải giảm |
| `test_budget_hard_constraint` | Không kết quả nào vượt Bmax (trừ khi cờ nới bật) |
| `test_price_not_in_classifier` | `price_vnd` không nằm trong `feature_list` Mô hình A (D-04) |
| `test_scale_invariance` | Đổi đơn vị giá VND ↔ nghìn VND không làm đổi thứ hạng |
| `test_personas` | ≥ 90% persona đạt |
| `test_reproducible` | Huấn luyện 2 lần cùng seed → cùng metric |
| `test_explanation_schema` | Mọi kết quả có ≥ 1 điểm mạnh, mã câu hợp lệ |
