import { useState } from 'react';
import { Button, Card, Checkbox, InputNumber, Radio, Select, Spin, Tag, message } from 'antd';
import {
  ThunderboltOutlined,
  RocketOutlined,
  DesktopOutlined,
  DollarOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { PrioritySlider } from '../components/smart/PrioritySlider';
import { NeedTextInput, type ParsedNeed } from '../components/smart/NeedTextInput';
import { api } from '../lib/api';
import type { Priorities, RecommendationResult } from '../types';
import { formatVnd } from '../utils/format';
import { t } from '../theme/tokens';

const ACTIVITY_OPTIONS = [
  { value: 'van_phong', label: 'Văn phòng / soạn thảo' },
  { value: 'hoc_tap', label: 'Học tập' },
  { value: 'lap_trinh', label: 'Lập trình' },
  { value: 'choi_game', label: 'Chơi game' },
  { value: 'do_hoa', label: 'Đồ họa / thiết kế' },
  { value: 'dung_video', label: 'Dựng video' },
  { value: 'di_chuyen_nhieu', label: 'Di chuyển nhiều' },
  { value: 'xem_phim', label: 'Xem phim / giải trí' },
];

export function Wizard() {
  const navigate = useNavigate();
  const [segmentChoice, setSegmentChoice] = useState<'unknown' | 'OFFICE' | 'ULTRABOOK' | 'GAMING' | 'CREATOR'>(
    'unknown'
  );
  const [activities, setActivities] = useState<string[]>([]);
  const [budget, setBudget] = useState<[number, number]>([15_000_000, 25_000_000]);
  const [ramMin, setRamMin] = useState<number | null>(null);
  const [priorities, setPriorities] = useState<Priorities>({ performance: 3, mobility: 3, display: 3, price: 3 });
  const [loading, setLoading] = useState(false);
  // Ket qua doc cau tu do (Mo hinh C) - dung de gui kem telemetry va truyen trong so thuong hieu
  const [parsedNeed, setParsedNeed] = useState<{ need: ParsedNeed; text: string } | null>(null);

  /** Khi Mo hinh C doc xong cau noi: dien san moi lua chon ben duoi. Nguoi dung van sua duoc -
   * he thong goi y chu khong ep (nguyen tac "ton trong quyet dinh nguoi dung", docs/07 SS1). */
  function applyParsedNeed(need: ParsedNeed, text: string) {
    setParsedNeed({ need, text });
    setPriorities(need.priorities);
    setBudget([need.budget.min, need.budget.max]);
    setActivities(need.activities);
    if (need.must.ramMin) setRamMin(need.must.ramMin);
  }

  async function handleSubmit() {
    setLoading(true);
    try {
      const r = await api.post<{ success: boolean; data: RecommendationResult }>('/recommendations', {
        segment: segmentChoice === 'unknown' ? null : segmentChoice,
        activities,
        budget: { min: budget[0], max: budget[1] },
        priorities,
        must: ramMin ? { ramMin } : {},
        topN: 5,
        brandWeight: parsedNeed?.need.brandWeight ?? 1,
        needText: parsedNeed?.text,
        needLabel: parsedNeed?.need.label,
      });
      navigate('/results', { state: { result: r.data.data } });
    } catch (err) {
      message.error('Không kết nối được máy chủ. Kiểm tra mạng và thử lại.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 1240, margin: '24px auto', padding: '0 24px' }}>
      <h1>Cho chúng tôi biết nhu cầu của bạn</h1>

      <NeedTextInput onParsed={applyParsedNeed} />

      {/* Bo cuc 2 COT tren man rong: form ben trai, tom tat lua chon ben phai -
          truoc day form chi rong 640px nen man 1920px trong hai ben rat nhieu. */}
      <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 560px', minWidth: 320 }}>

      <div style={{ textAlign: 'center', color: '#64748B', marginBottom: 20 }}>
        — hoặc chọn thủ công bên dưới —
      </div>

      <h3>Bạn dùng laptop để làm gì?</h3>
      <Checkbox.Group
        options={ACTIVITY_OPTIONS}
        value={activities}
        onChange={(v) => setActivities(v as string[])}
        style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 24 }}
      />

      <h3>Bạn đã biết mình cần dòng máy nào chưa?</h3>
      <Radio.Group
        value={segmentChoice}
        onChange={(e) => setSegmentChoice(e.target.value)}
        style={{ marginBottom: 24 }}
      >
        <Radio.Button value="unknown">Chưa rõ, để AI gợi ý</Radio.Button>
        <Radio.Button value="OFFICE">Văn phòng</Radio.Button>
        <Radio.Button value="ULTRABOOK">Mỏng nhẹ</Radio.Button>
        <Radio.Button value="GAMING">Gaming</Radio.Button>
        <Radio.Button value="CREATOR">Đồ họa</Radio.Button>
      </Radio.Group>

      <h3>Ngân sách (VND)</h3>
      <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
        <InputNumber
          style={{ width: '100%' }}
          min={5_000_000}
          step={1_000_000}
          value={budget[0]}
          formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}
          onChange={(v) => setBudget([Number(v ?? 0), budget[1]])}
        />
        <span style={{ alignSelf: 'center' }}>đến</span>
        <InputNumber
          style={{ width: '100%' }}
          min={5_000_000}
          step={1_000_000}
          value={budget[1]}
          formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}
          onChange={(v) => setBudget([budget[0], Number(v ?? 0)])}
        />
      </div>

      <h3>RAM tối thiểu (không bắt buộc)</h3>
      <Select
        allowClear
        style={{ width: '100%', marginBottom: 24 }}
        placeholder="Không yêu cầu"
        value={ramMin ?? undefined}
        onChange={(v) => setRamMin(v ?? null)}
        options={[8, 16, 32].map((v) => ({ value: v, label: `${v} GB trở lên` }))}
      />

      <h3>Mức độ ưu tiên</h3>
      <PrioritySlider
        icon={<ThunderboltOutlined />}
        label="Hiệu năng"
        value={priorities.performance}
        onChange={(v) => setPriorities({ ...priorities, performance: v })}
      />
      <PrioritySlider
        icon={<RocketOutlined />}
        label="Di động & pin"
        value={priorities.mobility}
        onChange={(v) => setPriorities({ ...priorities, mobility: v })}
      />
      <PrioritySlider
        icon={<DesktopOutlined />}
        label="Màn hình"
        value={priorities.display}
        onChange={(v) => setPriorities({ ...priorities, display: v })}
      />
      <PrioritySlider
        icon={<DollarOutlined />}
        label="Tiết kiệm chi phí"
        value={priorities.price}
        onChange={(v) => setPriorities({ ...priorities, price: v })}
      />

      <Button type="primary" size="large" block onClick={handleSubmit} disabled={loading}>
            {loading ? <Spin size="small" /> : 'Xem kết quả'}
          </Button>
        </div>

        {/* Panel tom tat: nguoi dung thay ngay he thong dang hieu gi ve minh */}
        <Card
          title="Tóm tắt lựa chọn của bạn"
          style={{ flex: '0 1 340px', minWidth: 280, position: 'sticky', top: 24 }}
          styles={{ body: { padding: 16 } }}
        >
          {parsedNeed && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 13, color: t.textSecondary }}>Nhóm nhu cầu (AI nhận diện)</div>
              <Tag color="blue">{parsedNeed.need.labelText}</Tag>
            </div>
          )}

          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 13, color: t.textSecondary }}>Ngân sách</div>
            <div style={{ fontWeight: 600 }}>
              {formatVnd(budget[0])} – {formatVnd(budget[1])}
            </div>
          </div>

          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 13, color: t.textSecondary, marginBottom: 4 }}>Nhu cầu sử dụng</div>
            {activities.length === 0 ? (
              <span style={{ color: t.textTertiary }}>Chưa chọn</span>
            ) : (
              activities.map((a) => (
                <Tag key={a}>{ACTIVITY_OPTIONS.find((o) => o.value === a)?.label ?? a}</Tag>
              ))
            )}
          </div>

          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 13, color: t.textSecondary, marginBottom: 4 }}>Mức ưu tiên</div>
            {[
              ['Hiệu năng', priorities.performance],
              ['Di động & pin', priorities.mobility],
              ['Màn hình', priorities.display],
              ['Tiết kiệm chi phí', priorities.price],
            ].map(([label, val]) => (
              <div key={label as string} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span>{label}</span>
                <span style={{ fontWeight: 600, color: t.primary700 }}>{val}/5</span>
              </div>
            ))}
          </div>

          {ramMin && (
            <div>
              <div style={{ fontSize: 13, color: t.textSecondary }}>Bắt buộc</div>
              <Tag color="orange">RAM ≥ {ramMin} GB</Tag>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
