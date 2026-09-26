# 03 — Dữ liệu và tiền xử lý

## 1. Chiến lược dữ liệu (đề xuất cho D-02)

Dùng **ba nguồn với ba vai trò tách bạch**, để mỗi nguồn trả lời một câu hỏi khác nhau của hội đồng:

| Nguồn | Quy mô | Vai trò | Trả lời câu hỏi |
|---|---|---|---|
| **A. Catalog thị trường VN** (tự thu thập) | 250–350 mẫu | Dữ liệu chính: huấn luyện Mô hình A, làm danh mục khuyến nghị | "Hệ thống có dùng được thật không?" |
| **B. Kaggle Laptop Prices** | ~1.300 mẫu | Thực nghiệm đối chứng: chạy lại cùng pipeline kNN trên dữ liệu công khai | "Phương pháp có tái lập được trên dữ liệu người khác không?" |
| **C. Dữ liệu tổng hợp** | 30 persona + tương tác giả lập | Kiểm thử khuyến nghị, tạo dữ liệu phản hồi cho demo vòng đời | "Làm sao biết khuyến nghị đúng?" |

**Nguyên tắc cứng:** dữ liệu tổng hợp (C) **không bao giờ** dùng để huấn luyện Mô hình A. Như vậy không ai có thể nói "mô hình học lại luật của nhóm".

**Phương án rút gọn** nếu nhóm không đủ thời gian thu thập 250 mẫu: dùng Kaggle làm dữ liệu huấn luyện Mô hình A (nhãn từ cột `TypeName`), catalog VN chỉ cần 60–80 mẫu để làm danh mục demo, và nêu rõ hạn chế lệch miền trong báo cáo.

## 2. Nguồn A — Catalog thị trường VN

### 2.1 Cách thu thập
- Thu thập **thủ công** từ trang sản phẩm công khai của các nhà bán lẻ lớn (không viết crawler tự động, tránh vi phạm điều khoản sử dụng). Mỗi dòng ghi `source_url` và `collected_at`.
- Chia việc: mỗi thành viên ~100 mẫu, cân bằng giữa 4 phân khúc (mục tiêu tối thiểu 50 mẫu / lớp).
- Nhập vào mẫu Excel `data/raw/catalog_vn_raw.xlsx` theo đúng cột ở 2.2.

### 2.2 Cột thu thập

| Cột | Kiểu | Ví dụ | Ghi chú |
|---|---|---|---|
| `sku` | text | `ASUS-TUF-F15-FX507ZC4` | Duy nhất |
| `brand` | text | ASUS | |
| `name` | text | ASUS TUF Gaming F15 FX507ZC4 | |
| `cpu_model` | text | Intel Core i5-12500H | Tra benchmark |
| `gpu_model` | text | NVIDIA GeForce RTX 3050 4GB | Card tích hợp ghi đúng tên, ví dụ Intel Iris Xe |
| `ram_gb` | int | 16 | |
| `ssd_gb` | int | 512 | |
| `screen_inch` | float | 15.6 | |
| `resolution` | text | 1920x1080 | Tính PPI |
| `refresh_hz` | int | 144 | Không ghi → 60 |
| `srgb_100` | bool | 0 | 1 nếu công bố ≥ 100% sRGB hoặc có DCI-P3 |
| `weight_kg` | float | 2.2 | |
| `battery_wh` | float | 56 | |
| `price_vnd` | int | 19990000 | Giá niêm yết tại ngày thu thập |
| `retailer_category` | text | Laptop Gaming | **Nhãn gốc** |
| `retailer_category_2` | text | | Nếu nhà bán lẻ xếp vào 2 danh mục |
| `image_url` | text | | Ảnh demo (tùy chọn, có thể dùng ảnh minh họa chung) |
| `source_url`, `collected_at` | text, date | | Truy vết |

### 2.3 Gán nhãn phân khúc

Ánh xạ danh mục nhà bán lẻ → nhãn hệ thống:

