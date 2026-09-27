export type Segment = 'OFFICE' | 'ULTRABOOK' | 'GAMING' | 'CREATOR';

export interface Laptop {
  id: number;
  sku: string;
  name: string;
  brand: { id: number; name: string };
  cpu: { displayName: string; score: number };
  gpu: { displayName: string; score: number; dedicated: boolean };
  ramGb: number;
  ssdGb: number;
  screenInch: number;
  refreshHz: number;
  srgb100: boolean;
  weightKg: number;
  batteryWh: number | null;
  priceVnd: number;
  // Gia goc (truoc khuyen mai) - null neu may khong dang giam gia. Dung de hien thi gach ngang +
  // tinh % giam gia tren giao dien (xem docs/14_KET_QUA_THUC_NGHIEM.md muc 4.4).
  originalPriceVnd?: number | null;
  // So luot ban luy ke - hien thi "Da ban N" tren the san pham, dong thoi la dac trung dau vao cua
  // Mo hinh B (kNN truy hoi) sau khi log-hoa (xem retriever.py nhom "popularity").
  salesCount?: number;
  series?: string | null;
  imageUrl: string | null;
  performanceIdx: number;
  valueIdx: number;
  segmentLabel?: { segment: Segment } | null;
  priceHistory?: { priceVnd: number; changedAt: string }[];
}

export interface ExplanationItem {
  code: string;
  params: Record<string, unknown>;
  tone: 'positive' | 'warning';
}

export interface Explanation {
  strengths: ExplanationItem[];
  warnings: ExplanationItem[];
}

export interface RecommendationItemDto {
  rank: number;
  laptopId: number;
  distance: number | null;
  matchPct: number | null;
  isPinned?: boolean;
  explanation: Explanation;
  laptop: Laptop;
}

/** Ket qua tra ve tu POST /recommendations - "goi" day du de hien Ket qua + Vi sao goi y. */
export interface RecommendationResult {
  sessionId: string;
  segment: { used: Segment; inferred: Segment | null; confidence: number | null };
  // 'ML' = kNN that su (goi ML service thanh cong); 'FALLBACK' = ML service loi/tat, xep hang
  // tam theo performanceIdx/valueIdx co san trong DB (xem FallbackBanner.tsx)
  mode: 'ML' | 'FALLBACK';
  // true neu loc cung ngan sach ban dau qua chat (khong con may nao) nen backend tu no rong
  // them 10% de van co ket qua tra ve (xem BudgetRelaxedBanner.tsx)
  budgetRelaxed: boolean;
  // So may thoa dieu kien TRUOC khi noi rong ngan sach - dung de hien thong bao cu the
  // "chi co N may thoa dieu kien" thay vi chung chung
  candidatesBeforeRelax: number;
  // "May trong mo" duoc suy tu muc uu tien (xem retriever.build_ideal_vector) - dung de ve
  // bang so sanh trong ExplainDrawer.tsx
  ideal: Record<string, number>;
  weights: Record<string, number>;
  items: RecommendationItemDto[];
  modelVersion: string | null;
  latencyMs: number;
}

export interface Priorities {
  performance: number;
  mobility: number;
  display: number;
  price: number;
}
