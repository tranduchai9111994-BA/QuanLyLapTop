# SmartLap — Hệ khuyến nghị laptop bằng kNN

Repo triển khai theo bộ đặc tả trong [docs/](docs/00_README.md). Đây là đồ án tốt nghiệp: hệ thống
tư vấn/gợi ý laptop dùng **kNN làm thuật toán lõi** (không phải luật if-else), gồm 3 mô hình kNN
khác nhau cho 3 việc: hiểu câu nhu cầu tự do, phân loại phân khúc máy mới, và xếp hạng gợi ý top-N.

**Muốn hiểu kNN hoạt động thế nào trong đồ án này — đọc [GIAI_THICH_THUAT_TOAN_KNN.md](GIAI_THICH_THUAT_TOAN_KNN.md) trước tiên**
(lịch sử, nguyên lý, ví dụ tính tay, giải thích code kèm trích dẫn file:dòng).

## Tài liệu quan trọng (đọc theo thứ tự khi cần)

| File | Nội dung |
|---|---|
| [GIAI_THICH_THUAT_TOAN_KNN.md](GIAI_THICH_THUAT_TOAN_KNN.md) | Giải thích kNN đầy đủ — bắt đầu từ đây nếu chưa biết gì về thuật toán |
| [KET_QUA_THUC_NGHIEM.md](KET_QUA_THUC_NGHIEM.md) | Số liệu thực nghiệm mới nhất (macro-F1, P@5/nDCG@5, so baseline) — nguồn số liệu DUY NHẤT, cập nhật mỗi lần retrain |
| [TAI_KHOAN_DANG_NHAP.md](TAI_KHOAN_DANG_NHAP.md) | Tài khoản demo (admin/staff/khách) |
| [CHECKLIST_PHIEN_LAM_VIEC.md](CHECKLIST_PHIEN_LAM_VIEC.md) | Nhật ký chi tiết mọi việc đã làm, đối chiếu từng yêu cầu — dùng để tự kiểm |
| [TONG_HOP_THAY_DOI_PHIEN_NAY.md](TONG_HOP_THAY_DOI_PHIEN_NAY.md) | Tóm tắt nhanh thay đổi phiên làm việc gần nhất |
| [HUONG_DAN_THUAT_TOAN_KNN.md](HUONG_DAN_THUAT_TOAN_KNN.md) | Tài liệu kNN viết sớm hơn, còn vài đoạn code chi tiết hữu ích (đã đánh dấu 2 chỗ lỗi thời) |

## Chạy nhanh — icon Desktop

Đã tạo shortcut **`SmartLap`** trên Desktop, bấm đúp để khởi động cả 3 dịch vụ (ML service, backend,
frontend) **hoàn toàn ẩn** (không hiện cửa sổ terminal nào) rồi tự mở trình duyệt tới
`http://localhost:5180` khi frontend sẵn sàng. Đo thực tế: **~4,3 giây** từ lúc bấm icon đến khi
frontend phản hồi HTTP 200 (3 dịch vụ chạy song song, gọi thẳng node/vite/uvicorn thay vì qua lớp
`npm run`/wrapper trung gian).

Cơ chế: `start-smartlap.vbs` → `start-smartlap.ps1` (PowerShell ẩn) → mỗi dịch vụ chạy nền, log ghi
vào `logs/*.log`. Chạy `stop-smartlap.bat`/`stop-smartlap.ps1` để tắt toàn bộ.

Yêu cầu trước khi dùng icon: SQL Server, Python, Node.js đã cài, và các bước `npm install`/
`pip install`/`prisma migrate`/seed ở dưới đã chạy ít nhất một lần.

**Truy cập quản trị**: menu trang khách hàng có link "Quản trị viên / Nhân viên" ở góc phải
(`/admin/login`) — tài khoản demo xem [TAI_KHOAN_DANG_NHAP.md](TAI_KHOAN_DANG_NHAP.md).

## Chạy toàn bộ hệ thống (Windows, SQL Server cục bộ)

```bash
# 1) Dữ liệu (đã sinh sẵn trong data/, chỉ cần chạy lại nếu muốn tái sinh)
python data/generate_catalog.py
python data/generate_personas.py

# 2) Dịch vụ ML
cd ml-service
pip install -r requirements.txt
python -m app.data_check
python -m app.train
pytest                      # 34 test
uvicorn app.main:app --port 8001

# 3) Backend (mở terminal khác) — can SQL Server, xem backend/.env.example
cd backend
npm install
npx prisma migrate dev
npm run seed                 # them --reset de xoa sach va sinh lai catalog
npm run seed:telemetry
npm run dev

# 4) Frontend (mở terminal khác)
cd frontend
npm install
npm run dev
```

## Tính năng chính đã hoàn thiện

- **Mô hình A** (kNN phân lớp): tự động gợi ý phân khúc cho laptop mới khi admin nhập liệu —
  "AI gợi ý phân khúc từ cấu hình" ở màn Thêm/Sửa Laptop.
