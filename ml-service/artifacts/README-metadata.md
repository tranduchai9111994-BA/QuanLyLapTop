# Hướng dẫn đọc metadata.json

Mỗi phiên bản mô hình được lưu ở thư mục `artifacts/clf-YYYY.MM.DD-HHMMSS/`, chứa:
- `model.joblib` — mô hình kNN (fit Pipeline chuẩn hóa + kNN)
- `metadata.json` — tất cả thông tin huấn luyện (tham số, điểm, baseline, k_curve)
- `confusion_matrix.png` — ảnh ma trận nhầm lẫn (dùng slide)
- `k_curve.png` — ảnh đường cong k (dùng slide)

---

## Cách đọc metadata.json

### 1. Chọn phiên bản nào đang dùng?

File `LATEST` chứa tên phiên bản hiện tại (ví dụ `clf-2026.09.27-160831`):

```bash
# Đọc LATEST
cat artifacts/LATEST
# Output: clf-2026.09.27-160831

# Đọc metadata của phiên bản đó
cat artifacts/clf-2026.09.27-160831/metadata.json
```

### 2. Các trường chính trong metadata.json

| Trường | Ý nghĩa | Giá trị ví dụ | Dùng để |
|---|---|---|---|
| **version** | Tên phiên bản (ngày giờ) | `clf-2026.09.27-160831` | Tra cứu, ghi nhật ký |
| **trained_at** | Ngày giờ huấn luyện | `2026-09-27T16:08:31.543015` | Kiểm tra phiên bản nào mới |
| **dataset_hash** | Hash SHA256 của catalog_vn.csv | `8f75c4cc7a4...` | Phát hiện dữ liệu đổi (nếu hash khác → retrain) |
| **n_samples** | Tổng máy trong dữ liệu | `1000` | Kiểm tra dữ liệu đầy đủ |
| **class_counts** | Số máy per lớp | `{"OFFICE": 344, "GAMING": 335, ...}` | Kiểm tra cân bằng dữ liệu |

### 3. Tham số mô hình (GridSearchCV chọn)

```json
"best_params": {
  "knn__metric": "euclidean",      // cách đo khoảng cách
  "knn__n_neighbors": 7,           // số láng giềng bỏ phiếu
  "knn__weights": "uniform"        // cách bỏ phiếu (mỗi láng = 1 phiếu)
}
```

**Dùng để:**
- Hiểu tại sao chọn k=7 (thay vì k=5 hay k=9)
- Giải thích cho hội đồng: "kNN tìm 7 láng giềng gần nhất, cho bỏ phiếu"
- Demo: vẽ 7 láng giềng trên bản đồ

### 4. Điểm số (Kiểm thử chéo vs Test)

```json
"cv_f1_macro_mean": 0.7938,        // macro-F1 kiểm thử chéo 5 phần (trung bình)
"cv_f1_macro_std": 0.0463,         // độ dao động (thấp = ổn định)

"test_metrics": {
  "f1_macro": 0.7866,              // macro-F1 trên 200 máy test (thực tế)
  "report": {                       // chi tiết per class
    "CREATOR": {
      "precision": 0.75,           // khi đoán CREATOR, 75% đúng
      "recall": 0.375,             // ⚠ CHỈ 37,5% CREATOR được đoán đúng
      "f1-score": 0.5
    },
    "GAMING": {
      "recall": 0.9403             // ✓ 94% GAMING được đoán đúng
    },
    ...
  }
}
```

**Dùng để:**
- So sánh CV (0.7938) vs test (0.7866) → chênh 0.72% → **không rò rỉ dữ liệu** ✓
- Phát hiện điểm yếu: CREATOR recall chỉ 37,5% → cần hàng đợi Duyệt nhãn
- Báo cáo slide: "macro-F1 = 0.787"

### 5. Ma trận nhầm lẫn

```json
"confusion_matrix": [
  [9, 14, 1, 0],     // CREATOR: 9 đúng, 14 nhầm GAMING
  [3, 63, 1, 0],     // GAMING: 63 đúng, 3 nhầm CREATOR
  [0, 1, 65, 3],     // OFFICE: 65 đúng
  [0, 0, 7, 33]      // ULTRABOOK: 33 đúng
],
"labels": ["CREATOR", "GAMING", "OFFICE", "ULTRABOOK"]
```

**Dùng để:**
- Phân tích: CREATOR bị nhầm GAMING nhiều (14/24) → vấn đề sRGB?
- Demo: "Máy CREATOR thường bị nhầm GAMING vì cùng cần GPU mạnh"
- Slide: ảnh confusion_matrix.png (file PNG đã render)

### 6. Mốc so sánh (Baseline)

