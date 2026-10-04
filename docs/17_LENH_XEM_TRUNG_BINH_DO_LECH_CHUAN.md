# 17 — Lệnh xem trung bình và độ lệch chuẩn của mô hình

> Dùng khi cần **tra lại trung bình / độ lệch chuẩn** (các số trong bước chuẩn hóa z-score) để tính tay, làm
> slide hoặc trả lời hội đồng. Các số này nằm trong file nhị phân `model.joblib` nên phải dùng lệnh dưới
> đây để in ra dạng đọc được.

## 1. Lệnh chạy (PowerShell, terminal của VS Code)

Phải **đứng trong thư mục `ml-service`**, dòng nhắc lệnh phải là `PS D:\QL_Laptop\ml-service>`.

```
cd ml-service
python -m app.lifecycle.inspect_model
```

Gộp một dòng nếu đang ở thư mục gốc `D:\QL_Laptop` (PowerShell nối lệnh bằng `;`, không dùng `&&`):

```
cd ml-service; python -m app.lifecycle.inspect_model
```

Xem một **phiên bản cụ thể** (thay bằng tên thư mục trong `ml-service/artifacts/`):

```
python -m app.lifecycle.inspect_model clf-2026.09.27-012747
```

Không ghi tên phiên bản thì lệnh đọc bản đang dùng, tên được ghi trong file `ml-service/artifacts/LATEST`.

## 2. Đầu ra mẫu (bản đang dùng `clf-2026.09.27-012747`)

```
Phiên bản: clf-2026.09.27-012747
Mô hình gồm 2 bước nối nhau: ['prep', 'knn']  (chuẩn hóa -> kNN)

BƯỚC 'prep' - chuẩn hóa: trung bình / độ lệch chuẩn đã học trên tập huấn luyện
  ram_gb         trung bình =    3.7938   độ lệch chuẩn =   0.7913   (sau log2)
  ssd_gb         trung bình =    8.9125   độ lệch chuẩn =   0.7809   (sau log2)
  cpu_score      trung bình =   48.9933   độ lệch chuẩn =  20.5806   (giá trị gốc)
  gpu_score      trung bình =   30.9521   độ lệch chuẩn =  28.9868   (giá trị gốc)
  screen_inch    trung bình =   15.3732   độ lệch chuẩn =   0.9616   (giá trị gốc)
  ppi            trung bình =  156.7983   độ lệch chuẩn =  34.0465   (giá trị gốc)
  refresh_hz     trung bình =   98.7750   độ lệch chuẩn =  46.5490   (giá trị gốc)
  weight_kg      trung bình =    1.8325   độ lệch chuẩn =   0.5652   (giá trị gốc)
  battery_wh     trung bình =   58.8963   độ lệch chuẩn =  14.5795   (giá trị gốc)

BƯỚC 'knn' - bộ phân loại
  k (số láng giềng)   : 7
  cách đo khoảng cách : euclidean
  trọng số phiếu      : uniform
  số máy đã ghi nhớ   : 800 (mỗi máy 11 đặc trưng)
  các nhãn            : ['CREATOR', 'GAMING', 'OFFICE', 'ULTRABOOK']
```

## 3. Cách đọc

| Dòng | Ý nghĩa |
|---|---|
| `ram_gb`, `ssd_gb` ghi **(sau log2)** | Trung bình/độ lệch chuẩn tính trên **log₂ của RAM/SSD** (ví dụ log₂(32) = 5), không phải số GB gốc |
| Các cột còn lại ghi (giá trị gốc) | Tính trực tiếp trên giá trị gốc (điểm, kg, inch, Hz, Wh...) |
| Cột `gpu_dedicated`, `srgb_100` **không có** | Là cột 0/1, giữ nguyên, không chuẩn hóa |
| `số máy đã ghi nhớ = 800` | Trung bình/độ lệch chuẩn được tính trên **800 máy huấn luyện** (80% của 1.000 máy) |

Công thức dùng các số này: `z = (giá trị − trung bình) ÷ độ lệch chuẩn`. Với RAM thì lấy `log₂(RAM)` trước,
rồi mới trừ trung bình và chia độ lệch chuẩn.

Ví dụ cột cân nặng: máy nặng 1,2 kg có z = (1,2 − 1,8325) ÷ 0,5652 = **−1,12**.

## 4. Các số này đến từ đâu, tự kiểm tra thế nào

| Câu hỏi | Trả lời |
|---|---|
| Ai tính? | `StandardScaler` (dòng `("sc", StandardScaler())` ở `ml-service/app/data/features.py`), tính lúc huấn luyện |
| Tính trên dữ liệu nào? | 800 máy huấn luyện: `train_test_split(test_size=0.2, stratify, random_state=42)` ở `ml-service/app/lifecycle/train.py` dòng 47 |
| Lưu ở đâu? | Trong `ml-service/artifacts/<phiên bản>/model.joblib` (file nhị phân, VS Code không mở được) |
| Công thức độ lệch chuẩn | √( tổng (x − trung bình)² ÷ n ), chia n (Excel: `STDEV.P`) |
| Kiểm bằng Excel | Mở `data/processed/catalog_vn.csv`, cột cân nặng, dùng `AVERAGE` và `STDEV.P`. Ra khoảng 1,8342 và 0,5672 (tính trên **cả 1.000 máy**, khác một chút so với 1,8325 và 0,5652 của 800 máy huấn luyện) |

## 5. Lỗi thường gặp

| Thông báo | Nguyên nhân | Cách sửa |
|---|---|---|
| `No module named 'app'` | Đang đứng ở `D:\QL_Laptop` thay vì `ml-service` | `cd ml-service` rồi chạy lại |
| `FileNotFoundError ... model.joblib` | Tên phiên bản gõ sai hoặc thư mục không có `model.joblib` | Xem danh sách thư mục trong `ml-service/artifacts/` |
| Mở `model.joblib` bằng VS Code thấy "binary" | Đúng, file nhị phân | Dùng lệnh ở mục 1, hoặc mở `metadata.json` (cùng thư mục) để xem điểm số, tham số k |

File `metadata.json` (đọc được bằng VS Code) chứa: tham số tốt nhất (`k`, `metric`, `weights`), điểm macro-F1,
số mẫu, ngày huấn luyện. Nó **không** chứa trung bình/độ lệch chuẩn, nên vẫn cần lệnh ở mục 1 cho các số đó.

Mã nguồn của lệnh: `ml-service/app/lifecycle/inspect_model.py`.
