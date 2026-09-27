import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Legend, ResponsiveContainer } from 'recharts';
import type { Laptop } from '../../types';
import { t } from '../../theme/tokens';

// Cac dac trung dua vao bieu do RADAR (FR-04) - chi chon nhung truc CANG CAO CANG TOT de viec
// chuan hoa ve thang 0-100% co y nghia truc quan ("phu day" = tot). Bo qua gia/trong luong vi
// "cang thap cang tot" se ve nguoc lai truc giac tren radar.
const RADAR_FEATURES: { key: string; label: string }[] = [
  { key: 'cpu_score', label: 'CPU' },
  { key: 'gpu_score', label: 'GPU' },
  { key: 'ram_gb', label: 'RAM' },
  { key: 'ssd_gb', label: 'SSD' },
  { key: 'battery_wh', label: 'Pin' },
  { key: 'refresh_hz', label: 'Màn hình' },
];

/** Bieu do radar "ho so ly tuong vs may nay" - tach rieng thanh component dung CHUNG cho
 * `ExplainDrawer.tsx` (giai thich chi tiet 1 may) va panel dinh o `Results.tsx` (docs/07_UIUX.md
 * muc 6.3, man hinh lg/xl) de khong lap lai logic tinh toan 2 noi. */
export function RadarComparison({ ideal, laptop, height = 260 }: { ideal: Record<string, number>; laptop: Laptop; height?: number }) {
  const featureValue: Record<string, number> = {
    cpu_score: laptop.cpu.score,
    gpu_score: laptop.gpu.score,
    ram_gb: laptop.ramGb,
    ssd_gb: laptop.ssdGb,
    battery_wh: laptop.batteryWh ?? 0,
    refresh_hz: laptop.refreshHz,
  };

  // Chuan hoa moi truc ve 0-100% theo GIA TRI LON HON giua "can" va "thuc te" - giup cac truc co
  // don vi rat khac nhau (diem CPU vs GB RAM vs Hz man hinh) hien tren CUNG 1 thang do ma khong
  // truc nao lan at truc khac.
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
      <RadarChart data={radarData} outerRadius="75%">
        <PolarGrid />
        <PolarAngleAxis dataKey="feature" tick={{ fontSize: 12 }} />
        <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 10 }} />
        <Radar name="Bạn cần" dataKey="Bạn cần" stroke={t.textTertiary} fill={t.textTertiary} fillOpacity={0.15} />
        <Radar name="Máy này" dataKey="Máy này" stroke={t.primary700} fill={t.primary700} fillOpacity={0.35} />
        <Legend />
      </RadarChart>
    </ResponsiveContainer>
  );
}
