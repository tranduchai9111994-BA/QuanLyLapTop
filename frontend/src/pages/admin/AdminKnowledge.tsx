import { useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  DatePicker,
  Input,
  InputNumber,
  Popconfirm,
  Radio,
  Select,
  Slider,
  Space,
  Table,
  Tabs,
  Tag,
  message,
} from 'antd';
import { DeleteOutlined, SaveOutlined } from '@ant-design/icons';
import dayjs, { type Dayjs } from 'dayjs';
import { api } from '../../lib/api';
import { segmentColors, t } from '../../theme/tokens';
import { formatVnd } from '../../utils/format';

const SEGMENTS = ['OFFICE', 'ULTRABOOK', 'GAMING', 'CREATOR'] as const;
type Seg = (typeof SEGMENTS)[number];

interface Pin {
  id: number;
  laptopId: number;
  action: 'PIN' | 'BAN';
  segment: string | null;
  reason: string | null;
  expiresAt: string | null;
  createdAt: string;
  laptop: { name: string; sku: string; priceVnd: number };
}

interface LaptopOption {
  id: number;
  name: string;
  sku: string;
}

type WeightGroups = { performance: number; mobility: number; display: number; price: number; brand: number };
const DEFAULT_WEIGHTS: Record<Seg, WeightGroups> = {
  GAMING: { performance: 1.3, mobility: 0.7, display: 1.0, price: 1.0, brand: 0.5 },
  ULTRABOOK: { performance: 0.8, mobility: 1.4, display: 1.0, price: 1.0, brand: 0.7 },
  CREATOR: { performance: 1.2, mobility: 0.8, display: 1.3, price: 0.8, brand: 0.6 },
  OFFICE: { performance: 0.8, mobility: 1.0, display: 0.8, price: 1.3, brand: 0.6 },
};
const WEIGHT_GROUP_LABELS: Record<keyof WeightGroups, string> = {
  performance: 'Hiệu năng',
  mobility: 'Di động & pin',
  display: 'Màn hình',
  price: 'Giá / đáng tiền',
  brand: 'Thương hiệu',
};

interface AlertThresholds {
  lowSatisfaction: number;
  fallbackHighPct: number;
  latencyHighMs: number;
  lowConfidenceRatePct: number;
  reviewBacklogCount: number;
}
const DEFAULT_ALERT_THRESHOLDS: AlertThresholds = {
  lowSatisfaction: 0.4,
  fallbackHighPct: 0.05,
  latencyHighMs: 800,
  lowConfidenceRatePct: 0.3,
  reviewBacklogCount: 20,
};

/** Doc 1 khoa KnowledgeConfig, tra ve fallback neu chua tung cau hinh (404) hoac loi mang -
 * man hinh nay LUON hien duoc gia tri (mac dinh khop code) thay vi bao loi ngay lan dau mo. */
async function loadConfig<T>(key: string, fallback: T): Promise<T> {
  try {
    const r = await api.get(`/knowledge/config/${key}`);
    return JSON.parse(r.data.data.valueJson) as T;
  } catch {
    return fallback;
  }
}
async function saveConfig(key: string, value: unknown) {
  await api.put(`/knowledge/config/${key}`, { value });
}

/** FR-13 Cấu hình tri thức (UC-13): 3 nhóm cấu hình quản trị viên sửa được MÀ KHÔNG CẦN deploy
 * lại code — ghim/cấm máy theo phân khúc, các ngưỡng vận hành (tin cậy/số kết quả/nới ngân sách/
 * cảnh báo), và trọng số mặc định từng nhóm đặc trưng theo phân khúc (Mô hình B). Mọi cấu hình
 * lưu trong `KnowledgeConfig` (key-value) và được `recommend.service.ts` / `alertScan.ts` đọc lại
 * ở MỖI LẦN CHẠY (không cache) nên có hiệu lực ngay, không cần khởi động lại backend. */
