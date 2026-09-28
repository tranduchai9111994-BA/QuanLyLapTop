# 05 — Cơ sở dữ liệu (Prisma + SQL Server)

> SQL Server trong Prisma **không có `enum` và `Json`**. Các trường "enum" là `String` với hằng số ở `backend/src/constants/enums.ts`; các trường JSON là `NVarChar(Max)` đi qua `toJson()/fromJson()` (`backend/src/lib/json.ts`).

## 1. Hằng số (`backend/src/constants/enums.ts`)

```ts
export const ROLES = ['CUSTOMER', 'STAFF', 'ADMIN'] as const;
export const SEGMENTS = ['OFFICE', 'ULTRABOOK', 'GAMING', 'CREATOR'] as const;
export const SEGMENT_LABEL_VI: Record<Segment, string> = {
  OFFICE: 'Văn phòng – Học tập', ULTRABOOK: 'Mỏng nhẹ – Di động',
  GAMING: 'Gaming', CREATOR: 'Đồ họa – Kỹ thuật',
};
export const LABEL_SOURCES = ['RETAILER', 'ADMIN', 'MODEL'] as const;
export const LABEL_STATUS = ['VERIFIED', 'NEEDS_REVIEW'] as const;
export const MODEL_TYPES = ['CLASSIFIER', 'RETRIEVER'] as const;
export const MODEL_STATUS = ['CHAMPION', 'CHALLENGER', 'ARCHIVED', 'FAILED'] as const;
export const EVENT_TYPES = ['VIEW_DETAIL', 'LIKE', 'DISLIKE', 'ADD_COMPARE', 'ADD_FAVORITE'] as const;
export const DISLIKE_REASONS = ['TOO_EXPENSIVE', 'TOO_HEAVY', 'WEAK_PERFORMANCE',
  'POOR_DISPLAY', 'BRAND', 'OTHER'] as const;
export const PIN_ACTIONS = ['PIN', 'BAN'] as const;
```

`reason` trên `InteractionEvent` chỉ có ý nghĩa khi `type = 'DISLIKE'`.

## 2. Schema (`backend/prisma/schema.prisma`, đầy đủ 16 model)

