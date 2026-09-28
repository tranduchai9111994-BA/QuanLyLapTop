# 10 — Kế hoạch triển khai 7 giai đoạn

> Mỗi giai đoạn chỉ bắt đầu khi giai đoạn trước đạt **toàn bộ** tiêu chí nghiệm thu. Claude Code: làm từng giai đoạn, báo cáo kết quả tiêu chí trước khi sang giai đoạn sau.

## Trạng thái tổng thể

| Giai đoạn | Hạng mục | Trạng thái |
|---|---|---|
| GĐ 1 | Dữ liệu | ✅ Hoàn thành |
| GĐ 2 | Dịch vụ ML | ✅ Hoàn thành |
| GĐ 3 | Backend nền | ✅ Hoàn thành |
| GĐ 4 | Backend thông minh | ✅ Hoàn thành |
| GĐ 5 | Frontend khách hàng | ✅ Hoàn thành |
| GĐ 6 | Frontend quản trị | ✅ Hoàn thành |
| GĐ 7 | Hoàn thiện, báo cáo, bảo vệ | 🔶 Đang hoàn thiện (mã nguồn xong, còn báo cáo/slide/luyện demo) |

Toàn bộ 3 dịch vụ (backend, ml-service, frontend) đã chạy được đồng thời qua shortcut Desktop
`SmartLap` (xem `00_README.md` mục 5). Phần còn lại của kế hoạch chủ yếu là viết báo cáo, chụp ảnh
minh hoạ và luyện tập kịch bản bảo vệ (`11_KICH_BAN_DEMO_VA_HOI_DAP.md`).

## GĐ 1 — Dữ liệu (song song: cả nhóm thu thập)
**Việc:** mẫu Excel thu thập; thu 250–350 máy; bảng benchmark CPU/GPU; tải Kaggle; `data_check.py`; script chuyển `raw → processed`; tính Cohen's kappa trên 40 mẫu; 30 persona.
**Nghiệm thu:**
- [x] `data_check.py` không còn lỗi; mỗi lớp ≥ 50 mẫu (hoặc ghi rõ lý do + quyết định gộp lớp theo D-03)
- [x] 100% CPU/GPU khớp bảng benchmark
- [x] Kappa được tính và ghi vào `data/README.md`
- [x] `personas.json` 30 mục, mỗi mục có `expect`

## GĐ 2 — Dịch vụ ML
**Việc:** `features.py`, `classifier.py`, `train.py` (grid search, baseline, ablation, Kaggle), `retriever.py`, `explain.py`, `registry.py`, FastAPI routes, tests.
**Nghiệm thu:**
- [x] `pytest` xanh toàn bộ test 04 §9
- [x] `python -m app.train` sinh artifact + `metadata.json` + ảnh confusion matrix + đường cong k
- [x] Bảng kết quả Mô hình A đủ các dòng: Dummy, Luật, kNN tốt nhất, 3 cấu hình mất cân bằng, ablation, Kaggle
- [x] `/recommend` trả kết quả < 50 ms với catalog 300 máy

## GĐ 3 — Backend nền
**Việc:** Prisma schema + migrate, seed, auth, CRUD brands/benchmarks/laptops, tính `ppi`, `performanceIdx`, `valueIdx`, `PriceHistory`, `mlClient`, `snapshotSync`.
**Nghiệm thu:**
- [x] `npx prisma migrate dev` chạy sạch trên SQL Server
- [x] Seed tạo 3 tài khoản demo và toàn bộ catalog
- [x] Sửa laptop → ML `/health` thấy `catalogSize` đúng trong < 5 s
- [x] Test service cho tính chỉ số

## GĐ 4 — Backend thông minh
**Việc:** `/recommendations` (7 bước 06 §3.2), `infer-segment`, `fallback.service`, `similar`, `predict-segment`, events, models (train/promote/rollback + kiểm quy tắc), knowledge config & pins, dashboard KPI, `alertScan`, `seed:telemetry`.
**Nghiệm thu:**
- [x] Tắt ML service → `/recommendations` vẫn 200, `mode = FALLBACK`
- [x] Máy BAN không bao giờ xuất hiện; máy PIN có nhãn đúng
- [x] Promote bị từ chối kèm lý do khi challenger vi phạm quy tắc 09 §2.3
- [x] Mọi lượt tư vấn có `RecommendationSession`
- [x] Integration test: persona P01–P05 qua API đạt `expect`

## GĐ 5 — Frontend khách hàng
**Việc:** theme + tokens + ESLint rule, layout, component `smart/`, các màn: Trang chủ, Danh mục, Wizard, Kết quả, Chi tiết, So sánh, Yêu thích, Lịch sử.
**Nghiệm thu:**
- [x] Checklist 07 §12 đạt cho mọi màn
- [x] Luồng Trang chủ → Wizard → Kết quả → Vì sao → 👍 → Chi tiết → Tương tự → So sánh chạy trơn tru
- [x] Wizard "Chưa rõ" hiện gợi ý phân khúc thời gian thực

## GĐ 6 — Frontend quản trị
**Việc:** các màn quản trị: Hãng máy, Benchmark CPU/GPU, Laptop, Giá, Duyệt nhãn phân khúc, Quản lý mô hình, Cấu hình tri thức, Dashboard, Phản hồi, Người dùng.
**Nghiệm thu:**
- [x] Thêm laptop mới → gợi ý phân khúc AI + láng giềng hiển thị
- [x] Màn Quản lý mô hình hiện confusion matrix, đường cong k, baseline, bảng precision/recall/F1, promote/rollback hoạt động
- [x] Màn Phản hồi sinh ít nhất 1 đề xuất với dữ liệu `seed:telemetry`
- [x] Dashboard hiện cảnh báo khi hạ ngưỡng thử

## GĐ 7 — Hoàn thiện, báo cáo, bảo vệ
**Việc:** chạy kịch bản demo 3 lần, sửa lỗi; chụp màn hình cho báo cáo; xuất bảng số liệu; viết báo cáo theo khung dưới; slide.
**Nghiệm thu:**
- [ ] Demo 10 phút không lỗi, có phương án khi mất mạng (chạy local toàn bộ)
- [ ] Mọi con số trong báo cáo truy được về file artifact/metadata

## Khung báo cáo gợi ý
| Chương báo cáo | Nội dung | Nguồn |
|---|---|---|
| 1. Tổng quan | Bài toán, vì sao cần hệ thông minh, mục tiêu | 01 §1–2 |
| 2. Cơ sở lý thuyết | Hệ khuyến nghị, content-based, kNN, khoảng cách, chuẩn hóa, đánh giá | 04 §2, 12 |
| 3. Phân tích thiết kế | Use case, CSDL, kiến trúc, API | 02, 05, 06 |
| 4. Dữ liệu và mô hình | Thu thập, gán nhãn, kappa, đặc trưng, thực nghiệm, kết quả | 03, 04 |
| 5. Triển khai và vòng đời trí tuệ | Giao diện, phản hồi, versioning, dự phòng, giám sát | 07–09 |
| 6. Kết luận | Đạt được, hạn chế, hướng phát triển | 11 §4 |

## Phân công đề xuất
| Thành viên | Vai trò chính |
|---|---|
| Trần Đức Hải | Dịch vụ ML, thực nghiệm, chương 2 & 4 báo cáo, điều phối |
| Cao Thị Vân | Frontend + UI/UX, dữ liệu phân khúc Mỏng nhẹ & Văn phòng, chương 5 |
| Nguyễn Quốc Duy | Backend + CSDL, dữ liệu Gaming & Đồ họa, chương 3 |
