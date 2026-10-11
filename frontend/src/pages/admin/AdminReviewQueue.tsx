import { useEffect, useState } from 'react';
import { Alert, Button, Card, Checkbox, Empty, Select, Space, message } from 'antd';
import { CheckCircleOutlined, DownloadOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import { api } from '../../lib/api';
import { segmentColors, t } from '../../theme/tokens';
import { formatVnd } from '../../utils/format';
import { ConfidenceIndicator } from '../../components/smart/ConfidenceIndicator';
import { SegmentMathModal } from '../../components/admin/SegmentMathModal';
import type { MathView, SegmentPrediction } from '../../components/admin/SegmentMathModal';

interface QueueItem {
  laptopId: number;
  laptop: {
    sku: string;
    name: string;
    brand: { name: string };
    cpu: { displayName: string };
    gpu: { displayName: string };
    priceVnd: number;
    // Thông số đưa vào Mô hình A (API hàng đợi trả đủ các cột của máy); dùng để tính lại khi xem chi tiết
    cpuId: number;
    gpuId: number;
    ramGb: number;
    ssdGb: number;
    screenInch: number;
    resWidth: number;
    resHeight: number;
    refreshHz: number | null;
    srgb100: boolean;
    weightKg: number;
    batteryWh: number | null;
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
  // Cửa sổ "Chi tiết cách tính" của một máy trong hàng đợi
  const [detail, setDetail] = useState<{ item: QueueItem; pred: SegmentPrediction } | null>(null);
  const [mathView, setMathView] = useState<MathView | null>(null); // bảng đang mở (null = đóng)
  const [detailLoading, setDetailLoading] = useState<number | null>(null); // laptopId đang chờ tính

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

  /**
   * Tính lại dự đoán của Mô hình A cho đúng cấu hình của máy này rồi mở bảng toán học.
   * Hàng đợi chỉ lưu nhãn và xác suất tại thời điểm gán, không lưu số liệu trung gian (z-score, láng giềng),
   * nên phải gọi lại API dự đoán; kết quả dùng MÔ HÌNH ĐANG DÙNG, có thể khác nhãn đã lưu (xem `detailNotice`).
   */
  async function openDetail(item: QueueItem) {
    const l = item.laptop;
    setDetailLoading(item.laptopId);
    try {
      const r = await api.post('/laptops/predict-segment', {
        cpuId: l.cpuId,
        gpuId: l.gpuId,
        ramGb: l.ramGb,
        ssdGb: l.ssdGb,
        screenInch: l.screenInch,
        resWidth: l.resWidth,
        resHeight: l.resHeight,
        refreshHz: l.refreshHz ?? 60,
        srgb100: !!l.srgb100,
        weightKg: l.weightKg,
        batteryWh: l.batteryWh ?? 55,
      });
      setDetail({ item, pred: r.data.data });
      setMathView({ type: 'vote' });
    } catch (err: any) {
      message.error(err?.response?.data?.error?.message ?? 'Không tính được chi tiết. Kiểm tra dịch vụ ML có đang chạy không.');
    } finally {
      setDetailLoading(null);
    }
  }

  /** Ghi chú đầu cửa sổ: tên máy, và nhắc nếu số tính lại khác với nhãn đang lưu trong hàng đợi. */
  function detailNotice(item: QueueItem, pred: SegmentPrediction) {
    const name = (code: string) => segmentColors[code]?.label ?? code;
    const pct = (v: number) => `${Math.round(v * 100)}%`;
    const sameAsStored = item.confidence !== null && Math.abs(item.confidence - pred.proba) < 0.005;
    return (
      <Alert
        style={{ marginBottom: 12 }}
        type={sameAsStored ? 'info' : 'warning'}
        showIcon
        message={`Máy: ${item.laptop.name}`}
        description={
          sameAsStored
            ? `Khớp với nhãn đang lưu (${name(item.segment)} ${pct(item.confidence ?? 0)}).`
            : `Nhãn đang lưu trong hàng đợi: ${name(item.segment)} ${item.confidence === null ? '' : pct(item.confidence)}` +
              ` (do "${item.predictedBy ?? 'không rõ'}" dự đoán). Bảng dưới là TÍNH LẠI bằng mô hình đang dùng` +
              ` (${pred.modelVersion ?? 'không rõ'}) cho cùng cấu hình: ${name(pred.label)} ${pct(pred.proba)}.` +
              ' Hai kết quả có thể khác nhau nếu nhãn được tạo bởi phiên bản mô hình khác hoặc là dữ liệu mẫu.'
        }
      />
    );
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
                  {/* Mở bảng toán học: chuẩn hóa, khoảng cách tới các máy đã ghi nhớ, bỏ phiếu, so ngưỡng */}
                  <Button
                    type="link"
                    size="small"
                    style={{ paddingLeft: 0 }}
                    icon={<ExclamationCircleOutlined />}
                    loading={detailLoading === item.laptopId}
                    onClick={() => openDetail(item)}
                  >
                    Chi tiết
                  </Button>
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

      {/* Cửa sổ toán học dùng chung với màn AI gợi ý (SegmentMathModal) */}
      {detail?.pred.explain && (
        <SegmentMathModal
          view={mathView}
          onClose={() => setMathView(null)}
          onNavigate={setMathView}
          threshold={detail.pred.threshold ?? 0.6}
          explain={detail.pred.explain}
          neighbors={detail.pred.neighbors}
          distribution={detail.pred.distribution}
          proba={detail.pred.proba}
          notice={detailNotice(detail.item, detail.pred)}
        />
      )}
    </div>
  );
}
