# 18 — Bản đồ tìm file: đoán được chỗ cần mở mà không phải nhớ

Tên thư mục và tên file trong dự án đặt theo công thức cố định. Chỉ cần trả lời 4 câu hỏi là đoán ra chỗ cần mở.

## 1. Công thức 4 câu hỏi (theo thứ tự)

| # | Câu hỏi | Trả lời | Đi đến |
|---|---|---|---|
| 1 | Thấy trên màn hình hay chạy ngầm? | Thấy trên màn hình | `frontend/` (trang Admin: `frontend/src/pages/admin/Admin<Chức năng>.tsx`) |
| 2 | Là nghiệp vụ / dữ liệu người dùng, hay là AI? | Nghiệp vụ | `backend/src/modules/<chức năng>/` |
|   |   | AI | `ml-service/app/` |
| 3 | (Với AI) Là nguyên liệu, công thức hay nhà máy? | Nguyên liệu (dữ liệu, đặc trưng) | `data/` |
|   |   | Công thức (kNN, cách dự đoán) | `models/` |
|   |   | Nhà máy (huấn luyện, đánh giá, lưu phiên bản) | `lifecycle/` |
| 4 | File là code hay là kết quả sinh ra? | Kết quả (mô hình đã học, ảnh) | `ml-service/artifacts/<phiên bản>/` |

Mẹo cho câu 3: hỏi "thứ này là cái đem đi tính, hay cách tính?". Cái đem đi tính là `data/`, cách tính là `models/`.

Mẹo cho câu 4: `artifacts/` chỉ chứa thành phẩm, không chứa code. Muốn biết ai tạo ra file thì tìm code ở `lifecycle/`.

## 2. Tên file nói lên vai trò

| Dấu hiệu trong tên | Vai trò | Ví dụ |
|---|---|---|
| `.routes.ts` | "Cửa": nhận yêu cầu từ ngoài, kiểm quyền | `backend/src/modules/laptops/laptops.routes.ts` |
| `.service.ts` | "Bộ não": logic nghiệp vụ thật sự | `backend/src/modules/laptops/segment.service.ts` |
| `Admin<Chức năng>.tsx` | Một trang Admin trên giao diện | `frontend/src/pages/admin/AdminModels.tsx` |
| `main.py` | Cửa vào của ML service | `ml-service/app/main.py` |
| `schemas.py` | Khuôn dữ liệu nhận và trả | `ml-service/app/schemas.py` |
| `test_<tên file được kiểm>.py` | Kiểm thử | `ml-service/tests/test_classifier.py` |

Từ khóa tiếng Anh trong tên file:

| Từ khóa | Nghĩa | File |
|---|---|---|
| `features` | đặc trưng | `data/features.py` |
| `classifier` | bộ phân lớp (Mô hình A) | `models/classifier.py` |
| `retriever` | tìm kiếm / gợi ý (Mô hình B) | `models/retriever.py` |
| `text_classifier` | hiểu câu tự do (Mô hình C) | `models/text_classifier.py` |
| `train` | huấn luyện | `lifecycle/train.py` |
| `evaluate` | đánh giá | `lifecycle/evaluate.py` |
| `registry` | sổ đăng ký phiên bản mô hình, ghi `LATEST` | `lifecycle/registry.py` |

## 3. Tìm bằng từ khóa thay vì nhớ đường dẫn

- `Ctrl+P` rồi gõ một phần tên file (ví dụ `segment`): mở file theo tên.
- `Ctrl+Shift+F` rồi gõ từ khóa trong code (ví dụ `confidence_threshold`): tìm mọi chỗ dùng.

## 4. Ví dụ áp dụng (đã đối chiếu với source)

| Việc cần tìm | Đi đến | Lý do |
|---|---|---|
| Ngưỡng 0,6 quyết định VERIFIED hay NEEDS_REVIEW | `backend/src/modules/laptops/segment.service.ts` | nghiệp vụ, chức năng laptops, `.service`, "segment" nằm trong tên |
| Thử 64 tổ hợp k (`grid_search`) | `ml-service/app/models/classifier.py` | công thức mô hình, "classifier" là bộ phân lớp |
| Chia 80/20 | `ml-service/app/lifecycle/train.py` | chạy lúc huấn luyện |
| Danh sách 11 đặc trưng | `ml-service/app/data/features.py` | đặc trưng là nguyên liệu, không phải công thức |
| Code ghi file `LATEST` | `ml-service/app/lifecycle/registry.py` (hàm `save_latest`) | `artifacts/` chỉ chứa file kết quả, code ghi nằm ở `lifecycle/` |
| File `LATEST` (nơi nó nằm) | `ml-service/artifacts/LATEST` | thành phẩm |
| Ảnh `k_curve.png`, `confusion_matrix.png` | `ml-service/artifacts/<phiên bản>/` | thành phẩm sinh ra lúc huấn luyện |
| Trang "Quản lý mô hình" trên giao diện | `frontend/src/pages/admin/AdminModels.tsx` | thấy trên màn hình, trang Admin |
| Màn "Cấu hình tri thức" (sửa ngưỡng) | `frontend/src/pages/admin/AdminKnowledge.tsx` (giao diện) và `backend/src/modules/knowledge/` (xử lý) | một chức năng có hai nửa: mặt tiền và quầy giao dịch |
| Hàng đợi "Duyệt nhãn" | `frontend/src/pages/admin/AdminReviewQueue.tsx` (giao diện), `backend/src/modules/labels/labels.routes.ts` (dữ liệu) | cùng quy tắc |

## 5. Hai nhầm lẫn hay gặp

1. **Lẫn "file nằm ở đâu" với "code tạo ra file nằm ở đâu".** `LATEST` nằm trong `artifacts/`, nhưng code ghi nó ở `lifecycle/registry.py`.
2. **Lẫn tên thư mục `lifecycle` (vòng đời, nằm trong ML) với trang "Quản lý mô hình" (giao diện).** Trang Admin ở `frontend/`; nó gọi backend, backend gọi ML.

## 6. Cấu trúc đầy đủ cấp thư mục

```
D:\QL_Laptop
  frontend/src/           giao diện (React)
    pages/admin/          các trang Admin: Admin<Chức năng>.tsx
    components/ lib/ theme/ constants/ utils/
  backend/src/            nghiệp vụ (Express + Prisma + SQL Server)
    modules/<chức năng>/  mỗi chức năng một thư mục: .routes.ts + .service.ts
    config/ lib/ middlewares/ constants/
  ml-service/             AI (FastAPI + scikit-learn)
    app/data/             nguyên liệu: đọc dữ liệu, đặc trưng, kiểm tra định dạng
    app/models/           công thức: Mô hình A, B, C
    app/lifecycle/        nhà máy: huấn luyện, đánh giá, lưu phiên bản
    app/main.py           cửa vào của ML service
    artifacts/            thành phẩm: mô hình đã học, ảnh, LATEST
    data/                 dữ liệu thô và đã xử lý (catalog_vn.csv)
    tests/                kiểm thử
  docs/                   tài liệu (file này nằm ở đây)
```
