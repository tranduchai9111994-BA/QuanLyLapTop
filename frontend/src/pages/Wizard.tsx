import { useState } from 'react';
import { Button, Checkbox, InputNumber, Radio, Select, Spin, message } from 'antd';
import {
  ThunderboltOutlined,
  RocketOutlined,
  DesktopOutlined,
  DollarOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { PrioritySlider } from '../components/smart/PrioritySlider';
import { api } from '../lib/api';
import type { Priorities, RecommendationResult } from '../types';

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
      });
      navigate('/results', { state: { result: r.data.data } });
    } catch (err) {
      message.error('Không kết nối được máy chủ. Kiểm tra mạng và thử lại.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 640, margin: '40px auto', padding: '0 16px' }}>
      <h1>Cho chúng tôi biết nhu cầu của bạn</h1>

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
  );
}