| Danh mục nhà bán lẻ (thường gặp) | Nhãn `segment` | Tên hiển thị |
|---|---|---|
| Học tập – Văn phòng | `OFFICE` | Văn phòng – Học tập |
| Mỏng nhẹ, Cao cấp – Sang trọng (máy mỏng) | `ULTRABOOK` | Mỏng nhẹ – Di động |
| Gaming | `GAMING` | Gaming |
| Đồ họa – Kỹ thuật | `CREATOR` | Đồ họa – Kỹ thuật |

Quy tắc khi một máy nằm ở 2 danh mục:
1. Lấy danh mục đầu tiên nhà bán lẻ hiển thị làm nhãn chính.
2. Hai thành viên độc lập gán lại 40 mẫu ngẫu nhiên, tính **hệ số Cohen's kappa** (Cohen, 1960). Kappa ≥ 0,7 được xem là đáng tin; đưa con số này vào báo cáo.
3. Mẫu hai người bất đồng → trưởng nhóm quyết, ghi `label_note`.

## 3. Nguồn B — Kaggle Laptop Prices

- File `laptop_price.csv` (các cột Company, Product, TypeName, Inches, ScreenResolution, Cpu, Ram, Memory, Gpu, OpSys, Weight, Price_euros). **Kiểm tra giấy phép trên trang dataset trước khi dùng và ghi vào báo cáo.**
- Ánh xạ nhãn: `Notebook`, `Netbook` → OFFICE; `Ultrabook`, `2 in 1 Convertible` → ULTRABOOK; `Gaming` → GAMING; `Workstation` → CREATOR.
- Lớp CREATOR rất ít mẫu (vài chục) → đây là cơ hội trình bày xử lý mất cân bằng lớp (04 §5.3).
- Kaggle thiếu `refresh_hz`, `srgb_100`, `battery_wh` → thí nghiệm đối chứng chỉ dùng tập đặc trưng giao nhau; ghi rõ trong báo cáo.

## 4. Bảng benchmark CPU / GPU

Tên CPU/GPU là chuỗi, kNN cần số. Quy đổi qua hai bảng tra cứu:

`data/processed/cpu_benchmark.csv`

| `pattern` | `display_name` | `raw_score` | `source` |
|---|---|---|---|
| `i5-12500H` | Intel Core i5-12500H | (điểm PassMark CPU Mark tra thủ công) | PassMark, ngày tra |

`data/processed/gpu_benchmark.csv` tương tự với điểm PassMark G3D Mark.

- Điểm tra thủ công từ trang benchmark công khai, **ghi ngày tra**.
- Chuẩn hóa: `cpu_score = 100 × raw_score / max(raw_score)` trên toàn bảng → thang 0–100 để hiển thị. Mô hình vẫn chuẩn hóa lại bằng StandardScaler.
- Khớp tên: chuẩn hóa chuỗi (viết thường, bỏ "(R)", "(TM)", "Processor", khoảng trắng thừa) rồi so `pattern`. Không khớp → báo lỗi ở màn nhập liệu, **không** tự đoán.
- `gpu_dedicated = 1` nếu tên chứa GeForce / Radeon RX / RTX / Quadro / Arc A-series.

## 5. Đặc trưng

### 5.1 Tập đặc trưng

| Đặc trưng | Nguồn | Biến đổi | Mô hình A | Mô hình B |
|---|---|---|---|---|
| `cpu_score` | benchmark | chuẩn hóa z | ✅ | ✅ |
| `gpu_score` | benchmark | chuẩn hóa z | ✅ | ✅ |
| `gpu_dedicated` | suy ra | 0/1 | ✅ | |
| `ram_gb` | thô | log2 → z | ✅ | ✅ |
| `ssd_gb` | thô | log2 → z | ✅ | ✅ |
| `screen_inch` | thô | z | ✅ | ✅ |
| `ppi` | tính | z | ✅ | ✅ |
| `refresh_hz` | thô | z | ✅ | ✅ |
| `srgb_100` | thô | 0/1 | ✅ | ✅ |
| `weight_kg` | thô | z | ✅ | ✅ |
| `battery_wh` | thô | z | ✅ | ✅ |
| `price_vnd` | thô | log10 → z | ❌ (D-04) | ✅ |

