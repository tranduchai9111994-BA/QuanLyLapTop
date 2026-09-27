import { useEffect, useState } from 'react';
import { Alert, Button, Card, Empty, Progress, Select, Space, Tag, message } from 'antd';
import { CheckCircleOutlined } from '@ant-design/icons';
import { api } from '../../lib/api';
import { segmentColors, t } from '../../theme/tokens';
import { formatVnd } from '../../utils/format';

interface QueueItem {
  laptopId: number;
  laptop: {
    sku: string;
    name: string;
    brand: { name: string };
    cpu: { displayName: string };
    gpu: { displayName: string };
    priceVnd: number;
  };
  segment: string;
  confidence: number | null;
  distribution: Record<string, number>;
  predictedBy: string | null;
  waitingSince: string;
}

const SEGMENT_OPTIONS = ['OFFICE', 'ULTRABOOK', 'GAMING', 'CREATOR'].map((s) => ({
  label: segmentColors[s].label,
  value: s,
}));

/**
 * UC-10: hàng đợi "Cần xác minh" — nhân viên/quản trị viên duyệt lại các máy mà Mô hình A tự gán
 * nhãn nhưng ĐỘ TIN CẬY THẤP (dưới ngưỡng cấu hình, xem KnowledgeConfig.confidence_threshold).
 * Máy trong hàng đợi VẪN ĐANG được gợi ý tạm cho khách bằng nhãn AI gán - duyệt càng sớm càng
 * giảm rủi ro gợi ý sai phân khúc, không phải "máy bị ẩn chờ duyệt mới hiện".
 */
export function AdminReviewQueue() {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [choices, setChoices] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState<number | null>(null);

  function load() {
    setLoading(true);
    api
      .get('/labels/review-queue')
      .then((r) => setItems(r.data.data))
      .catch(() => message.error('Không tải được hàng đợi. Kiểm tra mạng và thử lại.'))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function verify(item: QueueItem) {
    const segment = choices[item.laptopId] ?? item.segment;
    setSaving(item.laptopId);
    try {
      await api.patch(`/labels/review-queue/${item.laptopId}`, { segment });
      message.success(`Đã duyệt "${item.laptop.name}" → ${segmentColors[segment]?.label ?? segment}`);
      load();
      window.dispatchEvent(new Event('smartlap:review-queue-changed'));
    } catch (err: any) {
      message.error(err?.response?.data?.error?.message ?? 'Không duyệt được, vui lòng thử lại.');
    } finally {
      setSaving(null);
    }
  }

  return (
    <div>
      <h2>Duyệt nhãn phân khúc</h2>
      <p style={{ color: t.textSecondary }}>
        Các máy Mô hình A tự gán nhãn nhưng độ tin cậy thấp — vẫn đang được gợi ý tạm cho khách
        bằng nhãn này, duyệt sớm giúp tránh gợi ý sai phân khúc.
      </p>

      {!loading && items.length === 0 && (
        <Empty description="Không có máy nào đang chờ xác minh — mọi nhãn hiện tại đều đáng tin cậy." />
      )}

      <Space direction="vertical" style={{ width: '100%' }} size={12}>
        {items.map((item) => {
          const chosen = choices[item.laptopId] ?? item.segment;
          const changed = chosen !== item.segment;
          return (
            <Card key={item.laptopId} loading={loading}>
              <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
                <div style={{ minWidth: 260 }}>
                  <div style={{ fontWeight: 600, fontSize: 16 }}>{item.laptop.name}</div>
                  <div style={{ color: t.textSecondary, fontSize: 13 }}>
                    {item.laptop.sku} · {item.laptop.brand.name} · {item.laptop.cpu.displayName} ·{' '}
                    {item.laptop.gpu.displayName}
                  </div>
                  <div style={{ marginTop: 4 }} className="tabular-nums">
                    {formatVnd(item.laptop.priceVnd)}
                  </div>
                </div>

                <div style={{ flex: '1 1 260px', minWidth: 220 }}>
                  <div style={{ fontSize: 13, color: t.textSecondary, marginBottom: 4 }}>
                    AI tạm gán <Tag color={segmentColors[item.segment]?.color}>{segmentColors[item.segment]?.label}</Tag>
                    với độ tin cậy <strong>{Math.round((item.confidence ?? 0) * 100)}%</strong>
                  </div>
                  {Object.entries(item.distribution)
                    .sort((a, b) => b[1] - a[1])
                    .map(([seg, p]) => (
                      <div key={seg} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                        <span style={{ width: 130 }}>{segmentColors[seg]?.label ?? seg}</span>
                        <Progress percent={Math.round(p * 100)} size="small" strokeColor={segmentColors[seg]?.color} style={{ flex: 1, margin: 0 }} />
                      </div>
                    ))}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 220 }}>
                  <Select
                    value={chosen}
                    options={SEGMENT_OPTIONS}
                    onChange={(v) => setChoices((prev) => ({ ...prev, [item.laptopId]: v }))}
                  />
                  {changed && (
                    <Alert type="warning" showIcon message="Đang chọn khác nhãn AI — sẽ lưu với nguồn nhân viên." />
                  )}
                  <Button
                    type="primary"
                    icon={<CheckCircleOutlined />}
                    loading={saving === item.laptopId}
                    onClick={() => verify(item)}
                  >
                    {changed ? 'Duyệt với nhãn đã chọn' : 'Duyệt (giữ nhãn AI)'}
                  </Button>
                </div>
              </div>
            </Card>
          );
        })}
      </Space>
    </div>
  );
}
