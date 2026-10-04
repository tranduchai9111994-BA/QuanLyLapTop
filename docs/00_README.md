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
| 13 | `13_GIAI_THICH_THUAT_TOAN_KNN.md` | kNN trong đồ án đã triển khai: nguyên lý, ví dụ tính tay, 3 mô hình kèm trích dẫn code, cách tự kiểm tra, hỏi đáp | Bảo vệ, báo cáo C2 |
| 14 | `14_KET_QUA_THUC_NGHIEM.md` | Số liệu thực nghiệm mới nhất (macro-F1, P@5/nDCG@5, so baseline) và danh sách hạn chế | Báo cáo, bảo vệ |
| 15 | `15_HUONG_DAN_3_THANH_VIEN.md` | Hướng dẫn hiểu & trình bày từng mô hình theo phân công nhóm (A: phân loại phân khúc, C: câu tự do, B: top-5), kèm ví dụ chạy thật, câu hỏi hội đồng, khung slide | Học, làm slide/báo cáo |

`CLAUDE.md` giữ nguyên tên không đánh số vì Claude Code chỉ tự nạp file có đúng tên này.

## 3. Công nghệ

| Tầng | Công nghệ |
|------|-----------|
| Backend | Node.js, Express 4, TypeScript, Prisma 5, SQL Server, zod, JWT, bcryptjs, vitest |
| Dịch vụ ML | Python, FastAPI, scikit-learn, pandas, numpy, imbalanced-learn, joblib, pytest |
| Frontend | React 19, Vite, TypeScript, Ant Design 6, Recharts, react-router-dom 7, axios |
| Font | Be Vietnam Pro (hỗ trợ tiếng Việt tốt) |

## 4. Cấu trúc thư mục

```
smartlap/
├── backend/                 # Express + Prisma (README riêng)
├── ml-service/              # FastAPI + scikit-learn, 3 mô hình kNN (README riêng)
├── frontend/                # React + Vite + AntD (README riêng)
├── data/
│   ├── raw/                 # catalog_vn_raw.xlsx
│   ├── processed/           # catalog_vn.csv, cpu_benchmark.csv, gpu_benchmark.csv
│   └── personas/            # personas.json (bộ kiểm thử khuyến nghị)
├── screenshots/             # ảnh chức năng cho báo cáo
├── crud_test_screenshots/   # ảnh bằng chứng kiểm thử CRUD trên browser
├── scripts/                 # chụp ảnh, tải ảnh sản phẩm, test CRUD tự động
└── docs/                    # bộ .md này
```

## 5. Chạy hệ thống

**Nhanh nhất:** bấm đúp shortcut **`SmartLap`** trên Desktop → cả 3 dịch vụ chạy ẩn và tự mở
`http://localhost:5180` (khoảng 4 giây). Tắt bằng `stop-smartlap.bat`. Log lỗi ở `logs/*.log`.
Quản trị: link "Quản trị viên / Nhân viên" góc phải (`/admin/login`).

**Tài khoản demo** (tạo tự động mỗi lần chạy seed, kể cả `--reset`, khai báo ở
[backend/prisma/seed.ts](../backend/prisma/seed.ts)):

| Vai trò | Email | Mật khẩu | Dùng để |
|---------|-------|----------|---------|
| Quản trị viên (ADMIN) | `admin@smartlap.vn` | `Demo@123` | Vào `/admin`: quản lý laptop, giá, benchmark, hãng máy, dashboard, người dùng |
| Nhân viên tư vấn (STAFF) | `staff@smartlap.vn` | `Demo@123` | Tư vấn, sửa laptop/giá, không có toàn quyền admin (không xem được Dashboard) |
| Khách hàng (CUSTOMER) | `khach@smartlap.vn` | `Demo@123` | Luồng người dùng cuối (Wizard → Kết quả → So sánh) |

Mật khẩu chung chỉ vì đây là dữ liệu demo cho đồ án. Đổi mật khẩu thì sửa cả `seed.ts` lẫn bảng này.

Ở màn đăng nhập khách hàng (`/login`) và quản trị (`/admin/login`), nếu `frontend/.env` bật
`VITE_DEMO=true` thì form sẽ tự điền sẵn tài khoản demo tương ứng để bấm đăng nhập nhanh. Tắt biến
này (hoặc xoá dòng đó) trước khi triển khai thật.

**Chạy tay lần đầu** (cần SQL Server, Python, Node.js):

```bash
# ML service
cd ml-service && pip install -r requirements.txt
python -m app.data.data_check && python -m app.lifecycle.train && python -m app.lifecycle.evaluate && pytest
uvicorn app.main:app --reload --port 8001

# Backend (terminal khác) — cấu hình kết nối theo backend/.env.example (DATABASE_URL, JWT_SECRET,
# ML_SERVICE_URL, ML_INTERNAL_KEY, PORT)
cd backend && npm install && npx prisma migrate dev && npm run seed && npm run seed:telemetry
npm run dev

# Frontend (terminal khác) — copy biến trong frontend/.env (VITE_API_URL, VITE_DEMO) nếu cần chỉnh
cd frontend && npm install && npm run dev
```

Sinh lại dữ liệu (chỉ khi cần): `python data/generate_catalog.py && python data/generate_personas.py`,
rồi `npm run seed -- --reset` ở backend. Chụp lại ảnh giao diện: `python scripts/capture_screenshots.py`.
Kiểm thử: `npm run test` (backend, vitest), `pytest` (ml-service), `npm run lint` (frontend, oxlint +
kiểm tra không hardcode màu).

