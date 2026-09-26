# 06 — Kiến trúc và API

## 1. Kiến trúc tổng quan

```
┌────────────────────┐   HTTPS/JSON   ┌──────────────────────────┐   HTTP/JSON   ┌─────────────────────────┐
│  Frontend (React)  │ ─────────────► │ Backend (Express + TS)   │ ────────────► │ ML service (FastAPI)    │
│  Vite, AntD,       │ ◄───────────── │ Auth, nghiệp vụ, lọc     │ ◄──────────── │ Mô hình A, Mô hình B,   │
│  Recharts          │                │ cứng, telemetry, dự phòng│   timeout 3 s │ huấn luyện, artifact    │
└────────────────────┘                └────────────┬─────────────┘               └───────────┬─────────────┘
                                                   │ Prisma                                   │ đọc snapshot
                                            ┌──────▼──────┐                                   │ catalog + nhãn
                                            │ SQL Server  │ ◄──── backend xuất snapshot ──────┘
                                            └─────────────┘
```

Phân vai rõ ràng:
- **Backend** là nguồn sự thật: dữ liệu, quyền, lọc cứng, ghim/loại, ghi telemetry, chế độ dự phòng.
- **ML service** không kết nối DB. Nhận snapshot catalog qua API, giữ chỉ mục trong bộ nhớ, trả kết quả tính toán. Nhờ vậy ML service tắt đi thì hệ thống vẫn chạy (09 §4).

## 2. Cấu trúc mã nguồn

```
backend/src/
├── config/  constants/  middlewares/ (auth, role, error, requestId)
├── lib/ (prisma.ts, json.ts, mlClient.ts, logger.ts)
├── modules/
│   ├── auth/  users/  brands/  benchmarks/  laptops/
│   ├── recommendations/   # recommend.service.ts, fallback.service.ts, ideal.ts
│   ├── feedback/          # events, tổng hợp lý do
│   ├── models/            # versions, train, promote, rollback
│   ├── knowledge/         # config, pins
│   ├── dashboard/         # KPI, alerts
│   └── jobs/              # cron: alertScan, snapshotSync
└── app.ts, server.ts

ml-service/app/
├── main.py            # FastAPI routes
├── schemas.py         # pydantic
├── features.py        # ColumnTransformer, dựng đặc trưng
├── classifier.py      # Mô hình A
├── retriever.py       # Mô hình B, vector lý tưởng, trọng số
├── explain.py         # build_explanation
├── train.py           # grid search, baseline, ablation, lưu artifact
├── registry.py        # nạp / kích hoạt phiên bản
└── data_check.py
```

## 3. API Backend (`/api`)

Chuẩn phản hồi: `{ "success": true, "data": ..., "meta"?: ... }` / `{ "success": false, "error": { "code", "message" } }` (message tiếng Việt).

### 3.1 Công khai
| Phương thức | Đường dẫn | Mô tả |
|---|---|---|
| POST | `/auth/login` | `{email, password}` → `{token, user}` |
| GET | `/auth/me` | |
| GET | `/laptops` | Lọc: `segment, brandIds, priceMin, priceMax, ramMin, weightMax, q, sort (price_asc, price_desc, perf_desc, value_desc), page, pageSize` |
| GET | `/laptops/:id` | Chi tiết + nhãn + lịch sử giá |
| GET | `/laptops/:id/similar?k=6` | Mô hình B item-item |
| GET | `/laptops/compare?ids=1,2,3` | |
| POST | `/recommendations` | Lõi khuyến nghị (3.2) |
| POST | `/recommendations/infer-segment` | Chỉ suy phân khúc từ hoạt động (dùng ở bước 1 wizard) |
| POST | `/events` | `{sessionId?, laptopId, type, reason?, note?}` |
| GET/POST/DELETE | `/me/favorites` | KH |
| GET | `/me/sessions` | Lịch sử tư vấn |

### 3.2 `POST /recommendations`

Request:
```json
{
  "segment": null,
  "activities": ["lap_trinh", "choi_game"],
  "budget": { "min": 18000000, "max": 22000000 },
  "priorities": { "performance": 4, "mobility": 3, "display": 2, "price": 3 },
  "must": { "ramMin": 16, "ssdMin": 512, "weightMax": null, "brandIds": [] },
  "topN": 5
}
```

Xử lý trong `recommend.service.ts`:
1. Validate zod. Bắt đầu đo thời gian.
2. Nếu `segment = null` → gọi ML `/predict-segment` với vector từ hoạt động → `inferredSegment`, `inferredConf`.
3. Lọc cứng trong DB: `isActive`, giá ≤ max, `must.*`, bỏ BAN, lọc theo phân khúc đã dùng.
4. Nếu ứng viên < `min_candidates` → nới giá `×(1 + budget_relax_ratio)`, bật `budgetRelaxed`; vẫn thiếu → bỏ lọc phân khúc, trả kèm cảnh báo.
5. Gọi ML `/recommend` với `candidateIds`, weights, ideal. Lỗi/timeout → `fallback.service.ts`.
6. Chèn máy PIN nếu có (04 §4.4).
7. Ghi `RecommendationSession` + `RecommendationItem`.

