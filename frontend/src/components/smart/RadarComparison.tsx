import { useId } from 'react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Legend, Tooltip, ResponsiveContainer } from 'recharts';
import type { Laptop } from '../../types';
import { t } from '../../theme/tokens';

// Các đặc trưng đưa vào biểu đồ RADAR (FR-04) - chỉ chọn những trục CÀNG CAO CÀNG TỐT để việc
// chuẩn hóa về thang 0-100% có ý nghĩa trực quan ("phủ đầy" = tốt). Bỏ qua giá/trọng lượng vì
// "càng thấp càng tốt" sẽ vẽ ngược lại trực giác trên radar.
const RADAR_FEATURES: { key: string; label: string }[] = [
  { key: 'cpu_score', label: 'CPU' },
  { key: 'gpu_score', label: 'GPU' },
  { key: 'ram_gb', label: 'RAM' },
  { key: 'ssd_gb', label: 'SSD' },
  { key: 'battery_wh', label: 'Pin' },
  { key: 'refresh_hz', label: 'Màn hình' },
];

/** Biểu đồ radar "hồ sơ lý tưởng vs máy này" - tách riêng thành component dùng CHUNG cho
 * `ExplainDrawer.tsx` (giải thích chi tiết 1 máy) và panel dính ở `Results.tsx` (docs/07_UIUX.md
 * mục 6.3, màn hình lg/xl) để không lặp lại logic tính toán ở 2 nơi.
 *
 * Màu: "Bạn cần" = cam nét đứt (mục tiêu), "Máy này" = dải xanh -> cyan đặc hơn (thực tế) - 2 màu
 * đối lập để nhìn là phân biệt ngay chỗ máy vượt/hụt nhu cầu. */
export function RadarComparison({ ideal, laptop, height = 260 }: { ideal: Record<string, number>; laptop: Laptop; height?: number }) {
  // Mỗi lần render có thể có 2 biểu đồ cùng lúc (Drawer + panel dính) -> id gradient phải duy nhất,
  // nếu trùng id thì cả hai dùng chung 1 định nghĩa gradient và có thể mất màu khi 1 cái bị ẩn.
  const gradId = `radar-actual-${useId().replace(/:/g, '')}`;

  const featureValue: Record<string, number> = {
    cpu_score: laptop.cpu.score,
    gpu_score: laptop.gpu.score,
    ram_gb: laptop.ramGb,
    ssd_gb: laptop.ssdGb,
    battery_wh: laptop.batteryWh ?? 0,
    refresh_hz: laptop.refreshHz,
  };

  // Chuẩn hóa mỗi trục về 0-100% theo GIÁ TRỊ LỚN HƠN giữa "cần" và "thực tế" - giúp các trục có
  // đơn vị rất khác nhau (điểm CPU vs GB RAM vs Hz màn hình) hiện trên CÙNG 1 thang đo mà không
  // trục nào lấn át trục khác.
  const radarData = RADAR_FEATURES.filter((f) => ideal[f.key] != null).map((f) => {
    const need = ideal[f.key];
    const actual = featureValue[f.key];
    const max = Math.max(need, actual, 1);
    return {
      feature: f.label,
      'Bạn cần': Math.round((need / max) * 100),
      'Máy này': Math.round((actual / max) * 100),
    };
  });

  if (radarData.length < 3) return null;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <RadarChart data={radarData} outerRadius="72%">
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={t.primary500} stopOpacity={0.75} />
            <stop offset="100%" stopColor={t.ai500} stopOpacity={0.55} />
          </linearGradient>
        </defs>
        <PolarGrid stroke={t.borderStrong} strokeDasharray="3 3" />
        <PolarAngleAxis dataKey="feature" tick={{ fontSize: 13, fontWeight: 600, fill: t.textPrimary }} />
        <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 10, fill: t.textTertiary }} axisLine={false} />
        <Radar
          name="Bạn cần"
          dataKey="Bạn cần"
          stroke={t.chartNeed}
          strokeWidth={2.5}
          strokeDasharray="6 4"
          fill={t.chartNeed}
          fillOpacity={0.18}
          dot={{ r: 3, fill: t.chartNeed, strokeWidth: 0 }}
        />
        <Radar
          name="Máy này"
          dataKey="Máy này"
          stroke={t.primary500}
          strokeWidth={2.5}
          fill={`url(#${gradId})`}
          fillOpacity={1}
          dot={{ r: 4, fill: t.primary500, stroke: t.white, strokeWidth: 1.5 }}
        />
        <Tooltip formatter={(v) => `${v}%`} />
        <Legend iconType="circle" wrapperStyle={{ fontSize: 13, fontWeight: 600 }} />
      </RadarChart>
    </ResponsiveContainer>
  );
}
