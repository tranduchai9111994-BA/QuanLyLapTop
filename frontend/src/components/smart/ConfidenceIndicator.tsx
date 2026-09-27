import { Tag, Tooltip } from 'antd';
import { segmentColors, t } from '../../theme/tokens';

// Thu tu CO DINH tren thanh - giup nguoi xem quen mat, so sanh nhanh giua nhieu may (khong bi
// doi thu tu tuy theo phan khuc nao dang thang the trong tung du doan).
const SEGMENT_ORDER = ['OFFICE', 'ULTRABOOK', 'GAMING', 'CREATOR'] as const;

/** docs/07_UIUX.md muc 7.8 `ConfidenceIndicator` (man quan tri): thanh ngang chia 4 doan mau
 * phan khuc, do rong ty le theo xac suat Mo hinh A du doan cho tung phan khuc - thay vi 4 thanh
 * Progress rieng le xep chong (kho so sanh tuong quan giua cac phan khuc cung luc). Duoi nguong
 * tin cay (mac dinh 0,6, khop `confidence_threshold` trong Cau hinh tri thuc) hien Tag canh bao
 * "Cần xác minh" - dung 1 component nay cho ca `SegmentSuggester.tsx` (them laptop moi) va
 * `AdminReviewQueue.tsx` (hang doi nhan can duyet) de nhat quan. */
export function ConfidenceIndicator({
  distribution,
  threshold = 0.6,
}: {
  distribution: Record<string, number>;
  threshold?: number;
}) {
  const entries = Object.entries(distribution);
  if (entries.length === 0) return null;
  const [topSegment, topProba] = entries.reduce((a, b) => (b[1] > a[1] ? b : a));
  const needsReview = topProba < threshold;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span style={{ fontSize: 13 }}>
          Dự đoán:{' '}
          <strong style={{ color: segmentColors[topSegment]?.color }}>
            {segmentColors[topSegment]?.label ?? topSegment}
          </strong>{' '}
          <span className="tabular-nums" style={{ fontWeight: 600 }}>
            {Math.round(topProba * 100)}%
          </span>
        </span>
        {needsReview && <Tag color="warning">Cần xác minh</Tag>}
      </div>

      {/* Thanh ngang 4 doan - moi doan rong = xac suat cua phan khuc do, tong 4 doan = 100%. Bo
          qua doan co xac suat 0 de khong ve vien thua khi phan khuc do khong xuat hien. */}
      <div style={{ display: 'flex', height: 10, borderRadius: 999, overflow: 'hidden', background: t.bgSubtle }}>
        {SEGMENT_ORDER.map((seg) => {
          const p = distribution[seg] ?? 0;
          if (p <= 0) return null;
          return (
            <Tooltip key={seg} title={`${segmentColors[seg]?.label ?? seg}: ${Math.round(p * 100)}%`}>
              <div style={{ width: `${p * 100}%`, background: segmentColors[seg]?.color, height: '100%' }} />
            </Tooltip>
          );
        })}
      </div>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 6 }}>
        {SEGMENT_ORDER.map((seg) => (
          <span key={seg} style={{ fontSize: 11, color: t.textTertiary, display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: segmentColors[seg]?.color, display: 'inline-block' }} />
            {segmentColors[seg]?.label ?? seg}: {Math.round((distribution[seg] ?? 0) * 100)}%
          </span>
        ))}
      </div>
    </div>
  );
}
