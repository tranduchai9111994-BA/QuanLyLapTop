import { useEffect, useState } from 'react';
import { Alert, Button, Card, Checkbox, Empty, Select, Space, message } from 'antd';
import { CheckCircleOutlined, DownloadOutlined } from '@ant-design/icons';
import { api } from '../../lib/api';
import { segmentColors, t } from '../../theme/tokens';
import { formatVnd } from '../../utils/format';
import { ConfidenceIndicator } from '../../components/smart/ConfidenceIndicator';

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
  locked: boolean;
}

const SEGMENT_OPTIONS = ['OFFICE', 'ULTRABOOK', 'GAMING', 'CREATOR'].map((s) => ({
  label: segmentColors[s].label,
  value: s,
}));

/**
 * UC-10: hàng đợi "Cần xác minh" - duyệt lại máy Mô hình A gán nhãn với độ tin cậy dưới ngưỡng
 * (KnowledgeConfig.confidence_threshold). Máy trong hàng đợi vẫn được gợi ý tạm bằng nhãn AI.
 */
export function AdminReviewQueue() {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [choices, setChoices] = useState<Record<number, string>>({});
  const [lockChoices, setLockChoices] = useState<Record<number, boolean>>({});
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
    const locked = lockChoices[item.laptopId] ?? item.locked;
    setSaving(item.laptopId);
    try {
      await api.patch(`/labels/review-queue/${item.laptopId}`, { segment, locked });
      message.success(`Đã duyệt "${item.laptop.name}" → ${segmentColors[segment]?.label ?? segment}`);
      load();
      window.dispatchEvent(new Event('smartlap:review-queue-changed'));
    } catch (err: any) {
      message.error(err?.response?.data?.error?.message ?? 'Không duyệt được, vui lòng thử lại.');
    } finally {
      setSaving(null);
    }
  }

  async function exportLabels() {
    try {
      const r = await api.get('/labels/export', { responseType: 'blob' });
      const url = URL.createObjectURL(r.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `nhan_da_duyet_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      message.error(err?.response?.status === 403 ? 'Chỉ quản trị viên được xuất nhãn.' : 'Không xuất được nhãn, vui lòng thử lại.');
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0 }}>Duyệt nhãn phân khúc</h2>
        <Button icon={<DownloadOutlined />} onClick={exportLabels}>
          Xuất nhãn đã duyệt (CSV)
        </Button>
      </div>
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
                  <ConfidenceIndicator distribution={item.distribution} />
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
                  <Checkbox
                    checked={lockChoices[item.laptopId] ?? item.locked}
                    onChange={(e) => setLockChoices((prev) => ({ ...prev, [item.laptopId]: e.target.checked }))}
                  >
                    Khóa nhãn, không cho mô hình thay đổi
                  </Checkbox>
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
