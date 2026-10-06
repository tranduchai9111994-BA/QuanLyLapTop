# 06 — Kiến trúc và API

## 1. Kiến trúc tổng quan

```
┌────────────────────┐   HTTPS/JSON   ┌──────────────────────────┐   HTTP/JSON   ┌─────────────────────────┐
│  Frontend (React)  │ ─────────────► │ Backend (Express + TS)   │ ────────────► │ ML service (FastAPI)    │
│                     │ ◄───────────── │ Auth, nghiệp vụ, lọc     │ ◄──────────── │ Mô hình A/B/C, huấn     │
│                     │                │ cứng, telemetry, cron    │               │ luyện, artifact         │
└────────────────────┘                └────────────┬─────────────┘               └───────────┬─────────────┘
                                                    │ Prisma                                   │ trạng thái
                                             ┌──────▼──────┐                                   │ trong RAM
                                             │ SQL Server  │ ◄──── POST /catalog/sync ──────────┘
                                             └─────────────┘
```

Phân vai:
- **Backend (Node.js/Express)** là nguồn sự thật: dữ liệu (Prisma/SQL Server), quyền truy cập, lọc cứng, ghim/cấm máy, ghi telemetry, điều phối cron (đồng bộ catalog, quét cảnh báo).
- **ML service (Python/FastAPI, uvicorn)** không kết nối DB trực tiếp. Toàn bộ trạng thái (`catalog`, `scaler`, mô hình đang kích hoạt) giữ trong biến toàn cục ở RAM, mất khi tiến trình khởi động lại. Backend phải đẩy lại catalog qua `POST /catalog/sync` mỗi khi ML service khởi động hoặc dữ liệu đổi — nhờ tách rời như vậy, ML service tắt/lỗi không làm sập backend (xem `docs/09` mục cơ chế dự phòng).

Backend giao tiếp ML service qua `mlClient` (HTTP nội bộ). Khi gọi ML lỗi/timeout, các route liên quan tự bắt lỗi và không để lộ lỗi 500 cho người dùng cuối (ví dụ `segment.service.ts` vẫn lưu được laptop dù không dự đoán được phân khúc).

## 2. Cấu trúc mã nguồn

```
backend/src/
├── app.ts               # createApp(): khai báo middleware + mount toàn bộ router (tách khỏi server.ts để test)
├── server.ts             # điểm khởi động thật: listen PORT, cron đồng bộ catalog + quét cảnh báo
├── lib/                   # prisma.ts, json.ts (toJson/fromJson), mlClient.ts, logger.ts
├── constants/             # enums.ts (xem docs/05 mục 1)
├── middlewares/           # requireAuth, requireRole, optionalAuth, requestId, errorHandler, notFoundHandler
└── modules/
    ├── auth/               # auth.routes.ts — đăng nhập, đăng ký, /me
    ├── users/               # users.routes.ts (users + audit-logs), favorites.routes.ts (favorites + sessions)
    ├── brands/              # brands.routes.ts
    ├── benchmarks/          # benchmarks.routes.ts (CPU/GPU benchmark)
    ├── laptops/             # laptops.routes.ts, segment.service.ts, laptops.service.ts, price.service.ts...
    ├── recommendations/     # recommendations.routes.ts, recommend.service.ts, fallback.service.ts
    ├── feedback/             # events.routes.ts (ghi InteractionEvent)
    ├── labels/               # labels.routes.ts (hàng đợi xác minh nhãn)
    ├── models/               # models.routes.ts (train/promote/rollback ModelVersion)
    ├── knowledge/            # knowledge.routes.ts (KnowledgeConfig, LaptopPin)
    ├── dashboard/            # dashboard.routes.ts (KPI, alerts) + feedback.routes con (summary, need-texts)
    └── jobs/                 # alertScan.ts, snapshotSync.ts (không có routes.ts — chạy qua cron/nội bộ)

ml-service/app/                 # chia 3 nhóm theo vai trò; phụ thuộc chỉ đi 1 chiều main -> models -> data
├── main.py                     # cổng vào: toàn bộ route FastAPI, state (catalog...) trong RAM
├── schemas.py                  # pydantic request/response models
├── data/                       # NHÓM 1: dữ liệu -> đặc trưng
│   ├── features.py             #   dựng đặc trưng, ColumnTransformer
│   └── data_check.py           #   kiểm tra chất lượng dữ liệu
├── models/                     # NHÓM 2: 3 mô hình
│   ├── classifier.py           #   Mô hình A (phân loại phân khúc)
│   ├── segment_inference.py    #   Mô hình A dùng ở Wizard: suy phân khúc từ hoạt động
│   ├── retriever.py            #   Mô hình B (kNN xếp hạng theo vector lý tưởng)
│   ├── explain.py              #   giải thích từng gợi ý của Mô hình B
│   └── text_classifier.py      #   Mô hình C (đọc câu nhu cầu tự do - NeedTextModel)
└── lifecycle/                  # NHÓM 3: huấn luyện, lưu, đánh giá
    ├── train.py                #   huấn luyện, lưu artifact theo version
    ├── evaluate.py, ablation.py#   đo chất lượng, thí nghiệm bật/tắt đặc trưng
    ├── retrain_from_feedback.py#   học thêm Mô hình C từ câu nhu cầu thật được 👍 (docs/09)
    └── registry.py             #   nạp / kích hoạt / rollback phiên bản model trên đĩa

ml-service/artifacts/           # các phiên bản model đã lưu (model + metadata.json), ngoài app/
```

