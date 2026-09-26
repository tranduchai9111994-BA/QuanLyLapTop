import type { ExplanationItem } from '../types';
import { formatVnd } from './format';

export function explainText(item: ExplanationItem): string {
  const p = item.params as Record<string, any>;
  switch (item.code) {
    case 'perf_above':
      return `Hiệu năng CPU cao hơn mức bạn cần (${p.pct}% so với hồ sơ lý tưởng)`;
    case 'gpu_dedicated':
      return `Có card đồ họa rời ${p.gpu ?? ''} — chơi game và dựng hình tốt`;
    case 'price_under':
      return `Rẻ hơn ngân sách tối đa ${p.money ?? ''}`;
    case 'display_good':
      return `Màn ${p.refresh ?? '?'} Hz, ${p.srgb ?? ''}`;
    case 'battery_good':
      return `Pin ${p.battery ?? '?'} Wh, dùng được lâu hơn mức bạn cần`;
    case 'weight_over':
      return `Nặng ${p.x ?? '?'} kg, hơn mức mong muốn ${p.d ?? '?'} kg`;
    case 'ram_low':
      return `RAM ${p.x ?? '?'} GB, thấp hơn mức đề xuất ${p.y ?? '?'} GB`;
    case 'price_over':
      return `Vượt ngân sách mong muốn ${p.money ?? ''}`;
    case 'store_pick':
      return `Đề xuất từ cửa hàng`;
    default:
      return item.code;
  }
}

export { formatVnd };
