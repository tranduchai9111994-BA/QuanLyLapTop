// Cac danh sach gia tri CO DINH dung chung ca backend lan validate zod - khai bao 1 lan duy nhat
// o day (thay vi lap lai chuoi string o nhieu route) de doi 1 cho la khap noi tu dong cap nhat.
export const ROLES = ['CUSTOMER', 'STAFF', 'ADMIN'] as const;
export type Role = (typeof ROLES)[number];

export const SEGMENTS = ['OFFICE', 'ULTRABOOK', 'GAMING', 'CREATOR'] as const;
export type Segment = (typeof SEGMENTS)[number];

export const SEGMENT_LABEL_VI: Record<Segment, string> = {
  OFFICE: 'Văn phòng – Học tập',
  ULTRABOOK: 'Mỏng nhẹ – Di động',
  GAMING: 'Gaming',
  CREATOR: 'Đồ họa – Kỹ thuật',
};

export const LABEL_SOURCES = ['RETAILER', 'ADMIN', 'MODEL'] as const;
export const LABEL_STATUS = ['VERIFIED', 'NEEDS_REVIEW'] as const;
export const MODEL_TYPES = ['CLASSIFIER', 'RETRIEVER'] as const;
export const MODEL_STATUS = ['CHAMPION', 'CHALLENGER', 'ARCHIVED', 'FAILED'] as const;
export const EVENT_TYPES = ['VIEW_DETAIL', 'LIKE', 'DISLIKE', 'ADD_COMPARE', 'ADD_FAVORITE'] as const;
export const DISLIKE_REASONS = [
  'TOO_EXPENSIVE',
  'TOO_HEAVY',
  'WEAK_PERFORMANCE',
  'POOR_DISPLAY',
  'BRAND',
  'OTHER',
] as const;
export const PIN_ACTIONS = ['PIN', 'BAN'] as const;
