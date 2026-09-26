# 05 — Cơ sở dữ liệu (Prisma + SQL Server)

> SQL Server trong Prisma **không có `enum` và `Json`**. Các trường "enum" là `String` với hằng số ở `backend/src/constants/enums.ts`; các trường JSON là `NVarChar(Max)` đi qua `toJson()/fromJson()`.

## 1. Hằng số

```ts
export const ROLES = ['CUSTOMER', 'STAFF', 'ADMIN'] as const;
export const SEGMENTS = ['OFFICE', 'ULTRABOOK', 'GAMING', 'CREATOR'] as const;
export const SEGMENT_LABEL_VI = {
  OFFICE: 'Văn phòng – Học tập', ULTRABOOK: 'Mỏng nhẹ – Di động',
  GAMING: 'Gaming', CREATOR: 'Đồ họa – Kỹ thuật',
} as const;
export const LABEL_SOURCES = ['RETAILER', 'ADMIN', 'MODEL'] as const;
export const LABEL_STATUS = ['VERIFIED', 'NEEDS_REVIEW'] as const;
export const MODEL_TYPES = ['CLASSIFIER', 'RETRIEVER'] as const;
export const MODEL_STATUS = ['CHAMPION', 'CHALLENGER', 'ARCHIVED', 'FAILED'] as const;
export const EVENT_TYPES = ['VIEW_DETAIL', 'LIKE', 'DISLIKE', 'ADD_COMPARE', 'ADD_FAVORITE'] as const;
export const DISLIKE_REASONS = ['TOO_EXPENSIVE', 'TOO_HEAVY', 'WEAK_PERFORMANCE',
  'POOR_DISPLAY', 'BRAND', 'OTHER'] as const;
export const PIN_ACTIONS = ['PIN', 'BAN'] as const;
```

## 2. Schema

```prisma
generator client { provider = "prisma-client-js" }
datasource db { provider = "sqlserver"; url = env("DATABASE_URL") }

model User {
  id           Int      @id @default(autoincrement())
  email        String   @unique @db.NVarChar(120)
  passwordHash String   @db.NVarChar(200)
  fullName     String   @db.NVarChar(120)
  role         String   @default("CUSTOMER") @db.NVarChar(20)
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
  laptops Laptop[]
}

model CpuBenchmark {
  id          Int      @id @default(autoincrement())
  pattern     String   @unique @db.NVarChar(80)
  displayName String   @db.NVarChar(120)
  rawScore    Int
  score       Float                           // 0–100
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
  id             Int      @id @default(autoincrement())
  sku            String   @unique @db.NVarChar(80)
  name           String   @db.NVarChar(200)
  brandId        Int
  cpuId          Int
  gpuId          Int
  ramGb          Int
  ramUpgradable  Boolean  @default(false)
  ssdGb          Int
  screenInch     Float
  resWidth       Int
  resHeight      Int
  ppi            Float                          // tính khi lưu
  refreshHz      Int      @default(60)
  srgb100        Boolean  @default(false)
  weightKg       Float
  batteryWh      Float?
  priceVnd       Int
  imageUrl       String?  @db.NVarChar(500)
  sourceUrl      String?  @db.NVarChar(500)
  performanceIdx Float                          // 03 §5.1
  valueIdx       Float
  isActive       Boolean  @default(true)
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  brand          Brand        @relation(fields: [brandId], references: [id])
  cpu            CpuBenchmark @relation(fields: [cpuId], references: [id])
  gpu            GpuBenchmark @relation(fields: [gpuId], references: [id])
  segmentLabel   SegmentLabel?
  priceHistory   PriceHistory[]
  favorites      Favorite[]
  recItems       RecommendationItem[]
  events         InteractionEvent[]
  pins           LaptopPin[]

  @@index([priceVnd])
  @@index([isActive])
}

/// Nhãn phân khúc hiện hành của một laptop — nguồn huấn luyện Mô hình A
model SegmentLabel {
  id            Int      @id @default(autoincrement())
  laptopId      Int      @unique
  segment       String   @db.NVarChar(20)
  source        String   @db.NVarChar(20)       // RETAILER | ADMIN | MODEL
  status        String   @db.NVarChar(20)       // VERIFIED | NEEDS_REVIEW
  confidence    Float?                          // khi source = MODEL
  predictedBy   String?  @db.NVarChar(40)       // phiên bản mô hình
  probaJson     String?  @db.NVarChar(Max)      // {"GAMING":0.71,...}
  locked        Boolean  @default(false)        // ghi đè tri thức: không cho mô hình đổi
  note          String?  @db.NVarChar(500)
  verifiedById  Int?
  updatedAt     DateTime @updatedAt
  laptop        Laptop   @relation(fields: [laptopId], references: [id])
}

model PriceHistory {
  id        Int      @id @default(autoincrement())
  laptopId  Int
  priceVnd  Int
  changedAt DateTime @default(now())
  laptop    Laptop   @relation(fields: [laptopId], references: [id])
  @@index([laptopId, changedAt])
}

model ModelVersion {
  id           Int      @id @default(autoincrement())
  version      String   @unique @db.NVarChar(40)
  type         String   @db.NVarChar(20)
  status       String   @db.NVarChar(20)
  paramsJson   String   @db.NVarChar(Max)
  metricsJson  String   @db.NVarChar(Max)     // cv, test, golden, per-class, confusion, k-curve
  datasetHash  String   @db.NVarChar(80)
  nSamples     Int
  trainedAt    DateTime
  promotedAt   DateTime?
  promotedById Int?
  note         String?  @db.NVarChar(500)
}

/// Telemetry: mỗi lượt tư vấn
model RecommendationSession {
  id              String   @id @default(uuid())
  userId          Int?
  needJson        String   @db.NVarChar(Max)  // đầu vào wizard
  inferredSegment String?  @db.NVarChar(20)
  inferredConf    Float?
  usedSegment     String   @db.NVarChar(20)
  weightsJson     String   @db.NVarChar(Max)
  idealJson       String   @db.NVarChar(Max)  // vector q (đơn vị gốc)
  clfVersion      String?  @db.NVarChar(40)
  isFallback      Boolean  @default(false)
  budgetRelaxed   Boolean  @default(false)
  latencyMs       Int
  createdAt       DateTime @default(now())
  user            User?    @relation(fields: [userId], references: [id])
  items           RecommendationItem[]
  events          InteractionEvent[]
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
  session         RecommendationSession @relation(fields: [sessionId], references: [id])
  laptop          Laptop  @relation(fields: [laptopId], references: [id])
  @@unique([sessionId, laptopId])
}

model InteractionEvent {
  id        Int      @id @default(autoincrement())
  sessionId String?
  laptopId  Int
  userId    Int?
  type      String   @db.NVarChar(20)
  reason    String?  @db.NVarChar(30)
  note      String?  @db.NVarChar(500)
  createdAt DateTime @default(now())
  session   RecommendationSession? @relation(fields: [sessionId], references: [id], onDelete: NoAction, onUpdate: NoAction)
  laptop    Laptop   @relation(fields: [laptopId], references: [id])
  user      User?    @relation(fields: [userId], references: [id], onDelete: NoAction, onUpdate: NoAction)
  @@index([type, createdAt])
}

model Favorite {
  userId    Int
  laptopId  Int
  createdAt DateTime @default(now())
  user      User   @relation(fields: [userId], references: [id])
  laptop    Laptop @relation(fields: [laptopId], references: [id])
  @@id([userId, laptopId])
}

/// Ghi đè tri thức: ghim / loại
model LaptopPin {
  id        Int       @id @default(autoincrement())
  laptopId  Int
  action    String    @db.NVarChar(10)        // PIN | BAN
  segment   String?   @db.NVarChar(20)        // null = mọi phân khúc
  reason    String    @db.NVarChar(300)
  expiresAt DateTime?
  createdBy Int
  createdAt DateTime  @default(now())
  laptop    Laptop    @relation(fields: [laptopId], references: [id])
}

/// Cấu hình tri thức dạng key–value (trọng số mặc định, ngưỡng, activity_profiles)
model KnowledgeConfig {
  key       String   @id @db.NVarChar(80)
  valueJson String   @db.NVarChar(Max)
  updatedBy Int?
  updatedAt DateTime @updatedAt
}

model AlertLog {
  id        Int      @id @default(autoincrement())
  code      String   @db.NVarChar(40)
  severity  String   @db.NVarChar(10)         // INFO | WARN | CRITICAL
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
  user       User?    @relation(fields: [userId], references: [id])
}
```

