import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button, Empty, Result } from 'antd';
import { RecommendationCard } from '../components/smart/RecommendationCard';
import { ExplainDrawer } from '../components/smart/ExplainDrawer';
import { FallbackBanner, BudgetRelaxedBanner } from '../components/smart/FallbackBanner';
import type { RecommendationItemDto, RecommendationResult } from '../types';

export function Results() {
  const location = useLocation();
  const navigate = useNavigate();
  const result = (location.state as { result?: RecommendationResult } | null)?.result;

  const [explainItem, setExplainItem] = useState<RecommendationItemDto | null>(null);
  const [compareIds, setCompareIds] = useState<number[]>([]);

  if (!result) {
    return (
      <div style={{ maxWidth: 600, margin: '60px auto' }}>
        <Result
          status="info"
          title="Chưa có kết quả"
          subTitle="Hãy trả lời wizard nhu cầu trước để xem gợi ý."
          extra={
            <Button type="primary" onClick={() => navigate('/wizard')}>
              Bắt đầu tư vấn
            </Button>
          }
        />
      </div>
    );
  }

  function toggleCompare(id: number) {
    setCompareIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id].slice(0, 3)));
  }

  return (
    <div style={{ maxWidth: 900, margin: '32px auto', padding: '0 16px' }}>
      <h1>Kết quả gợi ý</h1>
      {result.mode === 'FALLBACK' && <FallbackBanner />}
      {result.budgetRelaxed && <BudgetRelaxedBanner />}

      {result.items.length === 0 ? (
        <Empty description="Chưa có máy nào khớp mọi điều kiện. Thử nới ngân sách hoặc bỏ bớt yêu cầu bắt buộc." />
      ) : (
        <div style={{ display: 'grid', gap: 16 }}>
          {result.items.map((item) => (
            <RecommendationCard
              key={item.laptopId}
              item={item}
              sessionId={result.sessionId}
              onExplain={() => setExplainItem(item)}
              onCompareToggle={() => toggleCompare(item.laptopId)}
              isComparing={compareIds.includes(item.laptopId)}
            />
          ))}
        </div>
      )}

      {compareIds.length >= 2 && (
        <div style={{ position: 'sticky', bottom: 16, marginTop: 16, textAlign: 'center' }}>
          <Button type="primary" size="large" onClick={() => navigate(`/compare?ids=${compareIds.join(',')}`)}>
            So sánh {compareIds.length} máy đã chọn
          </Button>
        </div>
      )}

      <ExplainDrawer
        open={!!explainItem}
        onClose={() => setExplainItem(null)}
        item={explainItem}
        ideal={result.ideal}
        modelVersion={result.modelVersion}
      />
    </div>
  );
}
