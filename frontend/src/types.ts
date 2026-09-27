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
  // tinh % giam gia tren giao dien (xem KET_QUA_THUC_NGHIEM.md muc 4.4).
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

export interface RecommendationResult {
  sessionId: string;
  segment: { used: Segment; inferred: Segment | null; confidence: number | null };
  mode: 'ML' | 'FALLBACK';
  budgetRelaxed: boolean;
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
