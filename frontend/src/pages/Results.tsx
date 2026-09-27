import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button, Empty, Result, Space } from 'antd';
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
    <div style={{ maxWidth: 1240, margin: '24px auto', padding: '0 24px' }}>
      <h1>Kết quả gợi ý</h1>
      {result.mode === 'FALLBACK' && <FallbackBanner />}
      {result.budgetRelaxed && <BudgetRelaxedBanner />}

      {result.items.length === 0 ? (
        /* Khong bao gio de trang trong tron: neu khong tim duoc may nao, phai noi RO vi sao
           va cho duong quay lai sua nhu cau ngay (docs/07 SS8). */
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={
            <div>
              <div style={{ fontWeight: 600, marginBottom: 8 }}>
                Chưa tìm được máy nào khớp toàn bộ yêu cầu của bạn
              </div>
              <div style={{ color: '#4A5B73' }}>
                Thường do ngân sách hơi thấp so với cấu hình mong muốn, hoặc ràng buộc bắt buộc
                (RAM / cân nặng) quá chặt.
              </div>
            </div>
          }
        >
          <Space wrap>
            <Button type="primary" onClick={() => navigate('/wizard')}>
              Sửa lại nhu cầu
            </Button>
            <Button onClick={() => navigate('/laptops')}>Tự xem danh mục</Button>
          </Space>
        </Empty>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
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
