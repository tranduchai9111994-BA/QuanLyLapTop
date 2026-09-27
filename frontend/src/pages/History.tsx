import { useEffect, useState } from 'react';
import { Button, Card, Empty, Result, Tag } from 'antd';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { segmentColors, t } from '../theme/tokens';
import { formatVnd } from '../utils/format';
import type { RecommendationResult } from '../types';

interface SessionRow {
  id: string;
  usedSegment: string;
  isFallback: boolean;
  createdAt: string;
  items: { rank: number; laptop: { id: number; name: string; priceVnd: number; imageUrl: string | null } }[];
}

/** UC-08: lịch sử tư vấn của khách hàng đã đăng nhập - mỗi lần bấm "Xem kết quả" ở Wizard tạo 1
 * `RecommendationSession`. Bấm vào 1 phiên để xem lại y hệt kết quả cũ (không phải gọi lại thuật
 * toán - chỉ dựng lại object RecommendationResult từ dữ liệu ĐÃ LƯU, nên luôn khớp với những gì
 * người dùng thấy lúc đó, kể cả nếu giá/mô hình đã đổi từ khi đó tới nay). */
export function History() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const token = localStorage.getItem('smartlap_token');
  const userRaw = localStorage.getItem('smartlap_user');
  const user = userRaw ? JSON.parse(userRaw) : null;

  useEffect(() => {
    if (!token || user?.role !== 'CUSTOMER') return;
    api
      .get('/me/sessions')
      .then((r) => setRows(r.data.data))
      .finally(() => setLoading(false));
  }, [token]);

  if (!token || user?.role !== 'CUSTOMER') {
    return (
      <div style={{ maxWidth: 600, margin: '60px auto' }}>
        <Result
          status="info"
          title="Đăng nhập để xem lịch sử tư vấn"
          extra={
            <Button type="primary" onClick={() => navigate('/login', { state: { from: '/history' } })}>
              Đăng nhập / Tạo tài khoản
            </Button>
          }
        />
      </div>
    );
  }

  function openSession(row: SessionRow) {
    // Dung lai DUNG DU LIEU DA LUU (khong goi lai API /recommendations) - Results.tsx chi can
    // 1 object dung hinh dang RecommendationResult, cac truong khong luu rieng (vd ideal/weights
    // day du) khong quan trong cho man XEM LAI nay vi khong co nut doi topN/giai thich chi tiet.
    const result: Partial<RecommendationResult> = {
      sessionId: row.id,
      mode: row.isFallback ? 'FALLBACK' : 'ML',
      budgetRelaxed: false,
      candidatesBeforeRelax: row.items.length,
      segment: { used: row.usedSegment as any, inferred: null, confidence: null },
      ideal: {},
      weights: {},
      modelVersion: null,
      latencyMs: 0,
      items: row.items.map((it) => ({
        rank: it.rank,
        laptopId: it.laptop.id,
        distance: null,
        matchPct: null,
        explanation: { strengths: [], warnings: [] },
        laptop: it.laptop as any,
      })),
    };
    navigate('/results', { state: { result } });
  }

  return (
    <div style={{ maxWidth: 900, margin: '24px auto', padding: '0 24px' }}>
      <h1>Lịch sử tư vấn</h1>
      {!loading && rows.length === 0 && (
        <Empty description="Chưa có lượt tư vấn nào.">
          <Button type="primary" onClick={() => navigate('/wizard')}>
            Bắt đầu tư vấn
          </Button>
        </Empty>
      )}
      <div style={{ display: 'grid', gap: 12 }}>
        {rows.map((row) => (
          <Card key={row.id} hoverable onClick={() => openSession(row)}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div>
                <Tag color={segmentColors[row.usedSegment]?.color}>{segmentColors[row.usedSegment]?.label ?? row.usedSegment}</Tag>
                {row.isFallback && <Tag color="warning">Chế độ dự phòng</Tag>}
              </div>
              <span style={{ color: t.textTertiary, fontSize: 13 }}>{new Date(row.createdAt).toLocaleString('vi-VN')}</span>
            </div>
            <div style={{ color: t.textSecondary, fontSize: 14 }}>
              {row.items.slice(0, 3).map((it) => it.laptop.name).join(' · ')}
              {row.items.length > 3 && ` +${row.items.length - 3} máy khác`}
            </div>
            {row.items[0] && (
              <div className="tabular-nums" style={{ marginTop: 4, color: t.primary700, fontWeight: 600 }}>
                Từ {formatVnd(Math.min(...row.items.map((it) => it.laptop.priceVnd)))}
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