`ppi = sqrt(w² + h²) / screen_inch`.

Chỉ số hiển thị (không đưa vào mô hình):
- `performance_index = 0,5·cpu_score + 0,35·gpu_score + 0,1·ram_norm + 0,05·ssd_norm` (0–100).
- `value_index = performance_index / (price_vnd / 1.000.000)` — dùng cho huy hiệu "Đáng tiền nhất" và cho chế độ dự phòng.

### 5.2 Vì sao phải chuẩn hóa (điểm hay hỏi khi bảo vệ)

kNN dựa trên khoảng cách. Không chuẩn hóa thì `price_vnd` (hàng chục triệu) và `ssd_gb` (hàng trăm) sẽ lấn át hoàn toàn `weight_kg` (1–3). Thí nghiệm cắt bỏ (ablation) ở 04 §6.3 bắt buộc chạy phiên bản không chuẩn hóa để minh chứng bằng số.

Dùng log cho RAM/SSD/giá vì chênh 8 → 16 GB có ý nghĩa ngang 16 → 32 GB, không phải bằng 1/2.

### 5.3 Pipeline

```python
numeric_log = ["ram_gb", "ssd_gb"]           # log2
numeric = ["cpu_score", "gpu_score", "screen_inch", "ppi",
           "refresh_hz", "weight_kg", "battery_wh"]
binary = ["gpu_dedicated", "srgb_100"]

preprocess = ColumnTransformer([
    ("log", Pipeline([("log", FunctionTransformer(np.log2)),
                      ("sc", StandardScaler())]), numeric_log),
    ("num", StandardScaler(), numeric),
    ("bin", "passthrough", binary),
])
```

Thiếu dữ liệu: `refresh_hz` thiếu → 60; `battery_wh` thiếu → trung vị của phân khúc trong tập train (dùng `SimpleImputer` trong pipeline). Không có cột nào thiếu quá 10%; vượt ngưỡng → báo cáo và loại cột.

## 6. Nguồn C — Persona tổng hợp

`data/personas/personas.json` gồm 30 hồ sơ nhu cầu viết tay, mỗi hồ sơ có **ràng buộc kiểm chứng được**:

```json
{
  "id": "P07",
  "mo_ta": "Sinh viên CNTT, lập trình + game nhẹ, ngân sách 18–22 tr",
  "input": { "segment": null, "activities": ["lap_trinh", "choi_game"],
             "budget": [18000000, 22000000],
             "priorities": { "performance": 4, "mobility": 3, "display": 2, "price": 3 },
             "must": { "ram_min": 16 } },
  "expect": { "segment_in": ["GAMING", "OFFICE"], "all_price_lte": 24200000,
              "all_ram_gte": 16, "top1_gpu_dedicated": true }
}
```

Dùng cho: kiểm thử tự động (04 §9), số liệu "tỷ lệ persona đạt" trong báo cáo, và sinh tương tác giả lập (người dùng giả chọn 👍 cho máy thỏa `expect`, 👎 kèm lý do cho máy vi phạm) để demo vòng phản hồi.

## 7. Kiểm tra chất lượng dữ liệu (script `ml-service/app/data_check.py`)

- Trùng `sku` → lỗi.
- Giá ngoài [5 tr, 150 tr], trọng lượng ngoài [0,8; 4,5] kg, RAM không thuộc {4, 8, 12, 16, 24, 32, 64} → cảnh báo.
- Số mẫu mỗi lớp, in bảng phân bố → đưa vào báo cáo.
- CPU/GPU không khớp bảng benchmark → lỗi, liệt kê tên.
