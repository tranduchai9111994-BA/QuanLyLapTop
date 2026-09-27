/** Nguon duy nhat cho mau/chu/khoang cach (docs/07_UIUX.md). Cam hardcode hex ngoai file nay. */
export const t = {
  primary50: '#EEF5FF',
  primary100: '#DCEBFF',
  primary200: '#B9D6FF',
  primary400: '#4C9AFF',
  primary500: '#1A73E8',
  primary600: '#1559C1',
  primary700: '#0F4494',
  ai500: '#06B6D4',
  aiGradient: 'linear-gradient(135deg, #1A73E8 0%, #06B6D4 100%)',
  bgPage: '#F5F9FF',
  bgSurface: '#FFFFFF',
  // Alias cua bgSurface, dat rieng vi ngu nghia khac han: dung khi can chu/icon TRANG tren nen
  // TOI (gradient AI, nut primary) - khong phai "nen thẻ" nhu bgSurface, du trung gia tri hex.
  white: '#FFFFFF',
  bgSubtle: '#F0F5FC',
  border: '#E2EAF5',
  borderStrong: '#C9D6E8',
  textPrimary: '#0F1B2D',
  textSecondary: '#4A5B73',
  // NFR-05 (WCAG AA, Giai doan 7): #64748B ban dau chi dat 4.34:1 tren `bgSubtle` (#F0F5FC, vd
  // chu thich thoi gian trong the mo ta) - duoi nguong 4.5:1 cho van ban thuong. Toi mau xuong
  // 1 bac (#5B6B85) de dat 4.93:1 tren nen sang nhat dang dung cung mau nay, van giu dung "cam
  // giac" xam trung tinh nhu cu (kiem chung: scripts/check_contrast.py).
  textTertiary: '#5B6B85',
  success: '#15803D',
  successBg: '#EAF8EF',
  warning: '#B45309',
  warningBg: '#FFF6E5',
  // NFR-05: #DC2626 chi dat 4.23:1 tren `errorBg` (#FDECEC, vd chu "Khong thich"/canh bao loi) -
  // duoi nguong 4.5:1. Toi xuong #C62828 de dat 4.92:1, van la do ro rang, khong doi cam giac
  // "canh bao/loi" cua mau (kiem chung: scripts/check_contrast.py).
  error: '#C62828',
  errorBg: '#FDECEC',
  shadowSm: '0 1px 2px rgba(26,115,232,0.06)',
  shadowMd: '0 4px 16px rgba(26,115,232,0.08)',
  shadowLg: '0 12px 32px rgba(26,115,232,0.14)',
} as const;

export const segmentColors: Record<string, { color: string; bg: string; label: string }> = {
  OFFICE: { color: '#0369A1', bg: '#E6F4FB', label: 'Văn phòng – Học tập' },
  ULTRABOOK: { color: '#0F766E', bg: '#E6F6F4', label: 'Mỏng nhẹ – Di động' },
  GAMING: { color: '#C2410C', bg: '#FDEFE7', label: 'Gaming' },
  CREATOR: { color: '#9333EA', bg: '#F4EAFD', label: 'Đồ họa – Kỹ thuật' },
};

export const chartColors = ['#1A73E8', '#06B6D4', '#0F766E', '#C2410C', '#9333EA', '#64748B'];