## 3. API Backend

Tất cả route mount dưới tiền tố `/api` (khai báo trong `app.ts`), cộng route tĩnh `GET /api/health`.

### 3.1 `auth` — `/api/auth`
| Method | Path | Quyền | Mô tả |
|---|---|---|---|
| POST | `/login` | công khai | Đăng nhập, trả token |
| POST | `/register` | công khai | Khách tự đăng ký tài khoản CUSTOMER |
| GET | `/me` | đăng nhập | Thông tin user hiện tại |

### 3.2 `laptops` — `/api/laptops`
| Method | Path | Quyền | Mô tả |
|---|---|---|---|
| GET | `/` | tùy chọn đăng nhập | Danh sách laptop, lọc/sắp xếp/phân trang |
| GET | `/compare` | công khai | So sánh nhiều laptop theo `ids` |
| GET | `/price-changes` | STAFF, ADMIN | Lịch sử thay đổi giá gần đây (route tĩnh, khai trước `/:id` để không bị nuốt) |
| GET | `/:id` | công khai | Chi tiết 1 laptop |
| POST | `/` | STAFF, ADMIN | Tạo laptop, tự gán nhãn phân khúc, đồng bộ ML |
| PUT | `/:id` | STAFF, ADMIN | Sửa laptop, gán lại nhãn, đồng bộ ML |
| DELETE | `/:id` | STAFF, ADMIN | Xóa mềm (`isActive = false`), đồng bộ ML |
| PATCH | `/:id/price` | STAFF, ADMIN | Cập nhật giá/giảm giá/lượt bán, đồng bộ ML |
| GET | `/:id/price-history` | công khai | Lịch sử giá 1 laptop |
| POST | `/bulk-price` | ADMIN | Điều chỉnh giá hàng loạt theo %, theo hãng/phân khúc, có chế độ `dryRun` |
| POST | `/predict-segment` | STAFF, ADMIN | Chỉ dự đoán phân khúc, không lưu (dùng khi đang nhập form) |
| PATCH | `/:id/segment` | STAFF, ADMIN | Gán nhãn phân khúc thủ công, có thể kèm `locked` |
| GET | `/:id/similar` | công khai | Danh sách laptop tương tự (Mô hình B item-item) |

### 3.3 `recommendations` — `/api/recommendations`
| Method | Path | Quyền | Mô tả |
|---|---|---|---|
| POST | `/` | tùy chọn đăng nhập | Lõi khuyến nghị (Mô hình B qua `recommend.service.ts`) |
| POST | `/parse-need` | công khai | Gọi thẳng ML `/parse-need` (Mô hình C — đọc câu nhu cầu tự do) |
| POST | `/infer-segment` | công khai | Gọi thẳng ML `/infer-segment` (suy phân khúc từ hoạt động đã chọn) |

### 3.4 `feedback` (events) — `/api/events`
| Method | Path | Quyền | Mô tả |
|---|---|---|---|
| POST | `/` | tùy chọn đăng nhập | Ghi 1 `InteractionEvent`: `{sessionId?, laptopId, type, reason?, note?}` |

`type` ∈ `VIEW_DETAIL, LIKE, DISLIKE, ADD_COMPARE, ADD_FAVORITE`; `reason` ∈ `TOO_EXPENSIVE, TOO_HEAVY, WEAK_PERFORMANCE, POOR_DISPLAY, BRAND, OTHER` (chỉ có ý nghĩa khi `type = DISLIKE`).

