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