```prisma
generator client { provider = "prisma-client-js" }
datasource db { provider = "sqlserver"; url = env("DATABASE_URL") }

model User {
  id           Int      @id @default(autoincrement())
  email        String   @unique @db.NVarChar(120)
  passwordHash String   @db.NVarChar(200)
  fullName     String   @db.NVarChar(120)
  role         String   @default("CUSTOMER") @db.NVarChar(20)   // CUSTOMER | STAFF | ADMIN
  isActive     Boolean  @default(true)
  createdAt    DateTime @default(now())

  favorites    Favorite[]
  sessions     RecommendationSession[]
  events       InteractionEvent[]
  auditLogs    AuditLog[]
}

model Brand {
  id      Int      @id @default(autoincrement())
  name    String   @unique @db.NVarChar(60)
  tier    Int      @default(3)      // hạng uy tín thương hiệu 1..5 (5 = uy tín nhất) — đặc trưng Mô hình B
  laptops Laptop[]
}

model CpuBenchmark {
  id          Int      @id @default(autoincrement())
  pattern     String   @unique @db.NVarChar(80)
  displayName String   @db.NVarChar(120)
  rawScore    Int
  score       Float
  source      String   @db.NVarChar(120)
  checkedAt   DateTime
  laptops     Laptop[]
}

model GpuBenchmark {
  id          Int      @id @default(autoincrement())
  pattern     String   @unique @db.NVarChar(80)
  displayName String   @db.NVarChar(120)
  rawScore    Int
  score       Float
  dedicated   Boolean
  vramGb      Int?
  source      String   @db.NVarChar(120)
  checkedAt   DateTime
  laptops     Laptop[]
}

model Laptop {
  id               Int      @id @default(autoincrement())
  sku              String   @unique @db.NVarChar(80)
  name             String   @db.NVarChar(200)
  series           String?  @db.NVarChar(80)   // dòng sản phẩm, vd "Legion" — giá thường gắn theo dòng/model
  brandId          Int
  cpuId            Int
  gpuId            Int
  ramGb            Int
  ramUpgradable    Boolean  @default(false)
  ssdGb            Int
  screenInch       Float
  resWidth         Int
  resHeight        Int
  ppi              Float
  refreshHz        Int      @default(60)
  srgb100          Boolean  @default(false)
  weightKg         Float
  batteryWh        Float?
  priceVnd         Int                          // giá hiện tại (đã giảm nếu có)
  originalPriceVnd Int?                         // giá niêm yết trước khuyến mãi; null = không giảm giá
  salesCount       Int      @default(0)         // số lượt đã bán — tín hiệu "độ phổ biến" cho Mô hình B
  imageUrl         String?  @db.NVarChar(500)
  sourceUrl        String?  @db.NVarChar(500)
  performanceIdx   Float
  valueIdx         Float
  isActive         Boolean  @default(true)
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  brand        Brand         @relation(fields: [brandId], references: [id])
  cpu          CpuBenchmark  @relation(fields: [cpuId], references: [id])
  gpu          GpuBenchmark  @relation(fields: [gpuId], references: [id])
  segmentLabel SegmentLabel?
  priceHistory PriceHistory[]
  favorites    Favorite[]
  recItems     RecommendationItem[]
  events       InteractionEvent[]
  pins         LaptopPin[]

  @@index([priceVnd])
  @@index([isActive])
}

/// Nhãn phân khúc hiện hành của một laptop — nguồn huấn luyện Mô hình A
model SegmentLabel {
  id           Int      @id @default(autoincrement())
  laptopId     Int      @unique
  segment      String   @db.NVarChar(20)        // OFFICE | ULTRABOOK | GAMING | CREATOR
  source       String   @db.NVarChar(20)        // RETAILER | ADMIN | MODEL
  status       String   @db.NVarChar(20)        // VERIFIED | NEEDS_REVIEW
  confidence   Float?                           // xác suất lớp thắng khi source = MODEL
  predictedBy  String?  @db.NVarChar(40)        // phiên bản model (vd "clf-2026.10.05-01")
  probaJson    String?  @db.NVarChar(Max)       // phân phối xác suất theo phân khúc: {"GAMING":0.71,...}
  locked       Boolean  @default(false)         // true = khóa nhãn, Mô hình A không được ghi đè
  note         String?  @db.NVarChar(500)
  verifiedById Int?
  updatedAt    DateTime @updatedAt

  laptop Laptop @relation(fields: [laptopId], references: [id])
}

model PriceHistory {
  id        Int      @id @default(autoincrement())
  laptopId  Int
  priceVnd  Int
  changedAt DateTime @default(now())

  laptop Laptop @relation(fields: [laptopId], references: [id])

  @@index([laptopId, changedAt])
}

model ModelVersion {
  id           Int       @id @default(autoincrement())
  version      String    @unique @db.NVarChar(40)
  type         String    @db.NVarChar(20)       // CLASSIFIER | RETRIEVER
  status       String    @db.NVarChar(20)       // CHAMPION | CHALLENGER | ARCHIVED | FAILED
  paramsJson   String    @db.NVarChar(Max)      // siêu tham số đã chọn (best_params)
  metricsJson  String    @db.NVarChar(Max)      // cv, test (macro-F1, report theo lớp), baseline, k_curve
  datasetHash  String    @db.NVarChar(80)
  nSamples     Int
  trainedAt    DateTime
  promotedAt   DateTime?
  promotedById Int?
  note         String?   @db.NVarChar(500)
}

/// Telemetry: mỗi lượt tư vấn
model RecommendationSession {
  id              String   @id @default(uuid())
  userId          Int?
  needJson        String   @db.NVarChar(Max)   // hồ sơ nhu cầu đầu vào (wizard/câu tự do)
  inferredSegment String?  @db.NVarChar(20)
  inferredConf    Float?
  usedSegment     String   @db.NVarChar(20)
  weightsJson     String   @db.NVarChar(Max)
  idealJson       String   @db.NVarChar(Max)   // vector lý tưởng q
  clfVersion      String?  @db.NVarChar(40)
  isFallback      Boolean  @default(false)
  budgetRelaxed   Boolean  @default(false)
  latencyMs       Int
  createdAt       DateTime @default(now())

  user   User?                @relation(fields: [userId], references: [id])
  items  RecommendationItem[]
  events InteractionEvent[]

  @@index([createdAt])
}

model RecommendationItem {
  id              Int     @id @default(autoincrement())
  sessionId       String
  laptopId        Int
  rank            Int
  distance        Float
  matchPct        Float
  isPinned        Boolean @default(false)
  explanationJson String  @db.NVarChar(Max)

  session RecommendationSession @relation(fields: [sessionId], references: [id])
  laptop  Laptop                @relation(fields: [laptopId], references: [id])

  @@unique([sessionId, laptopId])
}

model InteractionEvent {
  id        Int      @id @default(autoincrement())
  sessionId String?
  laptopId  Int
  userId    Int?
  type      String   @db.NVarChar(20)          // VIEW_DETAIL | LIKE | DISLIKE | ADD_COMPARE | ADD_FAVORITE
  reason    String?  @db.NVarChar(30)          // chỉ dùng khi type = DISLIKE
  note      String?  @db.NVarChar(500)
  createdAt DateTime @default(now())

  session RecommendationSession? @relation(fields: [sessionId], references: [id], onDelete: NoAction, onUpdate: NoAction)
  laptop  Laptop                 @relation(fields: [laptopId], references: [id])
  user    User?                  @relation(fields: [userId], references: [id], onDelete: NoAction, onUpdate: NoAction)

  @@index([type, createdAt])
}

model Favorite {
  userId    Int
  laptopId  Int
  createdAt DateTime @default(now())

  user   User   @relation(fields: [userId], references: [id])
  laptop Laptop @relation(fields: [laptopId], references: [id])

  @@id([userId, laptopId])
}

/// Ghi đè tri thức: ghim / loại
model LaptopPin {
  id        Int       @id @default(autoincrement())
  laptopId  Int
  action    String    @db.NVarChar(10)          // PIN | BAN
  segment   String?   @db.NVarChar(20)          // null = áp dụng mọi phân khúc
  reason    String    @db.NVarChar(300)
  expiresAt DateTime?
  createdBy Int
  createdAt DateTime  @default(now())

  laptop Laptop @relation(fields: [laptopId], references: [id])
}

/// Cấu hình tri thức dạng key–value
model KnowledgeConfig {
  key       String   @id @db.NVarChar(80)
  valueJson String   @db.NVarChar(Max)
  updatedBy Int?
  updatedAt DateTime @updatedAt
}

model AlertLog {
  id        Int      @id @default(autoincrement())
  code      String   @db.NVarChar(40)           // LOW_SATISFACTION | FALLBACK_HIGH | LATENCY_HIGH | LOW_CONFIDENCE_RATE | REVIEW_BACKLOG | RANK1_WEAK
  severity  String   @db.NVarChar(10)           // INFO | WARN | CRITICAL
  message   String   @db.NVarChar(500)
  value     Float?
  threshold Float?
  resolved  Boolean  @default(false)
  createdAt DateTime @default(now())
}

model AuditLog {
  id         Int      @id @default(autoincrement())
  userId     Int?
  action     String   @db.NVarChar(60)
  entity     String   @db.NVarChar(40)
  entityId   String?  @db.NVarChar(60)
  detailJson String?  @db.NVarChar(Max)
  createdAt  DateTime @default(now())

  user User? @relation(fields: [userId], references: [id])
}
```

