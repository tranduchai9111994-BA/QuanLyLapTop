/**
 * Xuất nhãn phân khúc đã được người duyệt ra CSV cùng định dạng với `data/processed/catalog_vn.csv`,
 * để chép vào dữ liệu huấn luyện Mô hình A (khép vòng phản hồi). Chỉ tạo chuỗi CSV, không ghi gì vào DB.
 */

export interface ExportRow {
  segment: string;
  updatedAt: Date;
  laptop: {
    sku: string;
    name: string;
    series: string | null;
    ramGb: number;
    ssdGb: number;
    screenInch: number;
    resWidth: number;
    resHeight: number;
    refreshHz: number;
    srgb100: boolean;
    weightKg: number;
    batteryWh: number | null;
    priceVnd: number;
    originalPriceVnd: number | null;
    salesCount: number;
    imageUrl: string | null;
    sourceUrl: string | null;
    brand: { name: string; tier: number };
    cpu: { displayName: string };
    gpu: { displayName: string };
  };
}

/** Đúng thứ tự 23 cột của catalog_vn.csv; `retailer_category` để trống vì DB không lưu. */
export const CSV_COLUMNS = [
  'sku', 'brand', 'brand_tier', 'series', 'name', 'cpu_model', 'gpu_model', 'ram_gb', 'ssd_gb',
  'screen_inch', 'resolution', 'refresh_hz', 'srgb_100', 'weight_kg', 'battery_wh', 'price_vnd',
  'original_price_vnd', 'sales_count', 'retailer_category', 'image_url', 'source_url', 'collected_at', 'segment',
] as const;

function cell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  const s = String(value);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Trả về nội dung file CSV (UTF-8 có BOM để Excel mở đúng tiếng Việt). */
export function buildLabelCsv(rows: ExportRow[]): string {
  const lines = rows.map(({ laptop: l, segment, updatedAt }) =>
    [
      l.sku, l.brand.name, l.brand.tier, l.series, l.name, l.cpu.displayName, l.gpu.displayName,
      l.ramGb, l.ssdGb, l.screenInch, `${l.resWidth}x${l.resHeight}`, l.refreshHz, l.srgb100 ? 1 : 0,
      l.weightKg, l.batteryWh, l.priceVnd, l.originalPriceVnd, l.salesCount, '', l.imageUrl, l.sourceUrl,
      updatedAt.toISOString().slice(0, 10), segment,
    ]
      .map(cell)
      .join(',')
  );
  return '﻿' + [CSV_COLUMNS.join(','), ...lines].join('\n') + '\n';
}
