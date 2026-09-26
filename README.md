# SmartLap — Hệ khuyến nghị laptop bằng kNN

Repo triển khai theo bộ đặc tả trong [docs/](docs/00_README.md). Trạng thái tính đến phiên làm việc
này: **GĐ1–GĐ5 đã triển khai và kiểm thử thật** (dữ liệu mô phỏng, dịch vụ ML, backend, frontend
khách hàng); **GĐ6 (frontend quản trị) và một phần GĐ7 chưa làm** — xem mục "Việc còn lại" bên dưới.

## Chạy toàn bộ hệ thống (Windows, SQL Server cục bộ)

```bash
# 1) Dữ liệu (đã sinh sẵn trong data/, chỉ cần chạy lại nếu muốn tái sinh)
python data/generate_mock_catalog.py

# 2) Dịch vụ ML
cd ml-service
pip install -r requirements.txt
python -m app.data_check
python -m app.train
pytest
uvicorn app.main:app --port 8001

# 3) Backend (mở terminal khác) — can SQL Server, xem backend/.env.example
cd backend
npm install
npx prisma migrate dev
npm run seed
npm run seed:telemetry
npm run dev

# 4) Frontend (mở terminal khác)
cd frontend
npm install
npm run dev
```

## Trạng thái từng giai đoạn (docs/10_KE_HOACH_TRIEN_KHAI.md)

| GĐ | Trạng thái | Ghi chú |
|---|---|---|
| 1. Dữ liệu | ✅ (mô phỏng) | 315 mẫu, ≥50/lớp, chưa có kappa thật — xem [data/README.md](data/README.md) |
| 2. Dịch vụ ML | ✅ | 9/9 test, train sinh artifact+ảnh, ablation — xem [ml-service/README.md](ml-service/README.md) |
| 3. Backend nền | ✅ | Prisma + SQL Server thật, seed, tính ppi/performanceIdx/valueIdx |
| 4. Backend thông minh | ✅ (rút gọn) | `/recommendations` đủ 7 bước + fallback đã kiểm thử tắt ML — xem [backend/README.md](backend/README.md) |
| 5. Frontend khách hàng | ✅ (màn 1–5, chưa đủ 8 màn) | Luồng Trang chủ→Wizard→Kết quả→Vì sao→👍/👎→Chi tiết→Tương tự→So sánh đã chạy được trên trình duyệt thật |
| 6. Frontend quản trị | ❌ chưa làm | Backend đã có API (`/models`, `/knowledge`, `/dashboard`) nhưng chưa có giao diện |
| 7. Hoàn thiện & báo cáo | ⚠️ một phần | Ảnh chức năng đã có ở [screenshots/](screenshots/); chưa chạy kịch bản demo 3 lần, chưa viết báo cáo |

## Ảnh chức năng cho báo cáo

Thư mục [screenshots/](screenshots/) chứa 7 ảnh chụp luồng khách hàng (Trang chủ, Wizard, Kết quả,
Vì sao gợi ý, Chi tiết, So sánh). Chạy lại `python scripts/capture_screenshots.py` (cần frontend ở
cổng 5180 và backend ở 4000 đang chạy) để tái tạo hoặc bổ sung ảnh khi giao diện thay đổi.

## Việc còn lại trước khi bảo vệ

1. **Thay dữ liệu mô phỏng bằng catalog VN thật** (250–350 máy) theo `docs/03` — đây là việc quan
   trọng nhất, vì mọi con số hiện tại (macro-F1 0,957, so sánh với luật thủ công) đều dựa trên dữ
   liệu tổng hợp có ranh giới phân khúc sạch hơn thực tế.
2. Chạy thí nghiệm đối chứng Kaggle (`docs/04 §6.4`) — chưa có file `laptop_price.csv` trong phiên này.
3. Xây frontend quản trị (GĐ6: màn 9–16) — thêm/sửa laptop, xem confusion matrix, promote/rollback
   mô hình, dashboard KPI, cấu hình tri thức. Backend đã có API sẵn sàng.
4. Cài `alertScan`/`retrainCheck` cron thật (hiện chỉ có `snapshotSync`).
5. Viết test tự động cho backend (`vitest`/`supertest`) — hiện chỉ kiểm thử thủ công qua `curl`.
6. Chạy kịch bản demo 10 phút (`docs/11`) ba lần, chụp thêm ảnh cho các phần còn thiếu, viết báo
   cáo theo khung ở `docs/10_KE_HOACH_TRIEN_KHAI.md` §"Khung báo cáo gợi ý".

## Cấu trúc

```
smartlap/ (repo root = D:\QL_Laptop)
├── backend/            # Express + Prisma + SQL Server (README riêng)
├── ml-service/         # FastAPI + scikit-learn (README riêng)
├── frontend/            # React + Vite + AntD (khách hàng)
├── data/                # catalog mô phỏng, benchmark, personas (README riêng)
├── screenshots/         # ảnh chức năng cho báo cáo
├── scripts/             # script tiện ích (chụp ảnh màn hình)
└── docs/                # bộ đặc tả gốc (không sửa)
```
