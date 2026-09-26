import { Drawer, Table } from 'antd';
import type { RecommendationItemDto } from '../../types';
import { t } from '../../theme/tokens';
import { explainText } from '../../utils/explainText';

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

  const rows = Object.keys(FEATURE_LABELS)
    .filter((k) => ideal[k] != null)
    .map((k) => ({
      key: k,
      feature: FEATURE_LABELS[k],
      need: Math.round(ideal[k] * 100) / 100,
      actual: Math.round(featureValue[k] * 100) / 100,
      diff: Math.round((featureValue[k] - ideal[k]) * 100) / 100,
    }));

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
