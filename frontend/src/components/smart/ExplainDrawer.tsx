import { Drawer, Table } from 'antd';
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import type { RecommendationItemDto } from '../../types';
import { t } from '../../theme/tokens';
import { explainText } from '../../utils/explainText';

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

// Ten hien thi tieng Viet cho tung dac trung ky thuat (khoa tieng Anh khop voi ten cot trong
// ml-service, xem MODEL_B_FEATURES o features.py) - dung de ve bang "so voi ho so ly tuong".
const FEATURE_LABELS: Record<string, string> = {
  cpu_score: 'Điểm CPU',
  gpu_score: 'Điểm GPU',
  ram_gb: 'RAM (GB)',
  ssd_gb: 'SSD (GB)',
  weight_kg: 'Trọng lượng (kg)',
  battery_wh: 'Pin (Wh)',
  ppi: 'Mật độ điểm ảnh',
  refresh_hz: 'Tần số quét (Hz)',
  price_vnd: 'Giá (VND)',
  screen_inch: 'Kích thước màn hình',
};

/** Drawer "Vi sao goi y?" - phan giai thich CHI TIET NHAT cho 1 may trong ket qua: liet ke diem
 * manh/diem can luu y (dang cau chu, tu explainText.ts) VA bang so sanh tung dac trung so hoc
 * that voi ho so ly tuong `ideal` (dung de nguoi dung/hoi dong doi chieu truc tiep voi cong thuc
 * khoang cach mot phia da hoc trong docs/13_GIAI_THICH_THUAT_TOAN_KNN.md). */
export function ExplainDrawer({
  open,
  onClose,
  item,
  ideal,
  modelVersion,
}: {
  open: boolean;
  onClose: () => void;
  item: RecommendationItemDto | null;
  ideal: Record<string, number>;
  modelVersion: string | null;
}) {
  if (!item) return null;
  const laptop = item.laptop;
  // Doi tuong Laptop (tu API) khong co san `ppi` (mat do diem anh) - day la truong duy nhat
  // CHUA duoc tinh o phia frontend nen tam de 0 (hang nay se tu an di vi `ideal.ppi` van co gia
  // tri that, chi cot "May nay" se hien 0 - TODO: backend nen tra ve ppi da tinh san trong DTO).
  const featureValue: Record<string, number> = {
    cpu_score: laptop.cpu.score,
    gpu_score: laptop.gpu.score,
    ram_gb: laptop.ramGb,
    ssd_gb: laptop.ssdGb,
    weight_kg: laptop.weightKg,
    battery_wh: laptop.batteryWh ?? 0,
    ppi: 0,
    refresh_hz: laptop.refreshHz,
    price_vnd: laptop.priceVnd,
    screen_inch: laptop.screenInch,
  };

  // Chi hien dac trung nao THAT SU co trong ho so ly tuong (vd neu backend khong tra ve
  // `ideal.battery_wh` thi khong ve dong "Pin" - tranh hien dong toan so 0 gay hieu nham)
  const rows = Object.keys(FEATURE_LABELS)
    .filter((k) => ideal[k] != null)
    .map((k) => ({
      key: k,
      feature: FEATURE_LABELS[k],
      need: Math.round(ideal[k] * 100) / 100,
      actual: Math.round(featureValue[k] * 100) / 100,
      diff: Math.round((featureValue[k] - ideal[k]) * 100) / 100,
    }));

  // Du lieu radar: chuan hoa moi truc ve 0-100% theo GIA TRI LON HON giua "can" va "thuc te" -
  // giup cac truc co don vi rat khac nhau (diem CPU vs GB RAM vs Hz man hinh) hien tren CUNG 1
  // thang do ma khong truc nao lan at truc khac.
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

  return (
    <Drawer title="Vì sao gợi ý?" open={open} onClose={onClose} width={480}>
      <h4>Điểm mạnh</h4>
      <ul>
        {item.explanation.strengths.map((s, i) => (
          <li key={i} style={{ color: t.success }}>
            ✅ {explainText(s)}
          </li>
        ))}
      </ul>
      {item.explanation.warnings.length > 0 && (
        <>
          <h4>Lưu ý</h4>
          <ul>
            {item.explanation.warnings.map((w, i) => (
              <li key={i} style={{ color: t.warning }}>
                ⚠️ {explainText(w)}
              </li>
            ))}
          </ul>
        </>
      )}

      {radarData.length >= 3 && (
        <>
          <h4 style={{ marginTop: 20 }}>Biểu đồ so sánh</h4>
          <ResponsiveContainer width="100%" height={260}>
            <RadarChart data={radarData} outerRadius="75%">
              <PolarGrid />
              <PolarAngleAxis dataKey="feature" tick={{ fontSize: 12 }} />
              <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 10 }} />
              <Radar name="Bạn cần" dataKey="Bạn cần" stroke={t.textTertiary} fill={t.textTertiary} fillOpacity={0.15} />
              <Radar name="Máy này" dataKey="Máy này" stroke={t.primary700} fill={t.primary700} fillOpacity={0.35} />
              <Legend />
            </RadarChart>
          </ResponsiveContainer>
        </>
      )}

      <h4 style={{ marginTop: 20 }}>So với hồ sơ lý tưởng</h4>
      <Table
        size="small"
        pagination={false}
        dataSource={rows}
        columns={[
          { title: 'Đặc trưng', dataIndex: 'feature' },
          { title: 'Bạn cần', dataIndex: 'need', className: 'tabular-nums' },
          { title: 'Máy này', dataIndex: 'actual', className: 'tabular-nums' },
          { title: 'Mức lệch', dataIndex: 'diff', className: 'tabular-nums' },
        ]}
      />

      <div style={{ marginTop: 16, fontSize: 12, color: t.textTertiary }}>
        Mô hình kNN phiên bản {modelVersion ?? 'không xác định (chế độ dự phòng)'}
      </div>
    </Drawer>
  );
}
