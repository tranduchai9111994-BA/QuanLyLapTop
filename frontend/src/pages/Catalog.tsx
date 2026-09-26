import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Empty, Pagination, Select, Skeleton, Space } from 'antd';
import { api } from '../lib/api';
import type { Laptop, Segment } from '../types';
import { SegmentTag } from '../components/smart/SegmentTag';
import { formatVnd, formatKg } from '../utils/format';
import { t } from '../theme/tokens';

const SEGMENT_OPTIONS: { label: string; value: Segment }[] = [
  { label: 'Văn phòng – Học tập', value: 'OFFICE' },
  { label: 'Mỏng nhẹ – Di động', value: 'ULTRABOOK' },
  { label: 'Gaming', value: 'GAMING' },
  { label: 'Đồ họa – Kỹ thuật', value: 'CREATOR' },
];

const SORT_OPTIONS = [
  { label: 'Giá tăng dần', value: 'price_asc' },
  { label: 'Giá giảm dần', value: 'price_desc' },
  { label: 'Hiệu năng cao nhất', value: 'perf_desc' },
  { label: 'Đáng tiền nhất', value: 'value_desc' },
];

export function Catalog() {
  const navigate = useNavigate();
  const [segment, setSegment] = useState<Segment | undefined>(undefined);
  const [sort, setSort] = useState('price_asc');
  const [page, setPage] = useState(1);
  const pageSize = 12;

  const [items, setItems] = useState<Laptop[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api
      .get('/laptops', { params: { segment, sort, page, pageSize } })
      .then((r) => {
        setItems(r.data.data);
        setTotal(r.data.meta?.total ?? 0);
      })
      .finally(() => setLoading(false));
  }, [segment, sort, page]);

  return (
    <div style={{ maxWidth: 1100, margin: '32px auto', padding: '0 16px' }}>
      <h1>Danh mục laptop</h1>

      <Space style={{ marginBottom: 20 }} wrap>
        <Select
          style={{ width: 220 }}
          placeholder="Tất cả phân khúc"
          allowClear
          value={segment}
          options={SEGMENT_OPTIONS}
          onChange={(v) => {
            setSegment(v);
            setPage(1);
          }}
        />
        <Select
          style={{ width: 200 }}
          value={sort}
          options={SORT_OPTIONS}
          onChange={(v) => {
            setSort(v);
            setPage(1);
          }}
        />
      </Space>

      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <Skeleton active />
            </Card>
          ))}
        </div>
      ) : items.length === 0 ? (
        <Empty description="Chưa có máy nào khớp bộ lọc. Thử chọn phân khúc khác." />
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 }}>
            {items.map((l) => (
              <Card key={l.id} hoverable onClick={() => navigate(`/laptop/${l.id}`)}>
                <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                  {l.segmentLabel && <SegmentTag segment={l.segmentLabel.segment} />}
                </div>
                <h3 style={{ margin: '4px 0' }}>{l.name}</h3>
                <div style={{ fontSize: 20, fontWeight: 700, color: t.primary700 }} className="tabular-nums">
                  {formatVnd(l.priceVnd)}
                </div>
                <div style={{ color: t.textSecondary, fontSize: 13 }}>
                  {l.cpu.displayName} · {l.gpu.displayName} · {l.ramGb}GB · {l.ssdGb}GB · {formatKg(l.weightKg)}
                </div>
              </Card>
            ))}
          </div>
          <div style={{ textAlign: 'center', marginTop: 24 }}>
            <Pagination current={page} pageSize={pageSize} total={total} onChange={setPage} showSizeChanger={false} />
          </div>
        </>
      )}
    </div>
  );
}