> Lưu ý SQL Server: quan hệ có nhiều đường xóa lan truyền tới cùng một bảng (`InteractionEvent` ← `User` và ← `Session` ← `User`) gây lỗi "multiple cascade paths" → đã đặt `onDelete: NoAction` như trên.

## 3. Khóa `KnowledgeConfig` mặc định (seed)

| Key | Giá trị mặc định |
|---|---|
| `segment_base_weights` | `{"OFFICE":{"performance":1,"mobility":1.1,"display":0.9,"price":1.2}, "ULTRABOOK":{"performance":0.9,"mobility":1.4,"display":1,"price":1}, "GAMING":{"performance":1.3,"mobility":0.6,"display":1.2,"price":1}, "CREATOR":{"performance":1.2,"mobility":0.7,"display":1.4,"price":0.9}}` |
| `priority_percentiles` | `{"1":25,"2":40,"3":55,"4":75,"5":90}` |
| `activity_profiles` | theo 04 §3.5 |
| `confidence_threshold` | `0.6` |
| `default_top_n` | `5` |
| `budget_relax_ratio` | `0.1` |
| `min_candidates` | `3` |
| `alert_thresholds` | xem 09 §6 |

## 4. Seed
- `npm run seed`: 3 tài khoản demo (`admin@smartlap.vn`, `staff@smartlap.vn`, `khach@smartlap.vn`, mật khẩu `Demo@123`), import benchmark + catalog từ `data/processed/*.csv`, nhãn `source = RETAILER, status = VERIFIED`, cấu hình tri thức mặc định.
- `npm run seed:telemetry`: sinh 400 phiên tư vấn giả lập từ persona (03 §6) để dashboard và màn phản hồi có dữ liệu khi demo. Đánh dấu `needJson.synthetic = true` để loại khỏi thống kê thật nếu cần.
