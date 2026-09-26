# SmartLap — Hệ khuyến nghị laptop theo hiệu năng và giá thành bằng kNN

> Bộ tài liệu đặc tả dùng cho 3 mục đích: (1) bàn giao cho Claude Code triển khai, (2) làm khung viết báo cáo theo tiêu chí C1–C4, (3) chuẩn bị bảo vệ trước hội đồng.

**Nhóm:** Trần Đức Hải (trưởng nhóm), Cao Thị Vân, Nguyễn Quốc Duy — **GVHD:** Nguyễn Ngọc Duy

## 1. Một câu mô tả đề tài

Người dùng khai báo nhu cầu (mục đích sử dụng, ngân sách, mức ưu tiên hiệu năng / di động / màn hình / giá), hệ thống dùng **kNN phân lớp** để xác định phân khúc phù hợp (Văn phòng, Mỏng nhẹ, Gaming, Đồ họa) và **kNN truy hồi nội dung (content-based)** để trả về top-N laptop gần nhất với "hồ sơ lý tưởng", kèm giải thích bằng tiếng Việt vì sao mỗi máy được gợi ý.

## 2. Thứ tự đọc

| # | File | Nội dung | Ai dùng |
|---|------|----------|---------|
| 0 | `CLAUDE.md` | Quy ước bắt buộc khi code | Claude Code |
| 1 | `01_PHAN_TICH_DE_TAI_VA_TIEU_CHI.md` | Phân tích bài toán, ánh xạ tiêu chí C1–C4, nhật ký quyết định | Cả nhóm, báo cáo |
| 2 | `02_YEU_CAU_CHUC_NANG.md` | Tác nhân, use case, yêu cầu chức năng / phi chức năng | BA, báo cáo |
| 3 | `03_DU_LIEU_VA_TIEN_XU_LY.md` | Nguồn dữ liệu, gán nhãn, đặc trưng, chuẩn hóa | ML |
| 4 | `04_MO_HINH_KNN.md` | Hai mô hình kNN, chọn k, đánh giá, giải thích | ML, báo cáo C2 |
| 5 | `05_CSDL_PRISMA.md` | Schema Prisma cho SQL Server | Backend |
| 6 | `06_KIEN_TRUC_VA_API.md` | Kiến trúc 3 dịch vụ, API contract | Backend, ML |
| 7 | `07_UIUX.md` | Hệ thống thiết kế tươi sáng xanh dương – trắng | Frontend |
| 8 | `08_FRONTEND_SPEC.md` | Đặc tả từng màn hình | Frontend |
| 9 | `09_VONG_DOI_TRI_TUE.md` | Phản hồi, versioning, dự phòng, ghi đè tri thức, giám sát | Cả nhóm, báo cáo C3 |
| 10 | `10_KE_HOACH_TRIEN_KHAI.md` | 7 giai đoạn + tiêu chí nghiệm thu | Trưởng nhóm |
| 11 | `11_KICH_BAN_DEMO_VA_HOI_DAP.md` | Kịch bản demo 10 phút + bộ câu hỏi hội đồng | Bảo vệ |
| 12 | `12_TAI_LIEU_THAM_KHAO.md` | Tài liệu tham khảo học thuật | Báo cáo |

## 3. Công nghệ

| Tầng | Công nghệ |
|------|-----------|
| Backend | Node.js 20, Express, TypeScript, Prisma, SQL Server |
| Dịch vụ ML | Python 3.11, FastAPI, scikit-learn, pandas, joblib |
| Frontend | React 18, Vite, TypeScript, Ant Design 5, Recharts |
| Font | Be Vietnam Pro (hỗ trợ tiếng Việt tốt) |

## 4. Cấu trúc thư mục đích

```
smartlap/
├── backend/            # Express + Prisma
├── ml-service/         # FastAPI + scikit-learn
├── frontend/           # React + Vite + AntD
├── data/
│   ├── raw/            # catalog_vn_raw.xlsx, kaggle/laptop_price.csv
│   ├── processed/      # catalog_vn.csv, cpu_benchmark.csv, gpu_benchmark.csv
│   └── personas/       # personas.json (bộ kiểm thử khuyến nghị)
└── docs/               # bộ .md này
```

## 5. Bài học rút ra từ đề tài trước (áp dụng ngay)

1. **Lõi thông minh phải là học máy nhận diện được** — lần này kNN nằm trong danh mục thầy ưu tiên và có trong slide C2 (khoảng cách Euclidean, Manhattan, 5 bước thuật toán).
2. **Có `07_UIUX.md` từ đầu** — design token, theme AntD, quy tắc màu, trạng thái rỗng/lỗi/dự phòng, không để frontend tự chọn màu.
3. **Mọi quyết định đều ghi vào nhật ký quyết định** (mục 5 file 01) kèm tiêu chí C mà nó phục vụ.
4. **Có kiểm thử chặn hồi quy** cho các lỗi logic dễ tái phát (ví dụ: quên chuẩn hóa đặc trưng làm kNN bị giá tiền chi phối).