Response:
```json
{
  "success": true,
  "data": {
    "sessionId": "8b1f…",
    "segment": { "used": "GAMING", "inferred": "GAMING", "confidence": 0.72,
                 "alternative": null, "neighbors": [{ "name": "…", "segment": "GAMING", "distance": 0.41 }] },
    "mode": "ML",                        // ML | FALLBACK
    "budgetRelaxed": false,
    "ideal": { "cpuScore": 62, "gpuScore": 48, "ramGb": 16, "weightKg": 2.0, "priceVnd": 20400000, "...": "..." },
    "weights": { "cpuScore": 0.14, "gpuScore": 0.14, "...": "..." },
    "items": [{
      "rank": 1, "laptopId": 42, "matchPct": 91.3, "distance": 0.37, "isPinned": false,
      "badges": ["VALUE_BEST"],
      "explanation": {
        "strengths": [{ "code": "gpu_dedicated", "params": { "gpu": "RTX 3050 4GB" } }],
        "warnings":  [{ "code": "weight_over", "params": { "x": 2.2, "d": 0.2 } }]
      },
      "laptop": { "id": 42, "name": "…", "priceVnd": 19990000, "imageUrl": "…", "segment": "GAMING", "...": "..." }
    }],
    "modelVersion": "clf-2026.10.05-01",
    "latencyMs": 212
  }
}
```

### 3.3 Nhân viên / Quản trị
| Phương thức | Đường dẫn | Quyền |
|---|---|---|
| POST/PUT/DELETE | `/laptops`, `/laptops/:id` | STAFF, ADMIN |
| POST | `/laptops/predict-segment` | STAFF — gợi ý khi đang nhập form |
| PATCH | `/laptops/:id/segment` | STAFF — `{segment, locked?, note?}` → source ADMIN, VERIFIED |
| GET | `/labels/review-queue` | STAFF |
| CRUD | `/benchmarks/cpu`, `/benchmarks/gpu` | ADMIN |
| GET | `/models`, `/models/:version` | ADMIN |
| POST | `/models/train` | ADMIN — chạy nền, trả `jobId` |
| GET | `/models/train/:jobId` | ADMIN — trạng thái |
| POST | `/models/:version/promote` | ADMIN — kiểm tra quy tắc 09 §2.3 |
| POST | `/models/:version/rollback` | ADMIN |
| GET/PUT | `/knowledge/config/:key` | ADMIN |
| CRUD | `/knowledge/pins` | ADMIN |
| GET | `/dashboard/kpis?from&to` | ADMIN |
| GET | `/dashboard/alerts` | ADMIN |
| GET | `/feedback/summary?from&to&segment` | ADMIN |
| GET | `/users`, `/audit-logs` | ADMIN |

## 4. API ML service (`:8001`)

| Phương thức | Đường dẫn | Mô tả |
|---|---|---|
| GET | `/health` | `{status, clfVersion, catalogSize, indexBuiltAt}` |
| POST | `/catalog/sync` | Backend đẩy snapshot `[{id, features…, segment}]` → dựng lại chỉ mục Mô hình B |
| POST | `/predict-segment` | `{items: [features]}` → `[{label, proba, neighbors}]` |
| POST | `/recommend` | `{candidateIds, segment, budget, priorities, must, topN, baseWeights, percentiles}` → `{ideal, weights, items[{id, distance, matchPct, explanation}]}` |
| POST | `/similar` | `{laptopId, k}` |
| POST | `/train` | `{dataset: [...], note}` → `{version, metrics}` (đồng bộ, vài giây với ~300 mẫu) |
| POST | `/models/{version}/activate` | Nạp artifact làm champion |
| GET | `/models/{version}` | metadata |

## 5. Tác vụ định kỳ (`node-cron`)

| Tác vụ | Lịch | Việc |
|---|---|---|
| `snapshotSync` | khi CRUD laptop + 02:00 hằng ngày | Đẩy catalog sang `/catalog/sync` |
| `alertScan` | 15 phút | Tính KPI cửa sổ trượt, ghi `AlertLog` (09 §6) |
| `retrainCheck` | Chủ nhật 03:00 | Đủ điều kiện (09 §2.2) → huấn luyện challenger, **không** tự promote |

## 6. Bảo mật
- JWT 8 giờ, bcrypt cost 10, middleware `requireRole(...)`.
- ML service chỉ lắng nghe mạng nội bộ, header `X-Internal-Key`.
- Rate limit `/recommendations`: 30 yêu cầu / phút / IP.
