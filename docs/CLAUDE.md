# CLAUDE.md — Quy ước bắt buộc cho Claude Code

## Trước khi code
- Đọc `00_README.md` → `01` → file tương ứng với giai đoạn đang làm (xem `10_KE_HOACH_TRIEN_KHAI.md`).
- Có điểm chưa rõ thì **hỏi lại trước khi thực thi**, đưa lựa chọn dạng trắc nghiệm.
- Làm đúng giai đoạn, chỉ sang giai đoạn sau khi đạt tiêu chí nghiệm thu.

## Ngôn ngữ
- Mọi chuỗi hiển thị cho người dùng: **tiếng Việt có dấu**. Tên biến, hàm, bảng: tiếng Anh.
- Tiền tệ: `Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' })` → `25.990.000 ₫`.
- Ngày giờ: `DD/MM/YYYY HH:mm`, múi giờ Asia/Ho_Chi_Minh.

## Prisma + SQL Server — giới hạn phải nhớ
- SQL Server **không hỗ trợ `enum`** trong Prisma → dùng `String` + hằng số TypeScript + validate bằng zod.
- SQL Server **không hỗ trợ kiểu `Json`** trong Prisma → dùng `String @db.NVarChar(Max)`, parse/stringify ở tầng service, có hàm tiện ích `toJson()/fromJson()` dùng chung.
- Chuỗi tiếng Việt dùng `@db.NVarChar(n)`.

## Frontend
- **Cấm hardcode mã màu** trong `.tsx` — chỉ dùng token trong `src/theme/tokens.ts` hoặc CSS variable (ESLint rule ở `07_UIUX.md` mục 10).
- Mọi màn có dữ liệu phải xử lý đủ 4 trạng thái: đang tải (Skeleton), rỗng (Empty), lỗi (Result/Alert), chế độ dự phòng (banner).
- Biểu đồ dùng Recharts với bảng màu phân khúc cố định.

## Dịch vụ ML
- Mọi tiền xử lý nằm trong `sklearn.pipeline.Pipeline` — **không bao giờ** fit scaler ngoài pipeline (tránh rò rỉ dữ liệu khi CV).
- Seed cố định `RANDOM_STATE = 42`.
- Mỗi lần huấn luyện sinh thư mục `artifacts/<version>/` gồm `model.joblib`, `metadata.json`.
- Kiểm thử bắt buộc: xem `04_MO_HINH_KNN.md` mục 9.

## Backend
- Cấu trúc module: `routes → controller → service → prisma`. Validate đầu vào bằng zod.
- Gọi ML service qua `mlClient.ts` có timeout 3 s; lỗi/timeout → chuyển sang chế độ dự phòng (`09_VONG_DOI_TRI_TUE.md` mục 4), **không trả lỗi 500 cho người dùng cuối**.
- Mọi lượt khuyến nghị đều ghi `RecommendationSession` (telemetry).

## Lệnh chuẩn
```
backend:    npm run dev | npm run test | npx prisma migrate dev | npm run seed
ml-service: uvicorn app.main:app --reload --port 8001 | pytest | python -m app.lifecycle.train
frontend:   npm run dev | npm run build | npm run lint
```
