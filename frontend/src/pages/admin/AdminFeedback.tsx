import { useEffect, useMemo, useState } from 'react';
import { Card, Col, Row, Statistic, Table, Tag, message } from 'antd';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { api } from '../../lib/api';
import { t } from '../../theme/tokens';

interface SummaryRow {
  type: string;
  reason: string | null;
  _count: number;
}
interface NeedTextRow {
  text: string;
  label: string;
}

const REASON_LABELS: Record<string, string> = {
  TOO_EXPENSIVE: 'Giá quá cao',
  TOO_HEAVY: 'Máy quá nặng/cồng kềnh',
  WEAK_PERFORMANCE: 'Cấu hình yếu',
  POOR_DISPLAY: 'Màn hình không như ý',
  BRAND: 'Không thích thương hiệu',
  OTHER: 'Lý do khác',
};
const TYPE_LABELS: Record<string, string> = {
  VIEW_DETAIL: 'Xem chi tiết',
  LIKE: 'Thích',
  DISLIKE: 'Không thích',
  ADD_COMPARE: 'Thêm vào so sánh',
  ADD_FAVORITE: 'Thêm vào yêu thích',
};

/** UC-15 Phân tích phản hồi: tổng hợp toàn bộ sự kiện hành vi (`InteractionEvent`) theo loại,
 * và với riêng loại "Không thích" — theo LÝ DO cụ thể (thu thập từ modal chọn lý do trong
 * `RecommendationCard.tsx`, xem Giai đoạn 3) để biết vì sao khách chê nhiều nhất: giá, cân nặng,
 * cấu hình, màn hình hay thương hiệu — từ đó biết nên điều chỉnh trọng số nhóm nào trong FR-13. */
export function AdminFeedback() {
  const [summary, setSummary] = useState<SummaryRow[]>([]);
  const [needTexts, setNeedTexts] = useState<NeedTextRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([api.get('/feedback/summary'), api.get('/feedback/need-texts')])
      .then(([s, n]) => {
        setSummary(s.data.data);
        setNeedTexts(n.data.data);
      })
      .catch(() => message.error('Không tải được dữ liệu phản hồi.'))
      .finally(() => setLoading(false));
  }, []);

  const byType = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of summary) map.set(r.type, (map.get(r.type) ?? 0) + r._count);
    return [...map.entries()].map(([type, count]) => ({ type: TYPE_LABELS[type] ?? type, count }));
  }, [summary]);

  const dislikeReasons = useMemo(
    () =>
      summary
        .filter((r) => r.type === 'DISLIKE' && r.reason)
        .map((r) => ({ reason: REASON_LABELS[r.reason!] ?? r.reason!, count: r._count }))
        .sort((a, b) => b.count - a.count),
    [summary]
  );

  const likeCount = byType.find((r) => r.type === TYPE_LABELS.LIKE)?.count ?? 0;
  const dislikeCount = byType.find((r) => r.type === TYPE_LABELS.DISLIKE)?.count ?? 0;
  const satisfactionPct = likeCount + dislikeCount > 0 ? Math.round((likeCount / (likeCount + dislikeCount)) * 100) : null;

  return (
    <div>
      <h2>Phân tích phản hồi</h2>

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={8}>
          <Card loading={loading}>
            <Statistic title="Tỷ lệ hài lòng" value={satisfactionPct ?? undefined} suffix="%" />
          </Card>
        </Col>
        <Col span={8}>
          <Card loading={loading}>
            <Statistic title="Lượt thích" value={likeCount} valueStyle={{ color: t.success }} />
          </Card>
        </Col>
        <Col span={8}>
          <Card loading={loading}>
            <Statistic title="Lượt không thích" value={dislikeCount} valueStyle={{ color: t.error }} />
          </Card>
        </Col>
      </Row>

      <Card title="Hành vi người dùng theo loại sự kiện" loading={loading} style={{ marginBottom: 24 }}>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={byType}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="type" />
            <YAxis allowDecimals={false} />
            <Tooltip />
            <Bar dataKey="count" name="Số lượt" fill={t.primary700} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      <Card title="Lý do 'Không thích' phổ biến nhất" loading={loading} style={{ marginBottom: 24 }}>
        {dislikeReasons.length === 0 ? (
          <div style={{ color: t.textSecondary }}>Chưa có phản hồi "Không thích" kèm lý do nào.</div>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={dislikeReasons} layout="vertical" margin={{ left: 40 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" allowDecimals={false} />
              <YAxis type="category" dataKey="reason" width={160} />
              <Tooltip />
              <Bar dataKey="count" name="Số lượt" fill={t.error} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Card>

      <Card title="Câu nhu cầu tự do đã học (phản hồi 👍)">
        <p style={{ color: t.textSecondary }}>
          Các câu người dùng tự nhập, được Mô hình C phân loại và người dùng xác nhận hài lòng
          (👍) với kết quả — nguồn dữ liệu học thêm cho Mô hình C (xem{' '}
          <code>retrain_from_feedback.py</code>).
        </p>
        <Table
          rowKey="text"
          size="small"
          dataSource={needTexts}
          pagination={{ pageSize: 8 }}
          columns={[
            { title: 'Câu nhu cầu', dataIndex: 'text' },
            { title: 'Nhãn suy ra', dataIndex: 'label', render: (v: string) => <Tag>{v}</Tag> },
          ]}
        />
      </Card>
    </div>
  );
}