- **Mô hình B** (kNN truy hồi, khoảng cách một phía): xếp hạng top-5 gợi ý theo hồ sơ nhu cầu,
  không phạt máy mạnh hơn/rẻ hơn mức cần. Đưa cả **giá, thương hiệu (brand_tier), khuyến mãi và
  lượt bán** vào metric xếp hạng thật, không chỉ hiển thị.
- **Mô hình C** (TF-IDF + kNN cosine): hiểu câu nhu cầu tự do tiếng Việt ("con học kế toán, cần
  máy bền, rẻ") — tự suy ra nhóm nhu cầu, ngân sách, mức ưu tiên.
- **CRUD quản trị đầy đủ**: Hãng máy (kèm mức uy tín `tier`), Benchmark CPU/GPU, Laptop (kèm gợi ý
  AI phân khúc), Quản lý giá (lịch sử giá, khuyến mãi, lượt bán, điều chỉnh hàng loạt theo %) —
  mọi tham số chuẩn hoá đều dùng dropdown (không cho gõ tay giá trị vô lý).
- **Ảnh sản phẩm thật**: 5 hãng (Apple/ASUS/Huawei/Lenovo/Dell) dùng ảnh thật tải qua API công khai
  DummyJSON (`scripts/fetch_brand_photos.py`, gọi API thật, không phải file tĩnh không rõ nguồn
  gốc); 7 hãng còn lại dùng minh hoạ vẽ tay vì API không có ảnh thật cho các hãng đó.
- **Empty state đầy đủ** ở mọi trang có thể rỗng (Catalog/Results/Detail/Compare), bộ lọc đa điều
  kiện (giá/RAM/hãng/từ khóa/card rời), bố cục đã tối ưu cho màn hình rộng.
- **Sắp xếp đa tiêu chí (checkbox kết hợp)**: chọn nhiều tiêu chí cùng lúc (vd "Hiệu năng cao
  nhất" + "Đáng tiền nhất"), thứ tự chọn là mức ưu tiên — sắp đa cấp thật ở backend (Prisma
  `orderBy` dạng mảng), không phải sắp rồi cắt phía client.

## Đã kiểm thử THẬT (không chỉ code, có bằng chứng cụ thể)

- `pytest` (ml-service): 34/34 pass.
- `npx tsc --noEmit` (backend + frontend): sạch, không lỗi.
- **CRUD admin đã kiểm thử trực tiếp trên browser** — cả thủ công lẫn script Playwright tự động
  (`scripts/capture_crud_test.py`), ảnh bằng chứng lưu ở `crud_test_screenshots/`. Quá trình này
  phát hiện và sửa được 2 lỗi thật đang tồn tại trong code trước đó:
  1. Sửa (không phải thêm mới) một laptop có sẵn trường optional đang `null` bị từ chối do lỗi
     zod `.optional()` (chỉ chấp nhận `undefined`, không chấp nhận `null`).
  2. "AI gợi ý phân khúc" báo thiếu dữ liệu dù đã điền đủ khi TẠO MỚI laptop — do đọc nhầm field
     `resWidth`/`resHeight` (chỉ có giá trị lúc bấm Lưu) thay vì field `resolution` thật trên form.
- Ảnh chức năng: [screenshots/](screenshots/) (16 ảnh, chụp lại bằng
  `python scripts/capture_screenshots.py` mỗi khi giao diện đổi).

## Việc còn lại trước khi bảo vệ (trung thực, không giấu)

1. Dữ liệu vẫn là **dữ liệu tổng hợp có logic**, không phải catalog thu thập thật từ thị trường —
   xem [data/README.md](data/README.md).
2. Chạy thí nghiệm đối chứng Kaggle (`docs/04 §6.4`) — chưa có file `laptop_price.csv`.
3. Ablation study tách bạch cho tính năng khuyến mãi/lượt bán (bật/tắt so sánh trên cùng 1 bộ dữ
   liệu) — hiện chưa chạy, xem [KET_QUA_THUC_NGHIEM.md](KET_QUA_THUC_NGHIEM.md) mục 4.1.
4. Chưa có test tự động cho backend (`vitest`/`supertest`) và frontend (Vitest/Testing Library) —
   chỉ có pytest (ml-service) + kiểm thử thủ công/Playwright end-to-end cho phần còn lại.
5. `alertScan`/`retrainCheck` cron thật chưa cài (hiện chỉ có `snapshotSync`).

## Cấu trúc

```
smartlap/ (repo root = D:\QL_Laptop)
├── backend/                # Express + Prisma + SQL Server (README riêng)
├── ml-service/              # FastAPI + scikit-learn, 3 mô hình kNN (README riêng)
├── frontend/                 # React + Vite + AntD, khách hàng + quản trị (README riêng)
├── data/                     # catalog tổng hợp có logic, benchmark, personas (README riêng)
├── screenshots/               # ảnh chức năng cho báo cáo
├── crud_test_screenshots/     # ảnh bằng chứng kiểm thử CRUD trên browser
├── scripts/                   # script tiện ích (chụp ảnh, tải ảnh brand, test CRUD)
└── docs/                      # bộ đặc tả gốc (không sửa)
```
