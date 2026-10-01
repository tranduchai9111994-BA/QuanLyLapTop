import { Drawer, Table, Tag } from 'antd';
import type { RecommendationItemDto, RecommendationResult } from '../../types';
import { segmentColors, t } from '../../theme/tokens';
import { explainText } from '../../utils/explainText';
import { formatNumber } from '../../utils/format';
import { RadarComparison } from './RadarComparison';

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
  segment,
}: {
  open: boolean;
  onClose: () => void;
  item: RecommendationItemDto | null;
  ideal: Record<string, number>;
  modelVersion: string | null;
  segment?: RecommendationResult['segment'];
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

      {/* docs/07_UIUX.md muc 7.5: khoi "Phan khuc duoc chon vi..." - CHI hien khi phan khuc dang
          dung DUOC SUY RA tu hoat dong (nguoi dung chon "Chua ro"), khong hien khi nguoi dung tu
          chon ro rang mot phan khuc cu the (luc do khong co "ly do AI" nao de giai thich). */}
      {segment?.inferred && segment.neighbors && segment.neighbors.length > 0 && (
        <>
          <h4 style={{ marginTop: 20 }}>Phân khúc được chọn vì…</h4>
          <div style={{ fontSize: 13, color: t.textSecondary, marginBottom: 8 }}>
            Từ hoạt động bạn chọn, Mô hình A xếp vào{' '}
            <strong style={{ color: segmentColors[segment.inferred]?.color }}>
              {segmentColors[segment.inferred]?.label ?? segment.inferred}
            </strong>{' '}
            (độ tin cậy {Math.round((segment.confidence ?? 0) * 100)}%) — dựa trên{' '}
            {segment.neighbors.length} máy gần nhất trong dữ liệu huấn luyện đã "bỏ phiếu":
          </div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
            {segment.neighbors.map((n, i) => (
              <Tag key={i} color={segmentColors[n.label]?.color} style={{ fontSize: 11, margin: 0 }}>
                #{i + 1} {segmentColors[n.label]?.label ?? n.label} · khoảng cách {n.distance.toFixed(2)}
              </Tag>
            ))}
          </div>
        </>
      )}

      <h4 style={{ marginTop: 20 }}>Biểu đồ so sánh</h4>
      <RadarComparison ideal={ideal} laptop={laptop} />

      <h4 style={{ marginTop: 20 }}>So với hồ sơ lý tưởng</h4>
      <Table
        size="small"
        pagination={false}
        dataSource={rows}
        columns={[
          { title: 'Đặc trưng', dataIndex: 'feature' },
          { title: 'Bạn cần', dataIndex: 'need', className: 'tabular-nums', render: (v: number) => formatNumber(v) },
          { title: 'Máy này', dataIndex: 'actual', className: 'tabular-nums', render: (v: number) => formatNumber(v) },
          { title: 'Mức lệch', dataIndex: 'diff', className: 'tabular-nums', render: (v: number) => formatNumber(v) },
        ]}
      />

      <div style={{ marginTop: 16, fontSize: 12, color: t.textTertiary }}>
        Mô hình kNN phiên bản {modelVersion ?? 'không xác định (chế độ dự phòng)'}
      </div>
    </Drawer>
  );
}
