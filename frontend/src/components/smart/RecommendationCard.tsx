import { Button, Tag, message } from 'antd';
import { LikeOutlined, DislikeOutlined, LikeFilled, DislikeFilled } from '@ant-design/icons';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { RecommendationItemDto } from '../../types';
import { AiBadge } from './AiBadge';
import { MatchScore } from './MatchScore';
import { SegmentTag } from './SegmentTag';
import { LaptopThumbnail } from './LaptopThumbnail';
import { DiscountBadge } from './DiscountBadge';
import { t } from '../../theme/tokens';
import { formatVnd, formatKg } from '../../utils/format';
import { explainText } from '../../utils/explainText';
import { api } from '../../lib/api';

export function RecommendationCard({
  item,
  sessionId,
  onExplain,
  onCompareToggle,
  isComparing,
}: {
  item: RecommendationItemDto;
  sessionId: string;
  onExplain: () => void;
  onCompareToggle: () => void;
  isComparing: boolean;
}) {
  const navigate = useNavigate();
  const [feedback, setFeedback] = useState<'LIKE' | 'DISLIKE' | null>(null);
  const laptop = item.laptop;
  const isTop1 = item.rank === 1;

  async function sendFeedback(type: 'LIKE' | 'DISLIKE') {
    setFeedback(type);
    try {
      await api.post('/events', { sessionId, laptopId: laptop.id, type });
      message.success('Cảm ơn bạn! Phản hồi giúp hệ thống gợi ý tốt hơn.');
    } catch {
      // im lang - khong lam gian doan trai nghiem
    }
  }

  return (
    <div
      style={{
        background: t.bgSurface,
        borderRadius: 16,
        border: isTop1 ? `3px solid transparent` : `1px solid ${t.border}`,
        backgroundImage: isTop1 ? `linear-gradient(white, white), ${t.aiGradient}` : undefined,
        backgroundOrigin: 'border-box',
        backgroundClip: isTop1 ? 'padding-box, border-box' : undefined,
        boxShadow: t.shadowMd,
        padding: 16,
      }}
    >
      {/* Bo cuc NGANG: anh ben trai, thong tin ben phai (docs/07 SS7.4) - truoc day anh keo dai
          het chieu ngang the nen thua rat nhieu khoang trong. */}
      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
        <LaptopThumbnail
          imageUrl={laptop.imageUrl}
          segment={laptop.segmentLabel?.segment}
          brand={laptop.brand?.name}
          name={laptop.name}
          width={128}
          height={96}
        />

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                <span style={{ fontWeight: 700 }}>#{item.rank}</span>
                {!item.isPinned && <AiBadge />}
                {item.isPinned && <Tag>Đề xuất từ cửa hàng</Tag>}
              </div>
              <h3 style={{ margin: '2px 0' }}>{laptop.name}</h3>
              <div style={{ display: 'flex', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                {laptop.segmentLabel && <SegmentTag segment={laptop.segmentLabel.segment} />}
                {laptop.valueIdx > 3.5 && <Tag color="gold">💎 Đáng tiền nhất</Tag>}
              </div>
              <div style={{ fontSize: 22, fontWeight: 700, color: t.primary700 }} className="tabular-nums">
                {formatVnd(laptop.priceVnd)}
              </div>
              <DiscountBadge
                priceVnd={laptop.priceVnd}
                originalPriceVnd={laptop.originalPriceVnd}
                salesCount={laptop.salesCount}
              />
              <div style={{ color: t.textSecondary, fontSize: 13 }}>
                {laptop.cpu.displayName} · {laptop.gpu.displayName} · {laptop.ramGb}GB · {laptop.ssdGb}GB ·{' '}
                {formatKg(laptop.weightKg)}
              </div>
            </div>
            <MatchScore pct={item.matchPct} />
          </div>

          <div style={{ marginTop: 8 }}>
            {item.explanation.strengths.slice(0, 2).map((s, i) => (
              <div key={i} style={{ color: t.success, fontSize: 14, marginBottom: 2 }}>
                ✅ {explainText(s)}
              </div>
            ))}
            {item.explanation.warnings.map((w, i) => (
              <div key={i} style={{ color: t.warning, fontSize: 14, marginBottom: 2 }}>
                ⚠️ {explainText(w)}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button size="small" onClick={onExplain}>
            Vì sao gợi ý?
          </Button>
          <Button size="small" onClick={onCompareToggle} type={isComparing ? 'primary' : 'default'}>
            {isComparing ? '✓ Đang so sánh' : '+ So sánh'}
          </Button>
          <Button size="small" onClick={() => navigate(`/laptop/${laptop.id}`)}>
            Chi tiết
          </Button>
        </div>
        <div>
          <Button
            shape="circle"
            icon={feedback === 'LIKE' ? <LikeFilled /> : <LikeOutlined />}
            onClick={() => sendFeedback('LIKE')}
            style={{ marginRight: 4, color: feedback === 'LIKE' ? t.success : undefined }}
          />
          <Button
            shape="circle"
            icon={feedback === 'DISLIKE' ? <DislikeFilled /> : <DislikeOutlined />}
            onClick={() => sendFeedback('DISLIKE')}
            style={{ color: feedback === 'DISLIKE' ? t.error : undefined }}
          />
        </div>
      </div>
    </div>
  );
}
