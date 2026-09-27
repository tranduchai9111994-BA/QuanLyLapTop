import { useEffect, useState } from 'react';
import { Alert, Button, Card, Checkbox, Radio, Select, Slider, Space, Spin, Tag, message } from 'antd';
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
import type { Priorities, RecommendationResult, Segment } from '../types';
import { formatVnd, formatShortVnd } from '../utils/format';
import { segmentColors, t } from '../theme/tokens';

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

// FR-01: nut chon nhanh ngan sach - gioi han theo tung khoang, don gian hoa cho nguoi
// khong quen keo thanh truot chinh xac den tung trieu.
const BUDGET_PRESETS: { label: string; range: [number, number] }[] = [
  { label: 'Dưới 15 tr', range: [8_000_000, 15_000_000] },
  { label: '15–25 tr', range: [15_000_000, 25_000_000] },
  { label: '25–40 tr', range: [25_000_000, 40_000_000] },
  { label: 'Trên 40 tr', range: [40_000_000, 80_000_000] },
];

const BUDGET_MIN = 8_000_000;
const BUDGET_MAX = 80_000_000;
const BUDGET_STEP = 500_000;

interface InferResult {
  segment: Segment;
  confidence: number;
  distribution: Record<string, number>;
}

export function Wizard() {
  const navigate = useNavigate();
  const [segmentChoice, setSegmentChoice] = useState<'unknown' | Segment>('unknown');
  const [activities, setActivities] = useState<string[]>([]);
  const [budget, setBudget] = useState<[number, number]>([15_000_000, 25_000_000]);
  const [ramMin, setRamMin] = useState<number | null>(null);
  const [ssdMin, setSsdMin] = useState<number | null>(null);
  const [weightMax, setWeightMax] = useState<number | null>(null);
  const [brandIds, setBrandIds] = useState<number[]>([]);
  const [brands, setBrands] = useState<{ id: number; name: string }[]>([]);
  const [priorities, setPriorities] = useState<Priorities>({ performance: 3, mobility: 3, display: 3, price: 3 });
  const [loading, setLoading] = useState(false);
  // Ket qua doc cau tu do (Mo hinh C) - dung de gui kem telemetry va truyen trong so thuong hieu
  const [parsedNeed, setParsedNeed] = useState<{ need: ParsedNeed; text: string } | null>(null);
  // FR-01: Mo hinh A suy phan khuc tu cac HOAT DONG da chon (doc lap voi phan khuc nguoi dung
  // tu chon o o Radio ben duoi) - dung de (a) hien "gan voi Gaming (72%)" khi chon "Chua ro",
  // (b) goi y nhe khi nguoi dung tu chon 1 phan khuc KHAC voi du doan nay.
  const [inferred, setInferred] = useState<InferResult | null>(null);

  useEffect(() => {
    api.get('/brands').then((r) => setBrands(r.data.data)).catch(() => undefined);
  }, []);

  // Goi lai moi khi danh sach hoat dong doi - danh sach rong thi khong suy duoc gi (bo qua).
  useEffect(() => {
    if (activities.length === 0) {
      setInferred(null);
      return;
    }
    let cancelled = false;
    api
      .post('/recommendations/infer-segment', { activities })
      .then((r) => {
        if (!cancelled) setInferred(r.data.data);
      })
      .catch(() => {
        if (!cancelled) setInferred(null);
      });
    return () => {
      cancelled = true;
    };
  }, [activities]);

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
    // Luu lai NGUYEN VAN phan than request (khong chi ket qua) - Results.tsx can goi lai dung
    // request nay voi topN khac khi nguoi dung doi "So luong ket qua" (FR-02), khong bat nguoi
    // dung phai quay lai Wizard dien lai tu dau.
    const requestBody = {
      segment: segmentChoice === 'unknown' ? null : segmentChoice,
      activities,
      budget: { min: budget[0], max: budget[1] },
      priorities,
      must: {
        ...(ramMin ? { ramMin } : {}),
        ...(ssdMin ? { ssdMin } : {}),
        ...(weightMax ? { weightMax } : {}),
        ...(brandIds.length ? { brandIds } : {}),
      },
      topN: 5,
      brandWeight: parsedNeed?.need.brandWeight ?? 1,
      needText: parsedNeed?.text,
      needLabel: parsedNeed?.need.label,
    };
    try {
      const r = await api.post<{ success: boolean; data: RecommendationResult }>('/recommendations', requestBody);
      navigate('/results', { state: { result: r.data.data, requestBody } });
    } catch {
      message.error('Không kết nối được máy chủ. Kiểm tra mạng và thử lại.');
    } finally {
      setLoading(false);
    }
  }

  // FR-01: goi y nhe khi nguoi dung TU chon 1 phan khuc ro rang nhung khac voi du doan tu hoat
  // dong, VA du doan do du tin cay (>= 60%) - chi hien khi CA HAI dieu kien dung, khong ep buoc.
  const showNudge =
    segmentChoice !== 'unknown' &&
    inferred &&
    inferred.segment !== segmentChoice &&
    inferred.confidence >= 0.6;

  return (
    <div style={{ maxWidth: 1200, margin: '24px auto', padding: '0 24px' }}>
      <h1>Cho chúng tôi biết nhu cầu của bạn</h1>

      <NeedTextInput onParsed={applyParsedNeed} />

      {/* Bo cuc 2 COT tren man rong: form ben trai, tom tat lua chon ben phai -
          truoc day form chi rong 640px nen man 1920px trong hai ben rat nhieu. */}
      <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 560px', minWidth: 320 }}>

      <div style={{ textAlign: 'center', color: t.textTertiary, marginBottom: 20 }}>
        — hoặc chọn thủ công bên dưới —
      </div>

      <h3>Bạn dùng laptop để làm gì?</h3>
      <Checkbox.Group
        options={ACTIVITY_OPTIONS}
        value={activities}
        onChange={(v) => setActivities(v as string[])}
        style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}
      />

      {/* FR-01: "Nhu cau cua ban gan voi Gaming (72%)" - CHI hien khi nguoi dung chua tu chon
          phan khuc (dang de AI goi y), tranh trung lap voi goi y nhe ben duoi. */}
      {segmentChoice === 'unknown' && inferred && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 24 }}
          message={
            <>
              Nhu cầu của bạn gần với{' '}
              <strong>{segmentColors[inferred.segment]?.label ?? inferred.segment}</strong> (độ tin
              cậy {Math.round(inferred.confidence * 100)}%)
            </>
          }
        />
      )}
      {segmentChoice === 'unknown' && !inferred && <div style={{ marginBottom: 24 }} />}

      <h3>Bạn đã biết mình cần dòng máy nào chưa?</h3>
      <Radio.Group
        value={segmentChoice}
        onChange={(e) => setSegmentChoice(e.target.value)}
        style={{ marginBottom: 8 }}
      >
        <Radio.Button value="unknown">Chưa rõ, để AI gợi ý</Radio.Button>
        <Radio.Button value="OFFICE">Văn phòng</Radio.Button>
        <Radio.Button value="ULTRABOOK">Mỏng nhẹ</Radio.Button>
        <Radio.Button value="GAMING">Gaming</Radio.Button>
        <Radio.Button value="CREATOR">Đồ họa</Radio.Button>
      </Radio.Group>

      {/* FR-01: goi y nhe khi phan khuc tu chon khac voi du doan tu hoat dong - KHONG EP, chi
          de 1 nut nho cho doi neu nguoi dung muon. */}
      {showNudge && inferred && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 24 }}
          message={
            <span>
              Với hoạt động bạn chọn, phân khúc{' '}
              <strong>{segmentColors[inferred.segment]?.label ?? inferred.segment}</strong> có thể
              hợp hơn (độ tin cậy {Math.round(inferred.confidence * 100)}%).{' '}
              <Button size="small" onClick={() => setSegmentChoice(inferred.segment)}>
                Xem thử
              </Button>
            </span>
          }
        />
      )}
      {!showNudge && <div style={{ marginBottom: 24 }} />}

      <h3>
        Ngân sách: {formatShortVnd(budget[0])} – {formatShortVnd(budget[1])}
      </h3>
      <Slider
        range
        min={BUDGET_MIN}
        max={BUDGET_MAX}
        step={BUDGET_STEP}
        value={budget}
        tooltip={{ formatter: (v) => formatShortVnd(v) }}
        onChange={(v) => setBudget(v as [number, number])}
        style={{ marginBottom: 4 }}
      />
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 24 }}>
        {BUDGET_PRESETS.map((p) => (
          <Tag
            key={p.label}
            style={{ cursor: 'pointer' }}
            color={budget[0] === p.range[0] && budget[1] === p.range[1] ? 'blue' : undefined}
            onClick={() => setBudget(p.range)}
          >
            {p.label}
          </Tag>
        ))}
      </div>

      <h3>Yêu cầu bắt buộc (không bắt buộc phải điền)</h3>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
        <div>
          <div style={{ fontSize: 13, color: t.textSecondary, marginBottom: 4 }}>RAM tối thiểu</div>
          <Select
            allowClear
            style={{ width: '100%' }}
            placeholder="Không yêu cầu"
            value={ramMin ?? undefined}
            onChange={(v) => setRamMin(v ?? null)}
            options={[8, 16, 32].map((v) => ({ value: v, label: `${v} GB trở lên` }))}
          />
        </div>
        <div>
          <div style={{ fontSize: 13, color: t.textSecondary, marginBottom: 4 }}>SSD tối thiểu</div>
          <Select
            allowClear
            style={{ width: '100%' }}
            placeholder="Không yêu cầu"
            value={ssdMin ?? undefined}
            onChange={(v) => setSsdMin(v ?? null)}
            options={[256, 512, 1024].map((v) => ({ value: v, label: `${v} GB trở lên` }))}
          />
        </div>
        <div>
          <div style={{ fontSize: 13, color: t.textSecondary, marginBottom: 4 }}>Trọng lượng tối đa</div>
          <Select
            allowClear
            style={{ width: '100%' }}
            placeholder="Không yêu cầu"
            value={weightMax ?? undefined}
            onChange={(v) => setWeightMax(v ?? null)}
            options={[1.5, 2, 2.5, 3].map((v) => ({ value: v, label: `${v} kg trở xuống` }))}
          />
        </div>
        <div>
          <div style={{ fontSize: 13, color: t.textSecondary, marginBottom: 4 }}>Hãng ưa thích</div>
          <Select
            allowClear
            mode="multiple"
            maxTagCount="responsive"
            style={{ width: '100%' }}
            placeholder="Tất cả hãng"
            value={brandIds}
            onChange={setBrandIds}
            options={brands.map((b) => ({ label: b.name, value: b.id }))}
          />
        </div>
      </div>

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

          {(ramMin || ssdMin || weightMax || brandIds.length > 0) && (
            <div>
              <div style={{ fontSize: 13, color: t.textSecondary, marginBottom: 4 }}>Bắt buộc</div>
              <Space size={[4, 4]} wrap>
                {ramMin && <Tag color="orange">RAM ≥ {ramMin} GB</Tag>}
                {ssdMin && <Tag color="orange">SSD ≥ {ssdMin} GB</Tag>}
                {weightMax && <Tag color="orange">≤ {weightMax} kg</Tag>}
                {brandIds.length > 0 && (
                  <Tag color="orange">
                    {brandIds.length} hãng: {brandIds.map((id) => brands.find((b) => b.id === id)?.name).filter(Boolean).join(', ')}
                  </Tag>
                )}
              </Space>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