export function AdminKnowledge() {
  return (
    <div>
      <h2>Cấu hình tri thức</h2>
      <p style={{ color: t.textSecondary }}>
        Các giá trị dưới đây điều khiển trực tiếp thuật toán gợi ý — sửa xong có hiệu lực ngay từ
        lượt tư vấn tiếp theo, không cần khởi động lại hệ thống.
      </p>
      <Tabs
        items={[
          { key: 'pins', label: 'Ghim / Cấm máy', children: <PinsTab /> },
          { key: 'thresholds', label: 'Ngưỡng & mặc định', children: <ThresholdsTab /> },
          { key: 'weights', label: 'Trọng số theo phân khúc', children: <WeightsTab /> },
          { key: 'alerts', label: 'Ngưỡng cảnh báo', children: <AlertsTab /> },
        ]}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
function PinsTab() {
  const [pins, setPins] = useState<Pin[]>([]);
  const [laptops, setLaptops] = useState<LaptopOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [laptopId, setLaptopId] = useState<number | undefined>();
  const [action, setAction] = useState<'PIN' | 'BAN'>('PIN');
  const [segment, setSegment] = useState<Seg | undefined>();
  const [reason, setReason] = useState('');
  const [expiresAt, setExpiresAt] = useState<Dayjs | null>(null);

  function load() {
    setLoading(true);
    Promise.all([api.get('/knowledge/pins'), api.get('/laptops?pageSize=1000')])
      .then(([p, l]) => {
        setPins(p.data.data);
        setLaptops(l.data.data.map((x: any) => ({ id: x.id, name: x.name, sku: x.sku })));
      })
      .catch(() => message.error('Không tải được danh sách ghim/cấm.'))
      .finally(() => setLoading(false));
  }
  useEffect(load, []);

  async function create() {
    if (!laptopId) {
      message.warning('Chọn máy trước đã.');
      return;
    }
    setSaving(true);
    try {
      await api.post('/knowledge/pins', {
        laptopId,
        action,
        segment: segment ?? null,
        reason: reason || undefined,
        expiresAt: expiresAt ? expiresAt.toISOString() : undefined,
      });
      message.success(action === 'PIN' ? 'Đã ghim máy.' : 'Đã cấm máy khỏi gợi ý.');
      setLaptopId(undefined);
      setReason('');
      setExpiresAt(null);
      load();
    } catch (err: any) {
      message.error(err?.response?.data?.error?.message ?? 'Không lưu được.');
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: number) {
    try {
      await api.delete(`/knowledge/pins/${id}`);
      message.success('Đã gỡ.');
      load();
    } catch {
      message.error('Không gỡ được.');
    }
  }

  return (
    <div>
      <Card style={{ marginBottom: 16 }} title="Thêm mới">
        <Space wrap size={12} style={{ marginBottom: 12 }}>
          <Select
            showSearch
            placeholder="Chọn máy..."
            style={{ width: 280 }}
            value={laptopId}
            onChange={setLaptopId}
            optionFilterProp="label"
            options={laptops.map((l) => ({ value: l.id, label: `${l.name} (${l.sku})` }))}
          />
          <Radio.Group value={action} onChange={(e) => setAction(e.target.value)}>
            <Radio.Button value="PIN">📌 Ghim (luôn xuất hiện)</Radio.Button>
            <Radio.Button value="BAN">🚫 Cấm (không bao giờ gợi ý)</Radio.Button>
          </Radio.Group>
          <Select
            allowClear
            placeholder="Áp dụng cho phân khúc (để trống = mọi phân khúc)"
            style={{ width: 260 }}
            value={segment}
            onChange={setSegment}
            options={SEGMENTS.map((s) => ({ value: s, label: segmentColors[s].label }))}
          />
        </Space>
        <Space wrap size={12}>
          <Input
            placeholder="Lý do (vd: đang cần đẩy hàng tồn / lỗi phổ biến bị khách phàn nàn)"
            style={{ width: 360 }}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <DatePicker
            placeholder="Ngày hết hạn (để trống = không hết hạn)"
            value={expiresAt}
            onChange={setExpiresAt}
            disabledDate={(d) => d.isBefore(dayjs(), 'day')}
          />
          <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={create}>
            Lưu
          </Button>
        </Space>
      </Card>

      <Table
        rowKey="id"
        loading={loading}
        dataSource={pins}
        columns={[
          {
            title: 'Loại',
            dataIndex: 'action',
            render: (v: string) => (v === 'PIN' ? <Tag color="gold">📌 Ghim</Tag> : <Tag color="red">🚫 Cấm</Tag>),
          },
          { title: 'Máy', render: (_: unknown, r: Pin) => `${r.laptop.name} (${r.laptop.sku})` },
          { title: 'Giá', render: (_: unknown, r: Pin) => formatVnd(r.laptop.priceVnd) },
          {
            title: 'Phân khúc',
            dataIndex: 'segment',
            render: (v: string | null) => (v ? <Tag color={segmentColors[v]?.color}>{segmentColors[v]?.label}</Tag> : 'Mọi phân khúc'),
          },
          { title: 'Lý do', dataIndex: 'reason', render: (v: string | null) => v ?? '—' },
          {
            title: 'Hết hạn',
            dataIndex: 'expiresAt',
            render: (v: string | null) => (v ? new Date(v).toLocaleDateString('vi-VN') : 'Không hết hạn'),
          },
          {
            title: '',
            render: (_: unknown, r: Pin) => (
              <Popconfirm title="Gỡ mục này?" onConfirm={() => remove(r.id)}>
                <Button danger size="small" icon={<DeleteOutlined />} />
              </Popconfirm>
            ),
          },
        ]}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
function ThresholdsTab() {
  const [confidenceThreshold, setConfidenceThreshold] = useState(0.6);
  const [defaultTopN, setDefaultTopN] = useState(5);
  const [budgetRelaxRatio, setBudgetRelaxRatio] = useState(0.1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      loadConfig('confidence_threshold', 0.6),
      loadConfig('default_top_n', 5),
      loadConfig('budget_relax_ratio', 0.1),
    ])
      .then(([c, n, r]) => {
        setConfidenceThreshold(c);
        setDefaultTopN(n);
        setBudgetRelaxRatio(r);
      })
      .finally(() => setLoading(false));
  }, []);

  async function save() {
    setSaving(true);
    try {
      await Promise.all([
        saveConfig('confidence_threshold', confidenceThreshold),
        saveConfig('default_top_n', defaultTopN),
        saveConfig('budget_relax_ratio', budgetRelaxRatio),
      ]);
      message.success('Đã lưu cấu hình.');
    } catch {
      message.error('Không lưu được.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card loading={loading} style={{ maxWidth: 560 }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontWeight: 600, marginBottom: 4 }}>
          Ngưỡng tin cậy để tự động duyệt nhãn phân khúc: {Math.round(confidenceThreshold * 100)}%
        </div>
        <div style={{ color: t.textSecondary, fontSize: 13, marginBottom: 8 }}>
          Máy mới với độ tin cậy AI dưới ngưỡng này sẽ vào hàng đợi "Cần xác minh" thay vì tự động
          dùng ngay.
        </div>
        <Slider min={0.3} max={0.95} step={0.05} value={confidenceThreshold} onChange={setConfidenceThreshold} />
      </div>

      <div style={{ marginBottom: 20 }}>
        <div style={{ fontWeight: 600, marginBottom: 4 }}>Số kết quả mặc định</div>
        <div style={{ color: t.textSecondary, fontSize: 13, marginBottom: 8 }}>
          Áp dụng khi khách hàng chưa tự chọn số lượng hiển thị trong Kết quả gợi ý.
        </div>
        <InputNumber min={3} max={10} value={defaultTopN} onChange={(v) => setDefaultTopN(v ?? 5)} />
      </div>

      <div style={{ marginBottom: 20 }}>
        <div style={{ fontWeight: 600, marginBottom: 4 }}>
          Tỷ lệ nới ngân sách: {Math.round(budgetRelaxRatio * 100)}%
        </div>
        <div style={{ color: t.textSecondary, fontSize: 13, marginBottom: 8 }}>
          Khi lọc theo ngân sách ra quá ít máy, hệ thống tự nới thêm % này để vẫn có đủ máy xếp
          hạng, thay vì trả về danh sách rỗng.
        </div>
        <Slider min={0} max={0.3} step={0.05} value={budgetRelaxRatio} onChange={setBudgetRelaxRatio} />
      </div>

      <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={save}>
        Lưu cấu hình
      </Button>
    </Card>
  );
}

// ---------------------------------------------------------------------------------------------
function WeightsTab() {
  const [weights, setWeights] = useState<Record<Seg, WeightGroups>>(DEFAULT_WEIGHTS);
  const [segment, setSegment] = useState<Seg>('GAMING');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadConfig<Record<Seg, WeightGroups>>('default_weights', DEFAULT_WEIGHTS)
      .then((v) => setWeights({ ...DEFAULT_WEIGHTS, ...v }))
      .finally(() => setLoading(false));
  }, []);

  async function save() {
    setSaving(true);
    try {
      await saveConfig('default_weights', weights);
      message.success('Đã lưu — áp dụng ngay cho lượt tư vấn tiếp theo.');
    } catch {
      message.error('Không lưu được.');
    } finally {
      setSaving(false);
    }
  }

  function resetSegment() {
    setWeights((prev) => ({ ...prev, [segment]: DEFAULT_WEIGHTS[segment] }));
  }

  const current = weights[segment];

  return (
    <Card loading={loading} style={{ maxWidth: 560 }}>
      <Alert
        style={{ marginBottom: 16 }}
        type="info"
        showIcon
        message="Trọng số 'nền' của mỗi nhóm đặc trưng theo phân khúc — càng cao, nhóm đó càng ảnh hưởng
          nhiều đến thứ hạng gợi ý cho phân khúc này, kể cả khi khách hàng đặt mức ưu tiên như
          nhau. Ví dụ Gaming mặc định coi hiệu năng nặng ký hơn Văn phòng."
      />
      <Radio.Group value={segment} onChange={(e) => setSegment(e.target.value)} style={{ marginBottom: 20 }}>
        {SEGMENTS.map((s) => (
          <Radio.Button key={s} value={s}>
            {segmentColors[s].label}
          </Radio.Button>
        ))}
      </Radio.Group>

      {(Object.keys(WEIGHT_GROUP_LABELS) as (keyof WeightGroups)[]).map((g) => (
        <div key={g} style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>{WEIGHT_GROUP_LABELS[g]}</span>
            <span className="tabular-nums" style={{ fontWeight: 600 }}>
              {current[g].toFixed(2)}
            </span>
          </div>
          <Slider
            min={0.1}
            max={2}
            step={0.05}
            value={current[g]}
            onChange={(v) => setWeights((prev) => ({ ...prev, [segment]: { ...prev[segment], [g]: v } }))}
          />
        </div>
      ))}

      <Space>
        <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={save}>
          Lưu tất cả phân khúc
        </Button>
        <Button onClick={resetSegment}>Khôi phục mặc định (phân khúc này)</Button>
      </Space>
    </Card>
  );
}

// ---------------------------------------------------------------------------------------------
function AlertsTab() {
  const [th, setTh] = useState<AlertThresholds>(DEFAULT_ALERT_THRESHOLDS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadConfig<AlertThresholds>('alert_thresholds', DEFAULT_ALERT_THRESHOLDS)
      .then((v) => setTh({ ...DEFAULT_ALERT_THRESHOLDS, ...v }))
      .finally(() => setLoading(false));
  }, []);

  async function save() {
    setSaving(true);
    try {
      await saveConfig('alert_thresholds', th);
      message.success('Đã lưu — áp dụng từ lần quét cảnh báo tiếp theo (mỗi giờ, hoặc bấm "Quét ngay" ở Dashboard).');
    } catch {
      message.error('Không lưu được.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card loading={loading} style={{ maxWidth: 560 }}>
      <p style={{ color: t.textSecondary }}>
        Ngưỡng dùng bởi tác vụ quét cảnh báo định kỳ (docs/09 §6) — xem cảnh báo đang có tại màn
        Dashboard.
      </p>
      <div style={{ marginBottom: 16 }}>
        <div>Tỷ lệ hài lòng tối thiểu (7 ngày, cần ≥ 30 phiên)</div>
        <InputNumber
          addonAfter="%"
          min={0}
          max={100}
          value={Math.round(th.lowSatisfaction * 100)}
          onChange={(v) => setTh({ ...th, lowSatisfaction: (v ?? 40) / 100 })}
        />
      </div>
      <div style={{ marginBottom: 16 }}>
        <div>Tỷ lệ dự phòng tối đa (24 giờ)</div>
        <InputNumber
          addonAfter="%"
          min={0}
          max={100}
          value={Math.round(th.fallbackHighPct * 100)}
          onChange={(v) => setTh({ ...th, fallbackHighPct: (v ?? 5) / 100 })}
        />
      </div>
      <div style={{ marginBottom: 16 }}>
        <div>Độ trễ p95 tối đa (7 ngày)</div>
        <InputNumber addonAfter="ms" min={100} max={5000} value={th.latencyHighMs} onChange={(v) => setTh({ ...th, latencyHighMs: v ?? 800 })} />
      </div>
      <div style={{ marginBottom: 16 }}>
        <div>Tỷ lệ máy mới (30 ngày) có độ tin cậy thấp — tối đa</div>
        <InputNumber
          addonAfter="%"
          min={0}
          max={100}
          value={Math.round(th.lowConfidenceRatePct * 100)}
          onChange={(v) => setTh({ ...th, lowConfidenceRatePct: (v ?? 30) / 100 })}
        />
      </div>
      <div style={{ marginBottom: 20 }}>
        <div>Số nhãn chờ duyệt tối đa</div>
        <InputNumber min={1} max={200} value={th.reviewBacklogCount} onChange={(v) => setTh({ ...th, reviewBacklogCount: v ?? 20 })} />
      </div>
      <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={save}>
        Lưu ngưỡng cảnh báo
      </Button>
    </Card>
  );
}