Không có `enum` Prisma nào trong schema — mọi giá trị dạng liệt kê (role, segment, source, status, type...) đều là `String` kèm hằng số TypeScript tương ứng và validate bằng zod ở tầng route.

> Lưu ý SQL Server: `InteractionEvent` có hai đường quan hệ tới `User` cùng lúc (trực tiếp qua `userId`, và gián tiếp qua `sessionId → RecommendationSession → userId`) gây lỗi "multiple cascade paths" nếu để cascade mặc định → cả hai quan hệ `session` và `user` trên `InteractionEvent` đều đặt `onDelete: NoAction, onUpdate: NoAction`.

## 3. Lý do thiết kế đáng chú ý

- **`priceVnd` / `originalPriceVnd`**: chỉ lưu giá hiện tại và giá gốc (nullable); phần trăm giảm giá luôn tính từ hai cột này tại thời điểm đọc, không lưu riêng cột `discountPercent` để tránh lệch dữ liệu khi một trong hai giá đổi mà quên đồng bộ.
- **`Brand.tier`**: hạng uy tín 1–5 do quản trị viên gán, dùng làm đặc trưng phụ trợ cho Mô hình B (không do mô hình tự học).
- **`Laptop.salesCount`**: mô phỏng "độ phổ biến" như các sàn TMĐT thật — máy bán chạy được ưu tiên hiển thị dù không phải khớp nhu cầu hoàn hảo nhất.
- **`SegmentLabel.locked`**: cơ chế ghi đè tri thức của con người lên mô hình — khi `true`, lần cập nhật laptop tiếp theo (nếu người dùng không chủ động chọn lại phân khúc) sẽ giữ nguyên nhãn thay vì để Mô hình A gán đè (xem `segment.service.ts`, `docs/09` mục 2).
- **`SegmentLabel.probaJson`**: lưu toàn bộ phân phối xác suất theo 4 phân khúc (không chỉ nhãn thắng) để phục vụ hàng đợi xác minh và giải thích cho nhân viên.
- **`ModelVersion`** không tách bảng riêng cho "golden test"/"confusion matrix" — toàn bộ nằm trong `metricsJson` (cv, test, baseline, k_curve, report theo từng lớp) để không phải thêm bảng mỗi khi cần thêm chỉ số mới.
- **`RecommendationSession` + `RecommendationItem` + `InteractionEvent`**: ba bảng telemetry tách rời — `Session` ghi ngữ cảnh 1 lượt tư vấn (nhu cầu, phân khúc dùng, trọng số, độ trễ, cờ dự phòng), `Item` ghi từng máy được xếp hạng trong lượt đó, `InteractionEvent` ghi hành vi người dùng sau đó (xem chi tiết, thích, không thích + lý do). Tách để có thể ghi hành vi không thuộc phiên nào (`sessionId` nullable) và đo tỷ lệ hài lòng theo hạng.
- **`KnowledgeConfig`** là bảng key–value chung (`key` là khóa chính, `valueJson` là chuỗi JSON) thay vì nhiều cột cấu hình cứng — cho phép thêm loại cấu hình mới (vd `alert_thresholds`) mà không cần migration. Hai key đang được code đọc/ghi thực tế: `confidence_threshold` (số thực, mặc định `0.6`, dùng trong `segment.service.ts`) và `alert_thresholds` (object, dùng trong `alertScan.ts`, xem `docs/09`).
- **`AlertLog`** chống trùng lặp cảnh báo bằng quy tắc nghiệp vụ ở tầng service (không phải ràng buộc DB): trước khi tạo dòng mới cho một `code`, service kiểm tra đã có dòng cùng `code` với `resolved = false` hay chưa.
- **`AuditLog`** ghi mọi thao tác ghi đè tri thức (gán/khóa nhãn, ghim/cấm máy, sửa cấu hình, promote/rollback model, tạo/sửa user) để truy vết ai đã thay đổi gì.

## 4. Seed dữ liệu

- `npm run seed`: tạo 3 tài khoản demo (`admin@smartlap.vn`, `staff@smartlap.vn`, `khach@smartlap.vn`, mật khẩu `Demo@123`), nhập benchmark CPU/GPU và catalog laptop, gán nhãn phân khúc ban đầu, tạo cấu hình tri thức mặc định trong `KnowledgeConfig`.
- Các script sinh dữ liệu mẫu bổ sung nằm rải rác trong `backend` (ví dụ dữ liệu mẫu cho hàng đợi "Duyệt nhãn phân khúc", tab "Ghim / Cấm máy", khối "Cảnh báo đang mở" trên Dashboard) — dùng để các màn quản trị có dữ liệu khi demo mà không cần thao tác tay.
