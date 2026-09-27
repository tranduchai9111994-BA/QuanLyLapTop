import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, Checkbox, Empty, Input, Pagination, Segmented, Select, Skeleton, Slider, Space, Tag } from 'antd';
import { api } from '../lib/api';
import type { Laptop, Segment } from '../types';
import { SegmentTag } from '../components/smart/SegmentTag';
import { LaptopThumbnail } from '../components/smart/LaptopThumbnail';
import { DiscountBadge } from '../components/smart/DiscountBadge';
import { formatVnd, formatKg, formatShortVnd } from '../utils/format';
import { t } from '../theme/tokens';

const SEGMENTS: { label: string; value: Segment }[] = [
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

const ALL = 'Tất cả';

export function Catalog() {
  const navigate = useNavigate();
  const [segment, setSegment] = useState<Segment | undefined>(undefined);
  const [sort, setSort] = useState('price_asc');
  const [page, setPage] = useState(1);
  const pageSize = 12;

  const [items, setItems] = useState<Laptop[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [counts, setCounts] = useState<Record<string, number>>({});

  // BO LOC da dieu kien (ket hop duoc nhieu dieu kien cung luc). Luu y phan biet voi "Sap xep":
  // sap xep la DON TRI (khong the vua sap gia tang vua sap hieu nang giam), con LOC thi cong don.
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 80]); // trieu VND
  const [ramMin, setRamMin] = useState<number | undefined>();
  const [brandIds, setBrandIds] = useState<number[]>([]);
  const [onlyDedicatedGpu, setOnlyDedicatedGpu] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [brands, setBrands] = useState<{ id: number; name: string }[]>([]);

  // Dem so luong tung phan khuc 1 lan de hien "Gaming (85)" tren tab - giup thay ngay
  // he thong co du 4 loai, khong chi Van phong/Hoc tap (phan hoi UX da nhan duoc).
  useEffect(() => {
    api.get('/brands').then((r) => setBrands(r.data.data)).catch(() => undefined);
  }, []);

  useEffect(() => {
    Promise.all(
      SEGMENTS.map((s) => api.get('/laptops', { params: { segment: s.value, pageSize: 1 } }))
    ).then((results) => {
      const next: Record<string, number> = {};
      results.forEach((r, i) => {
        next[SEGMENTS[i].value] = r.data.meta?.total ?? 0;
      });
      setCounts(next);
    });
  }, []);

  useEffect(() => {
    setLoading(true);
    api
      .get('/laptops', {
        params: {
          segment,
          sort,
          page,
          pageSize,
          priceMin: priceRange[0] > 0 ? priceRange[0] * 1_000_000 : undefined,
          priceMax: priceRange[1] < 80 ? priceRange[1] * 1_000_000 : undefined,
          ramMin,
          brandIds: brandIds.length ? brandIds.join(',') : undefined,
          q: keyword.trim() || undefined,
        },
      })
      .then((r) => {
        const data = onlyDedicatedGpu
          ? r.data.data.filter((l: Laptop) => l.gpu?.dedicated)
          : r.data.data;
        setItems(data);
        setTotal(r.data.meta?.total ?? 0);
      })
      .finally(() => setLoading(false));
  }, [segment, sort, page, priceRange, ramMin, brandIds, keyword, onlyDedicatedGpu]);

  function resetFilters() {
    setPriceRange([0, 80]);
    setRamMin(undefined);
    setBrandIds([]);
    setOnlyDedicatedGpu(false);
    setKeyword('');
    setPage(1);
  }

  const hasFilter =
    priceRange[0] > 0 || priceRange[1] < 80 || !!ramMin || brandIds.length > 0 || onlyDedicatedGpu || !!keyword;

  const totalAll = Object.values(counts).reduce((a, b) => a + b, 0);
  const segmentedOptions = [
    { label: `${ALL} (${totalAll})`, value: ALL },
    ...SEGMENTS.map((s) => ({ label: `${s.label} (${counts[s.value] ?? 0})`, value: s.value })),
  ];

  return (
    <div style={{ maxWidth: 1400, margin: '24px auto', padding: '0 24px' }}>
      <h1>Danh mục laptop</h1>

      <div style={{ marginBottom: 12, overflowX: 'auto' }}>
        <Segmented
          size="large"
          value={segment ?? ALL}
          options={segmentedOptions}
          onChange={(v) => {
            setSegment(v === ALL ? undefined : (v as Segment));
            setPage(1);
          }}
        />
      </div>
      <Card size="small" style={{ marginBottom: 20 }} styles={{ body: { padding: 16 } }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 16,
            alignItems: 'start',
          }}
        >
          <div>
            <div style={{ fontSize: 13, color: t.textSecondary, marginBottom: 4 }}>Sắp xếp theo</div>
            <Select
              style={{ width: '100%' }}
              value={sort}
              options={SORT_OPTIONS}
              onChange={(v) => {
                setSort(v);
                setPage(1);
              }}
            />
          </div>

          <div>
            <div style={{ fontSize: 13, color: t.textSecondary, marginBottom: 4 }}>
              Khoảng giá: {formatShortVnd(priceRange[0] * 1_000_000)} – {formatShortVnd(priceRange[1] * 1_000_000)}
            </div>
            <Slider
              range
              min={0}
              max={80}
              step={1}
              value={priceRange}
              onChange={(v) => {
                setPriceRange(v as [number, number]);
                setPage(1);
              }}
            />
          </div>

          <div>
            <div style={{ fontSize: 13, color: t.textSecondary, marginBottom: 4 }}>RAM tối thiểu</div>
            <Select
              allowClear
              style={{ width: '100%' }}
              placeholder="Không yêu cầu"
              value={ramMin}
              onChange={(v) => {
                setRamMin(v);
                setPage(1);
              }}
              options={[8, 16, 32, 64].map((v) => ({ label: `${v} GB trở lên`, value: v }))}
            />
          </div>

          <div>
            <div style={{ fontSize: 13, color: t.textSecondary, marginBottom: 4 }}>Hãng (chọn nhiều)</div>
            <Select
              mode="multiple"
              allowClear
              maxTagCount="responsive"
              style={{ width: '100%' }}
              placeholder="Tất cả hãng"
              value={brandIds}
              onChange={(v) => {
                setBrandIds(v);
                setPage(1);
              }}
              options={brands.map((b) => ({ label: b.name, value: b.id }))}
            />
          </div>

          <div>
            <div style={{ fontSize: 13, color: t.textSecondary, marginBottom: 4 }}>Tìm theo tên</div>
            <Input
              allowClear
              placeholder="Ví dụ: Legion, ThinkPad..."
              value={keyword}
              onChange={(e) => {
                setKeyword(e.target.value);
                setPage(1);
              }}
            />
          </div>

          <div style={{ paddingTop: 20 }}>
            <Space direction="vertical">
              <Checkbox
                checked={onlyDedicatedGpu}
                onChange={(e) => {
                  setOnlyDedicatedGpu(e.target.checked);
                  setPage(1);
                }}
              >
                Chỉ máy có card rời
              </Checkbox>
              {hasFilter && (
                <Button size="small" onClick={resetFilters}>
                  Xóa bộ lọc
                </Button>
              )}
            </Space>
          </div>
        </div>
      </Card>

      {!loading && (
        <div style={{ marginBottom: 12, color: t.textSecondary, fontSize: 14 }}>
          Tìm thấy <strong style={{ color: t.primary700 }}>{total}</strong> máy
          {hasFilter ? ' khớp bộ lọc' : ''}
        </div>
      )}

      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: 16 }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <Skeleton active />
            </Card>
          ))}
        </div>
      ) : items.length === 0 ? (
        /* Trang thai RONG phai huu ich: noi RO dieu kien nao dang chan va cho nut thoat ra ngay,
           khong duoc de trang trong tron (docs/07 SS8). */
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={
            <div>
              <div style={{ fontWeight: 600, marginBottom: 8 }}>
                Không có máy nào khớp toàn bộ điều kiện bạn chọn
              </div>
              <div style={{ color: t.textSecondary, marginBottom: 4 }}>Các điều kiện đang áp dụng:</div>
              <div style={{ marginBottom: 12 }}>
                {segment && <Tag color="blue">{SEGMENTS.find((x) => x.value === segment)?.label}</Tag>}
                {(priceRange[0] > 0 || priceRange[1] < 80) && (
                  <Tag color="blue">
                    Giá {formatShortVnd(priceRange[0] * 1_000_000)} – {formatShortVnd(priceRange[1] * 1_000_000)}
                  </Tag>
                )}
                {ramMin && <Tag color="blue">RAM ≥ {ramMin} GB</Tag>}
                {brandIds.length > 0 && <Tag color="blue">{brandIds.length} hãng đã chọn</Tag>}
                {onlyDedicatedGpu && <Tag color="blue">Chỉ card rời</Tag>}
                {keyword && <Tag color="blue">Từ khóa "{keyword}"</Tag>}
              </div>
            </div>
          }
        >
          <Space wrap>
            <Button type="primary" onClick={resetFilters}>
              Xóa toàn bộ bộ lọc
            </Button>
            {(priceRange[0] > 0 || priceRange[1] < 80) && (
              <Button
                onClick={() => {
                  setPriceRange([0, 80]);
                  setPage(1);
                }}
              >
                Bỏ giới hạn giá
              </Button>
            )}
            {segment && (
              <Button
                onClick={() => {
                  setSegment(undefined);
                  setPage(1);
                }}
              >
                Xem tất cả phân khúc
              </Button>
            )}
          </Space>
        </Empty>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: 16 }}>
            {items.map((l) => (
              <Card key={l.id} hoverable onClick={() => navigate(`/laptop/${l.id}`)}>
                <LaptopThumbnail imageUrl={l.imageUrl} segment={l.segmentLabel?.segment} brand={l.brand?.name} name={l.name} height={140} />
                <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                  {l.segmentLabel && <SegmentTag segment={l.segmentLabel.segment} />}
                </div>
                <h3 style={{ margin: '4px 0' }}>{l.name}</h3>
                <div style={{ fontSize: 20, fontWeight: 700, color: t.primary700 }} className="tabular-nums">
                  {formatVnd(l.priceVnd)}
                </div>
                <DiscountBadge
                  priceVnd={l.priceVnd}
                  originalPriceVnd={l.originalPriceVnd}
                  salesCount={l.salesCount}
                  size="small"
                />
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
