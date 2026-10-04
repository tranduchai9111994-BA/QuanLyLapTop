import { Tag, Tooltip } from 'antd';
import { segmentColors, t } from '../../theme/tokens';

// Thứ tự cố định trên thanh để dễ so sánh giữa nhiều máy.
const SEGMENT_ORDER = ['OFFICE', 'ULTRABOOK', 'GAMING', 'CREATOR'] as const;

/** docs/07_UIUX.md mục 7.8 `ConfidenceIndicator`: thanh ngang 4 đoạn màu phân khúc, độ rộng theo
 * xác suất Mô hình A dự đoán. Dưới ngưỡng tin cậy (mặc định 0,6, khớp `confidence_threshold`)
 * hiện Tag "Cần xác minh". Dùng chung cho `SegmentSuggester.tsx` và `AdminReviewQueue.tsx`. */
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

      {/* Mỗi đoạn rộng theo xác suất của phân khúc; bỏ qua đoạn có xác suất 0 */}
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