### 3.5 `labels` — `/api/labels`
| Method | Path | Quyền | Mô tả |
|---|---|---|---|
| GET | `/review-queue` | STAFF, ADMIN | Hàng đợi nhãn `NEEDS_REVIEW`, sắp xếp theo `updatedAt` tăng dần (máy chờ lâu nhất trước) |
| PATCH | `/review-queue/:laptopId` | STAFF, ADMIN | Duyệt/sửa nhãn: `{segment, locked?}` → `source = ADMIN`, `status = VERIFIED`; nếu không truyền `locked` thì giữ nguyên giá trị cũ |

### 3.6 `knowledge` — `/api/knowledge`
| Method | Path | Quyền | Mô tả |
|---|---|---|---|
| GET | `/config/:key` | ADMIN | Đọc 1 cấu hình key–value |
| PUT | `/config/:key` | ADMIN | Upsert cấu hình, ghi audit |
| GET | `/pins` | STAFF, ADMIN | Danh sách máy đang ghim/cấm |
| POST | `/pins` | ADMIN | Tạo ghim/cấm, ghi audit (`PIN_LAPTOP`/`BAN_LAPTOP`) |
| DELETE | `/pins/:id` | ADMIN | Xóa ghim/cấm, ghi audit `UNPIN_LAPTOP` |

### 3.7 `benchmarks` — `/api/benchmarks`
| Method | Path | Quyền | Mô tả |
|---|---|---|---|
| GET | `/cpu` | công khai | Danh sách CPU benchmark (sắp xếp theo `score` giảm dần) |
| POST/PUT/DELETE | `/cpu`, `/cpu/:id` | ADMIN | Quản lý CPU benchmark |
| GET | `/gpu` | công khai | Danh sách GPU benchmark |
| POST/PUT/DELETE | `/gpu`, `/gpu/:id` | ADMIN | Quản lý GPU benchmark |

### 3.8 `brands` — `/api/brands`
| Method | Path | Quyền | Mô tả |
|---|---|---|---|
| GET | `/` | công khai | Danh sách hãng |
| POST/PUT/DELETE | `/`, `/:id` | ADMIN | Quản lý hãng (bao gồm `tier`) |

### 3.9 `models` — `/api/models`
| Method | Path | Quyền | Mô tả |
|---|---|---|---|
| GET | `/` | ADMIN | Danh sách `ModelVersion`, sắp xếp `trainedAt` giảm dần |
| GET | `/:version` | ADMIN | Chi tiết 1 phiên bản |
| POST | `/train` | ADMIN | Gọi ML `/train` (đồng bộ, timeout 60s), lưu `ModelVersion` mới với `status = CHALLENGER` |
| POST | `/:version/promote` | ADMIN | Kiểm tra quy tắc an toàn rồi kích hoạt challenger thành CHAMPION (xem `docs/09`) |
| POST | `/:version/rollback` | ADMIN | Kích hoạt lại một phiên bản cũ làm CHAMPION ngay, không kiểm tra chỉ số |
| DELETE | `/:version` | ADMIN | Xóa một phiên bản dư (Dự phòng / đã lưu trữ): xóa thư mục artifacts bên ML rồi xóa dòng DB, ghi nhật ký `DELETE_MODEL`. Từ chối nếu là CHAMPION (409) |

### 3.10 `dashboard` + `feedback` (tổng hợp) — `/api/dashboard`, `/api/feedback`
| Method | Path | Quyền | Mô tả |
|---|---|---|---|
| GET | `/api/dashboard/kpis` | ADMIN | KPI tổng quan (tỷ lệ dự phòng, độ trễ p95, tỷ lệ hài lòng...) theo khoảng `from/to` |
| GET | `/api/dashboard/alerts` | ADMIN | Danh sách cảnh báo chưa xử lý (`resolved = false`), tối đa 50 |
| POST | `/api/dashboard/alerts/scan` | ADMIN | Chạy `alertScan()` thủ công, trả danh sách cảnh báo |
| PATCH | `/api/dashboard/alerts/:id/resolve` | ADMIN | Đánh dấu 1 cảnh báo đã xử lý |
| GET | `/api/feedback/need-texts` | ADMIN | Các câu nhu cầu thật đã được 👍 — dùng để học lại Mô hình C |
| GET | `/api/feedback/summary` | ADMIN | Tổng hợp `InteractionEvent` theo `type` + `reason` |

