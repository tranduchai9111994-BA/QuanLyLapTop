/** Cac gia tri CHUAN cua thong so laptop.
 *
 * Vi sao can: go tay rat de sai (da tung nhap duoc RAM = -2, SSD = 0). Nhung thong so chi nhan
 * mot tap gia tri co dinh tren thi truong thi phai cho CHON, khong cho go.
 * Cac nguong so (gia, can nang) khop voi `ml-service/app/data_check.py` va docs/03 SS7.
 */

export const RAM_OPTIONS = [4, 8, 12, 16, 24, 32, 64, 96, 128];
export const SSD_OPTIONS = [128, 256, 512, 1024, 2048, 4096];
export const SCREEN_INCH_OPTIONS = [13.3, 13.6, 14, 14.5, 15.6, 16, 16.1, 16.2, 17, 17.3, 18];
export const REFRESH_HZ_OPTIONS = [60, 75, 90, 120, 144, 165, 240, 360];

/** Do phan giai: chon theo CAP (rong x cao) de khong the nhap lech ti le. */
export const RESOLUTION_OPTIONS: { label: string; value: string; width: number; height: number }[] = [
  { label: '1366 x 768 (HD)', value: '1366x768', width: 1366, height: 768 },
  { label: '1920 x 1080 (Full HD)', value: '1920x1080', width: 1920, height: 1080 },
  { label: '1920 x 1200 (WUXGA)', value: '1920x1200', width: 1920, height: 1200 },
  { label: '2160 x 1440', value: '2160x1440', width: 2160, height: 1440 },
  { label: '2560 x 1440 (QHD)', value: '2560x1440', width: 2560, height: 1440 },
  { label: '2560 x 1600 (WQXGA)', value: '2560x1600', width: 2560, height: 1600 },
  { label: '2880 x 1800', value: '2880x1800', width: 2880, height: 1800 },
  { label: '3024 x 1964', value: '3024x1964', width: 3024, height: 1964 },
  { label: '3840 x 2160 (4K UHD)', value: '3840x2160', width: 3840, height: 2160 },
];

/** Gioi han cho cac o so tu do - chan nhap gia tri vo ly ngay tren giao dien. */
export const NUMERIC_LIMITS = {
  weightKg: { min: 0.8, max: 4.5, step: 0.01 },
  batteryWh: { min: 20, max: 120, step: 1 },
  priceVnd: { min: 3_000_000, max: 200_000_000, step: 100_000 },
} as const;
