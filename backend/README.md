# backend — SmartLap API (Express + TypeScript + Prisma + SQL Server)

## Chạy

```bash
npm install
npx prisma migrate dev     # can SQL Server that (xem .env)
npm run seed                # 3 tai khoan demo + catalog + benchmark
npm run seed:telemetry      # 400 phien tu van gia lap cho dashboard/phan hoi
npm run dev                  # http://localhost:4000
```

`.env.example` liệt kê biến môi trường cần có. `DATABASE_URL` mặc định trỏ tới SQL Server cục bộ
(database `SmartLap`, login `smartlap_app`) — đã kiểm thử thật trên máy phát triển, không phải giả lập.
Tài khoản demo (admin/staff/khách): xem [`../docs/TAI_KHOAN_DANG_NHAP.md`](../docs/TAI_KHOAN_DANG_NHAP.md).

## Đã kiểm thử thủ công (end-to-end với SQL Server + ML service thật)

- `POST /auth/login`, `GET /laptops` — hoạt động.
- `POST /recommendations` với `segment=null` → gọi ML `/infer-segment` → lọc cứng → ML `/recommend`
  → ghi `RecommendationSession` — hoạt động, trả về giải thích tiếng Việt.
- **Tắt ML service** → `POST /recommendations` vẫn trả `200` với `mode: "FALLBACK"` (xếp hạng theo
  `performanceIdx`/`valueIdx`) — **đạt tiêu chí nghiệm thu GĐ4 quan trọng nhất**.
- `GET /dashboard/kpis` sau khi chạy `seed:telemetry` → số liệu hợp lý (403 phiên, likeRate 72,8%).
- CRUD quản trị (Hãng máy/Benchmark CPU-GPU/Laptop/Quản lý giá) kiểm thử trên browser bằng
  `scripts/capture_crud_test.py`; các lỗi phát hiện được và cách sửa ghi ở
  [`../docs/CHECKLIST_PHIEN_LAM_VIEC.md`](../docs/CHECKLIST_PHIEN_LAM_VIEC.md) mục 4.

## Việc còn thiếu / rút gọn so với đặc tả đầy đủ (docs/06)

Do giới hạn thời gian của phiên làm việc này, các phần sau được **rút gọn hoặc chưa làm**:

- `models/train` chạy đồng bộ (chờ ML huấn luyện xong mới trả response) thay vì chạy nền + `jobId`
  như đặc tả. Với ~300 mẫu việc này chỉ mất vài giây nên chấp nhận được cho demo, nhưng cần đổi
  sang hàng đợi nền nếu dữ liệu lớn hơn.
- `alertScan` (cron 15 phút tính KPI cửa sổ trượt, ghi `AlertLog`) và `retrainCheck` (cron Chủ nhật
  huấn luyện challenger tự động) **chưa cài đặt** — bảng `AlertLog` đã có schema, `GET /dashboard/alerts`
  đọc được nhưng chưa có tiến trình nào ghi vào đó.
- Rate limit `/recommendations` (30 req/phút/IP) và header `X-Internal-Key` cho ML service **chưa
  được middleware thực sự kiểm tra** ở phía ML (mới gửi header từ backend, ML service chưa validate).
- Chưa có test tự động (`vitest`/`supertest`) cho backend — mọi kiểm thử ở trên là thủ công qua `curl`.
  Nên bổ sung test cho `recommend.service.ts` (đặc biệt nhánh fallback) trước khi coi là hoàn thiện.
- `/labels/review-queue` (hàng đợi duyệt nhãn đáng ngờ), `/users`, `/audit-logs` chưa có route.

Những phần trên nên làm tiếp trước khi bảo vệ nếu hội đồng hỏi sâu về vòng đời trí tuệ (docs/09).
