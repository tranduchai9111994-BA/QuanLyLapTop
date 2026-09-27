# frontend — SmartLap (React + TypeScript + Vite + AntD)

## Chạy

```bash
npm install
npm run dev     # http://localhost:5180 (port cố định, xem package.json)
npx tsc --noEmit  # kiểm tra kiểu tĩnh (không build)
```

Backend (port 4000) và ML service (port 8001) phải đang chạy để trang hoạt động đầy đủ (xem
[`../docs/00_README.md`](../docs/00_README.md) mục "Chạy hệ thống").

## Cấu trúc trang (route)

| Route | Trang | Mô tả |
|---|---|---|
| `/` | `Home.tsx` | Trang chủ, giới thiệu + CTA vào Wizard |
| `/wizard` | `Wizard.tsx` | Nhập nhu cầu (câu tự do hoặc chọn thủ công) — gọi Mô hình C |
| `/results` | `Results.tsx` | Danh sách top-5 gợi ý — gọi Mô hình B |
| `/laptops` | `Catalog.tsx` | Danh mục đầy đủ, lọc đa điều kiện (giá/RAM/hãng/từ khóa/card rời) |
| `/laptop/:id` | `Detail.tsx` | Chi tiết 1 máy + máy tương tự (item-item kNN) |
| `/compare` | `Compare.tsx` | So sánh nhiều máy dạng bảng |
| `/admin/login` | `admin/AdminLogin.tsx` | Đăng nhập quản trị (tài khoản demo: xem `../docs/00_README.md` mục "Chạy hệ thống") |
| `/admin/brands`, `/admin/benchmarks/cpu`, `/admin/benchmarks/gpu`, `/admin/laptops` | CRUD dùng chung `components/admin/CrudTable.tsx` |
| `/admin/prices` | `admin/AdminPrices.tsx` | Quản lý giá + khuyến mãi + lượt bán riêng (nghiệp vụ đổi giá thường xuyên) |

## Component đáng chú ý

- `components/admin/CrudTable.tsx` — bảng CRUD dùng chung cho 4 màn quản trị (Brand/Benchmark
  CPU/Benchmark GPU/Laptop): sinh cột/form tự động từ khai báo `fields`, có xuất/nhập Excel.
- `components/smart/DiscountBadge.tsx` — hiển thị giá gốc gạch ngang + % giảm + "Đã bán N", dùng
  chung ở Catalog/RecommendationCard/Detail.
- `components/admin/SegmentSuggester.tsx` — nút "AI gợi ý phân khúc từ cấu hình" khi thêm/sửa
  laptop (tiêu chí 3: hệ thống tự học/tự phân loại máy mới), gọi Mô hình A qua
  `POST /laptops/predict-segment`.
- `components/smart/LaptopThumbnail.tsx` — ảnh sản phẩm: ảnh thật (DummyJSON API, 5 hãng) hoặc
  minh hoạ vẽ tay (7 hãng còn lại). Ảnh thật tải qua `../scripts/fetch_brand_photos.py` (gọi API
  thật, không phải file tĩnh không rõ nguồn gốc).

## Kiểm thử đã làm

- `npx tsc --noEmit` — sạch, chạy lại sau mỗi lần sửa lớn.
- CRUD admin đã kiểm thử THẬT trên browser (thủ công + script Playwright tự động
  `../scripts/capture_crud_test.py`) — ảnh chụp từng thao tác ở `../crud_test_screenshots/`.
- Chưa có test tự động cấp component (Vitest/Testing Library) — mọi kiểm thử hiện tại là thủ
  công qua trình duyệt hoặc script Playwright cấp end-to-end.