```json
"baseline": {
  "dummy_f1_macro": 0.128,         // đoán lớp đông: macro-F1 = 12,8%
  "rule_f1_macro": 0.632           // luật if-else tay: macro-F1 = 63,2%
}
```

**So sánh:**
- Dummy 0,128 < Rule 0,632 < **kNN 0,787** ✓ (hơn rule 25%)
- Dùng để bảo vệ: "kNN không phải "may mắn", mà thực sự học được"

### 7. Đường cong k (từng giá trị k)

```json
"k_curve": [
  {"k": 1, "f1_macro_mean": 0.7566, "f1_macro_std": 0.0150},
  {"k": 3, "f1_macro_mean": 0.7647, "f1_macro_std": 0.0238},
  {"k": 5, "f1_macro_mean": 0.7576, "f1_macro_std": 0.0389},
  {"k": 7, "f1_macro_mean": 0.7938, "f1_macro_std": 0.0463},  ← ✓ CAO NHẤT
  {"k": 9, "f1_macro_mean": 0.7844, "f1_macro_std": 0.0289},
  ...
  {"k": 31, "f1_macro_mean": 0.6968, "f1_macro_std": 0.0431}
]
```

**Dùng để:**
- Vẽ biểu đồ (file k_curve.png)
- Giải thích: "k=7 cao nhất; k=1 khớp quá; k=31 mất đặc điểm"
- Demo: "Vì sao chọn k=7? Vì cân bằng tốt nhất" (nguyên tắc k ≤ √n = 28)

### 8. Danh sách 11 đặc trưng

```json
"feature_list": [
  "ram_gb", "ssd_gb",                    // nhóm 1: log2 → z-score
  "cpu_score", "gpu_score", ...,         // nhóm 2: z-score trực tiếp
  "gpu_dedicated", "srgb_100"            // nhóm 3: giữ nguyên 0/1
]
```

**Dùng để:**
- Tra: "mô hình dùng đúng 11 đặc trưng này chứ"
- Ablation: cắt từng cái, xem macro-F1 giảm bao nhiêu

### 9. Phiên bản thư viện

```json
"sklearn_version": "1.5.2"
```

**Dùng để:** Phát hiện incompatible nếu upgrade sklearn

---

## Cách sử dụng metadata.json trong code

### Python: Đọc metadata

```python
import json
from pathlib import Path

# Cách 1: Đọc phiên bản đang dùng
with open("artifacts/LATEST") as f:
    version = f.read().strip()

with open(f"artifacts/{version}/metadata.json") as f:
    metadata = json.load(f)

# Lấy tham số
k = metadata["best_params"]["knn__n_neighbors"]  # 7
metric = metadata["best_params"]["knn__metric"]  # "euclidean"
macro_f1 = metadata["test_metrics"]["f1_macro"]  # 0.7866

# Lấy điểm yếu (CREATOR recall)
creator_recall = metadata["test_metrics"]["report"]["CREATOR"]["recall"]  # 0.375
print(f"⚠ CREATOR recall chỉ {creator_recall:.1%} → cần Duyệt nhãn")
```

### Python: So sánh phiên bản

```python
# Khi có phiên bản mới, kiểm tra dữ liệu có đổi không
old_metadata = json.load(open("artifacts/clf-2026.09.26.../metadata.json"))
new_metadata = json.load(open("artifacts/clf-2026.09.27.../metadata.json"))

if old_metadata["dataset_hash"] != new_metadata["dataset_hash"]:
    print("⚠ Dữ liệu đổi! Retrain bắt buộc")
else:
    print("✓ Dữ liệu giống → so sánh macro-F1")
    old_f1 = old_metadata["test_metrics"]["f1_macro"]
    new_f1 = new_metadata["test_metrics"]["f1_macro"]
    print(f"Cải thiện: {new_f1 - old_f1:+.4f}")
```

---

## Checklist khi bảo vệ trước hội đồng

Trước khi trình bày, **kiểm tra 5 điều này từ metadata:**

- [ ] **version**: phiên bản nào (ngày giờ mới nhất?)
- [ ] **best_params**: k=7, metric=euclidean, weights=uniform
- [ ] **cv_f1_macro_mean vs test_f1_macro**: chênh bao nhiêu? (< 1% = tốt)
- [ ] **class_counts**: lệch lớp? (CREATOR 12% = lệch)
- [ ] **CREATOR recall**: 0.375 = yếu → nói thẳng "cần Duyệt nhãn"

---

**Lần sau khi retrain, metadata.json sẽ tự động cập nhật. Chỉ cần bấm "Đưa vào sử dụng" tay mới đổi LATEST.**