### 3.11 `users` / `audit-logs` / `favorites` / `sessions`
| Method | Path | Quyền | Mô tả |
|---|---|---|---|
| GET | `/api/users` | ADMIN | Danh sách tài khoản STAFF/ADMIN |
| POST | `/api/users` | ADMIN | Tạo tài khoản STAFF/ADMIN |
| PATCH | `/api/users/:id` | ADMIN | Sửa user; chặn tự khóa/tự hạ quyền chính mình |
| GET | `/api/audit-logs` | ADMIN | Nhật ký audit, tối đa 200 dòng |
| GET/POST | `/api/me/favorites` | đăng nhập | Xem / thêm yêu thích (thêm là upsert, gọi lại không lỗi) |
| DELETE | `/api/me/favorites/:laptopId` | đăng nhập | Bỏ yêu thích |
| GET | `/api/me/sessions` | đăng nhập | Lịch sử tư vấn của user (`RecommendationSession`), tối đa 20 |

## 4. API ML service (FastAPI)

| Method | Path | Mô tả |
|---|---|---|
| GET | `/health` | Trạng thái sống, phiên bản model đang dùng, kích thước catalog, thời điểm dựng chỉ mục — `{status, clfVersion, catalogSize, indexBuiltAt}` |
| POST | `/catalog/sync` | Backend đẩy toàn bộ catalog laptop, **thay thế hoàn toàn** dữ liệu cũ trong RAM và fit lại scaler/chỉ mục |
| POST | `/predict-segment` | Mô hình A: dự đoán phân khúc cho một hoặc nhiều cấu hình, kèm xác suất từng lớp và neighbor gần nhất |
| POST | `/parse-need` | Mô hình C: đọc câu nhu cầu tự do, trả hồ sơ nhu cầu (`NeedTextModel.parse_need`) |
| POST | `/infer-segment` | Suy phân khúc từ danh sách hoạt động đã chọn |
| POST | `/recommend` | Mô hình B: xếp hạng top-N `candidateIds` theo hồ sơ nhu cầu, trả `ideal`, `weights`, danh sách item kèm giải thích |
| POST | `/similar` | Item-item: k laptop gần nhất với 1 laptop cho trước (khoảng cách Euclid hai phía) |
| POST | `/train` | Huấn luyện lại Mô hình A + Mô hình C, lưu artifact mới và **kích hoạt ngay** |
| POST | `/models/{version}/activate` | Nạp một phiên bản artifact làm bản đang chạy và ghi file `LATEST` (dùng cho cả promote và rollback); huấn luyện `/train` chỉ lưu bản mới, không đổi bản đang chạy |
| DELETE | `/models/{version}` | Xóa thư mục một phiên bản; 409 nếu là bản đang chạy hoặc ghi ở `LATEST`; 400 nếu tên không hợp lệ |
| GET | `/models/{version}` | Metadata chi tiết của 1 phiên bản (tham số, macro-F1, confusion matrix...) |

Khi khởi động, ML service tự nạp phiên bản phân loại mới nhất đã lưu trên đĩa (không train lại) và huấn luyện ngay Mô hình C (nhẹ, vài trăm câu mẫu) — toàn bộ trạng thái giữ trong RAM.

## 5. Tác vụ định kỳ (`node-cron`, khai báo trong `server.ts`)

| Tác vụ | Lịch | Việc |
|---|---|---|
| `snapshotSync` | 02:00 hằng ngày, cộng chạy ngay lúc khởi động server (có retry) | Đẩy catalog hiện hành sang ML `/catalog/sync`; cũng được gọi trực tiếp sau mỗi lần tạo/sửa/xóa/đổi giá laptop |
| `alertScan` | mỗi giờ (`0 * * * *`), cộng chạy ngay lúc khởi động server | Quét 6 luật cảnh báo, ghi `AlertLog` (xem `docs/09`) |

Nếu đồng bộ catalog lúc khởi động thất bại, backend thử lại tối đa 5 lần cách nhau 3 giây rồi bỏ qua, chờ lần đồng bộ định kỳ tiếp theo (02:00) hoặc lần CRUD kế tiếp.

## 6. Bảo mật

- Xác thực bằng JWT, kiểm tra qua middleware `requireAuth`; phân quyền theo vai trò qua `requireRole(...roles)`; một số route dùng `optionalAuth` (hoạt động khác nhau tùy có/không có token, ví dụ để gắn `userId` vào `InteractionEvent` nếu khách đã đăng nhập).
- Mật khẩu người dùng lưu dạng băm (`passwordHash`), không lưu plaintext.
- Backend gọi ML service qua `mlClient` — không mở public, chỉ backend gọi tới trong mạng nội bộ.
