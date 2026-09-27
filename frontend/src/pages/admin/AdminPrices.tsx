import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Drawer,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  Table,
  Tag,
  message,
} from 'antd';
import { SearchOutlined, LineChartOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { Line, LineChart, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis } from 'recharts';
import { api } from '../../lib/api';
import { t } from '../../theme/tokens';
import { formatVnd, formatShortVnd } from '../../utils/format';
import { NUMERIC_LIMITS } from '../../constants/laptopSpecs';

/**
 * Kieu du lieu 1 dong trong bang Quan ly gia - chi lay dung nhung truong man hinh nay can hien
 * thi/sua (khong phai toan bo model Laptop). `?` = truong co the thieu (vd may chua tung giam gia
 * thi khong co `originalPriceVnd`).
 */
interface LaptopRow {
  id: number;
  sku: string;
  name: string;
  series?: string | null;
  priceVnd: number;
  originalPriceVnd?: number | null;
  salesCount?: number;
  valueIdx: number;
  ramGb: number;
  ssdGb: number;
  brand: { id: number; name: string };
  cpu?: { displayName: string };
  gpu?: { displayName: string };
  segmentLabel?: { segment: string } | null;
}

/** 1 dong trong the "Bien dong gia gan day" - lay tu API GET /laptops/price-changes, da duoc
 * backend tinh san chenh lech (diff/percent) giua 2 lan doi gia gan nhat cua 1 may. */
interface PriceChange {
  laptopId: number;
  name: string;
  brand: string;
  previousPrice: number;
  currentPrice: number;
  diff: number;
  percent: number;
  changedAt: string;
}

/** Man QUAN LY GIA: gia nha cung cap thay doi lien tuc nen tach rieng khoi form sua laptop day du.
 * Gom 3 nghiep vu: sua gia nhanh tung may, xem lich su bien dong, va dieu chinh hang loat theo %. */
export function AdminPrices() {
  const [rows, setRows] = useState<LaptopRow[]>([]);
  const [brands, setBrands] = useState<{ id: number; name: string }[]>([]);
  const [changes, setChanges] = useState<PriceChange[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [seriesFilter, setSeriesFilter] = useState<string | undefined>();

  const [historyOf, setHistoryOf] = useState<LaptopRow | null>(null);
  const [history, setHistory] = useState<any>(null);

  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkPercent, setBulkPercent] = useState<number>(5);
  const [bulkBrand, setBulkBrand] = useState<number | undefined>();
  const [bulkPreview, setBulkPreview] = useState<any>(null);
  const [bulkBusy, setBulkBusy] = useState(false);

  /** Tai lai TOAN BO du lieu man hinh (danh sach may, danh sach hang, bien dong gia gan day)
   * cung 1 luc - goi lai ham nay sau MOI lan sua gia/khuyen mai/luot ban thanh cong de bang
   * luon hien dung du lieu moi nhat tu server (khong tu sua state cuc bo, tranh lech du lieu). */
  function load() {
    setLoading(true);
    // pageSize=1000: man Quan ly gia can XEM/SUA duoc CA catalog cung luc (khong phan trang o
    // server), phan trang chi lam o giao dien (Table pagination) cho de nhin
    Promise.all([
      api.get('/laptops?pageSize=1000&sort=price_desc'),
      api.get('/brands'),
      api.get('/laptops/price-changes?limit=15'),
    ])
      .then(([l, b, c]) => {
        setRows(l.data.data);
        setBrands(b.data.data);
        setChanges(c.data.data);
      })
      .catch(() => message.error('Không tải được dữ liệu giá.'))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  /** Danh sach DONG MAY (series) co that trong catalog - gia gan voi tung dong/model. */
  const seriesOptions = useMemo(() => {
    const set = new Map<string, string>();
    rows.forEach((r) => {
      if (r.series) set.set(`${r.brand?.name} ${r.series}`, `${r.brand?.name} ${r.series}`);
    });
    return [...set.keys()].sort().map((v) => ({ label: v, value: v }));
  }, [rows]);

  // Loc danh sach hien thi tren TRINH DUYET (khong goi lai API) - vi da tai het pageSize=1000 ve
  // may nguoi dung, loc/tim kiem tren client cho phan hoi tuc thi khi go tung ky tu
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (seriesFilter && `${r.brand?.name} ${r.series}` !== seriesFilter) return false;
      if (!q) return true;
      return `${r.sku} ${r.name} ${r.series ?? ''} ${r.brand?.name}`.toLowerCase().includes(q);
    });
  }, [rows, search, seriesFilter]);

  /** Luu gia BAN moi cho 1 may (o "Gia moi" trong bang). Bo qua neu nguoi dung khong sua gi
   * (gia go vao = gia dang co) de tranh goi API + ghi lich su gia mot cach thua. */
  async function savePrice(row: LaptopRow, newPrice: number) {
    if (newPrice === row.priceVnd) return;
    try {
      await api.patch(`/laptops/${row.id}/price`, { priceVnd: newPrice });
      message.success(`Đã cập nhật giá ${row.name}`);
      load();
    } catch (err: any) {
      message.error(err?.response?.data?.error?.message ?? 'Không cập nhật được giá.');
    }
  }

  /** Sua khuyen mai (gia goc) hoac luot ban - dung chung API voi doi gia vi cung 1 nghiep vu.
   * `originalPriceVnd = null` nghia la HUY khuyen mai (may khong con giam gia). */
  async function savePromotion(row: LaptopRow, patch: { originalPriceVnd?: number | null; salesCount?: number }) {
    try {
      await api.patch(`/laptops/${row.id}/price`, { priceVnd: row.priceVnd, ...patch });
      message.success(`Đã cập nhật khuyến mãi ${row.name}`);
      load();
    } catch (err: any) {
      message.error(err?.response?.data?.error?.message ?? 'Không cập nhật được khuyến mãi.');
    }
  }

  /** Mo Drawer "Lich su gia" cho 1 may - dat `historyOf` truoc (de Drawer hien ngay voi trang
   * thai "Dang tai...") roi moi goi API, thay vi doi API xong moi mo Drawer (cam giac phan hoi
   * nhanh hon). */
  async function openHistory(row: LaptopRow) {
    setHistoryOf(row);
    setHistory(null);
    const r = await api.get(`/laptops/${row.id}/price-history`);
    setHistory(r.data.data);
  }

  /** Chay dieu chinh gia hang loat. `dryRun=true` chi XEM TRUOC (khong doi gi trong DB, server
   * tra ve vai vi du minh hoa); `dryRun=false` moi thuc su ap dung - bat buoc nguoi dung phai
   * bam "Xem truoc" it nhat 1 lan truoc khi nut "Ap dung that" duoc bat (xem `okButtonProps`
   * ben duoi: `disabled: !bulkPreview`). */
  async function runBulk(dryRun: boolean) {
    setBulkBusy(true);
    try {
      const r = await api.post('/laptops/bulk-price', {
        percent: bulkPercent,
        brandId: bulkBrand,
        dryRun,
      });
      if (dryRun) {
        setBulkPreview(r.data.data);
      } else {
        message.success(`Đã điều chỉnh giá ${r.data.data.affected} máy`);
        setBulkOpen(false);
        setBulkPreview(null);
        load();
      }
    } catch (err: any) {
      message.error(err?.response?.data?.error?.message ?? 'Không điều chỉnh được giá.');
    } finally {
      setBulkBusy(false);
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <h2 style={{ margin: 0 }}>Quản lý giá</h2>
        <Space wrap>
          <Input
            placeholder="Tìm theo tên máy / hãng..."
            prefix={<SearchOutlined />}
            allowClear
            style={{ width: 240 }}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Select
            allowClear
            showSearch
            placeholder="Lọc theo dòng máy"
            style={{ width: 220 }}
            value={seriesFilter}
            onChange={setSeriesFilter}
            options={seriesOptions}
          />
          <Button icon={<ThunderboltOutlined />} onClick={() => setBulkOpen(true)}>
            Điều chỉnh hàng loạt
          </Button>
        </Space>
      </div>

      {changes.length > 0 && (
        <Card size="small" title="Biến động giá gần đây" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {changes.slice(0, 8).map((c) => (
              <Tag key={c.laptopId} color={c.diff > 0 ? 'red' : 'green'}>
                {c.name}: {formatShortVnd(c.previousPrice)} → {formatShortVnd(c.currentPrice)} (
                {c.percent > 0 ? '+' : ''}
                {c.percent}%)
              </Tag>
            ))}
          </div>
        </Card>
      )}

      <Table
        rowKey="id"
        loading={loading}
        dataSource={filtered}
        pagination={{ pageSize: 15, showSizeChanger: false }}
        scroll={{ x: 1400 }}
        columns={[
          { title: 'Mã SKU', dataIndex: 'sku', width: 120, fixed: 'left' as const },
          {
            title: 'Tên máy',
            dataIndex: 'name',
            width: 200,
            render: (v: string, row: LaptopRow) => (
              <div>
                <div style={{ fontWeight: 600 }}>{v}</div>
                <div style={{ fontSize: 12, color: t.textTertiary }}>
                  {row.cpu?.displayName} · {row.ramGb}GB · {row.ssdGb}GB
                </div>
              </div>
            ),
          },
          { title: 'Dòng máy', dataIndex: 'series', width: 140, render: (v: string) => v ?? '—' },
          { title: 'Hãng', dataIndex: ['brand', 'name'], width: 100 },
          {
            title: 'Giá hiện tại',
            dataIndex: 'priceVnd',
            width: 170,
            sorter: (a: LaptopRow, b: LaptopRow) => a.priceVnd - b.priceVnd,
            render: (v: number) => <span className="tabular-nums">{formatVnd(v)}</span>,
          },
          {
            title: 'Đáng tiền',
            dataIndex: 'valueIdx',
            width: 100,
            sorter: (a: LaptopRow, b: LaptopRow) => a.valueIdx - b.valueIdx,
            render: (v: number) => v?.toFixed(2),
          },
          {
            // Cot "Gia goc (khuyen mai)": de trong = may khong giam gia. `min` = gia hien tai +
            // 10.000d de nguoi dung KHONG THE nhap gia goc <= gia ban (khong hop ly - da la
            // "khuyen mai" thi gia goc phai cao hon gia dang ban). Day la lop chan phia CLIENT,
            // server (laptops.routes.ts) van kiem tra lai lan nua cho chac.
            title: 'Giá gốc (khuyến mãi)',
            key: 'originalPrice',
            width: 190,
            render: (_: unknown, row: LaptopRow) => (
              <InputNumber
                placeholder="Không giảm giá"
                defaultValue={row.originalPriceVnd ?? undefined}
                min={row.priceVnd + 10_000}
                max={NUMERIC_LIMITS.priceVnd.max}
                step={100_000}
                style={{ width: '100%' }}
                // formatter: them dau "." ngan cach hang nghin khi HIEN THI (vd 85000000 ->
                // "85.000.000") cho de doc; parser: lam nguoc lai khi doc gia tri nguoi go vao
                formatter={(v) => (v ? `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.') : '')}
                parser={(v) => Number((v ?? '').replace(/\./g, ''))}
                onBlur={(e) => {
                  const raw = e.target.value.replace(/\./g, '');
                  // O trong (raw === '') nghia la nguoi dung XOA het -> HUY khuyen mai (gui null)
                  const val = raw === '' ? null : Number(raw);
                  // Khong doi gi hoac nhap gia tri khong hop le (NaN) thi bo qua, khong goi API
                  if (val === row.originalPriceVnd || (val !== null && Number.isNaN(val))) return;
                  savePromotion(row, { originalPriceVnd: val });
                }}
              />
            ),
          },
          {
            title: 'Đã bán',
            key: 'salesCount',
            width: 120,
            render: (_: unknown, row: LaptopRow) => (
              <InputNumber
                defaultValue={row.salesCount ?? 0}
                min={0}
                max={1_000_000}
                step={1}
                style={{ width: '100%' }}
                onBlur={(e) => {
                  const val = Number(e.target.value.replace(/\./g, ''));
                  if (!Number.isNaN(val) && val !== row.salesCount) savePromotion(row, { salesCount: val });
                }}
              />
            ),
          },
          {
            // Cot "Gia moi": sua duoc CA khi roi khoi o (onBlur) LAN khi nhan Enter
            // (onPressEnter) - tien loi hon cho nguoi dung go nhanh nhieu dong lien tiep bang
            // ban phim ma khong can bam chuot ra ngoai o.
            title: 'Giá mới',
            key: 'edit',
            width: 200,
            render: (_: unknown, row: LaptopRow) => (
              <InputNumber
                defaultValue={row.priceVnd}
                min={NUMERIC_LIMITS.priceVnd.min}
                max={NUMERIC_LIMITS.priceVnd.max}
                step={100_000}
                style={{ width: '100%' }}
                formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}
                parser={(v) => Number((v ?? '').replace(/\./g, ''))}
                onBlur={(e) => {
                  const val = Number(e.target.value.replace(/\./g, ''));
                  if (!Number.isNaN(val)) savePrice(row, val);
                }}
                onPressEnter={(e) => {
                  const val = Number((e.target as HTMLInputElement).value.replace(/\./g, ''));
                  if (!Number.isNaN(val)) savePrice(row, val);
                }}
              />
            ),
          },
          {
            title: '',
            key: 'history',
            width: 110,
            render: (_: unknown, row: LaptopRow) => (
              <Button size="small" icon={<LineChartOutlined />} onClick={() => openHistory(row)}>
                Lịch sử
              </Button>
            ),
          },
        ]}
      />

      <Drawer
        title={`Lịch sử giá — ${historyOf?.name ?? ''}`}
        open={!!historyOf}
        onClose={() => setHistoryOf(null)}
        size="large"
      >
        {!history ? (
          <div>Đang tải…</div>
        ) : history.points.length === 0 ? (
          <Alert type="info" message="Máy này chưa có lịch sử thay đổi giá." />
        ) : (
          <>
            <div style={{ display: 'flex', gap: 24, marginBottom: 16, flexWrap: 'wrap' }}>
              <div>
                <div style={{ color: t.textSecondary, fontSize: 13 }}>Giá hiện tại</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: t.primary700 }}>
                  {formatVnd(history.summary.current)}
                </div>
              </div>
              <div>
                <div style={{ color: t.textSecondary, fontSize: 13 }}>Thấp nhất</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: t.success }}>
                  {formatVnd(history.summary.lowest)}
                </div>
              </div>
              <div>
                <div style={{ color: t.textSecondary, fontSize: 13 }}>Cao nhất</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: t.error }}>
                  {formatVnd(history.summary.highest)}
                </div>
              </div>
              <div>
                <div style={{ color: t.textSecondary, fontSize: 13 }}>Số lần đổi giá</div>
                <div style={{ fontSize: 20, fontWeight: 700 }}>{history.summary.timesChanged}</div>
              </div>
            </div>

            <ResponsiveContainer width="100%" height={240}>
              <LineChart
                data={history.points.map((p: any) => ({
                  time: new Date(p.changedAt).toLocaleDateString('vi-VN'),
                  gia: p.priceVnd,
                }))}
              >
                <XAxis dataKey="time" fontSize={12} />
                <YAxis tickFormatter={(v) => `${Math.round(v / 1e6)}tr`} fontSize={12} />
                <RTooltip formatter={(v: any) => formatVnd(Number(v))} />
                <Line type="monotone" dataKey="gia" stroke={t.primary500} strokeWidth={2} dot />
              </LineChart>
            </ResponsiveContainer>
          </>
        )}
      </Drawer>

      <Modal
        title="Điều chỉnh giá hàng loạt"
        open={bulkOpen}
        onCancel={() => {
          setBulkOpen(false);
          setBulkPreview(null);
        }}
        onOk={() => runBulk(false)}
        okText="Áp dụng thật"
        cancelText="Đóng"
        okButtonProps={{ danger: true, disabled: !bulkPreview, loading: bulkBusy }}
        maskClosable={false}
      >
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 12 }}
          message="Thao tác này đổi giá nhiều máy cùng lúc. Hãy bấm “Xem trước” để kiểm tra rồi mới áp dụng."
        />
        <Space direction="vertical" style={{ width: '100%' }}>
          <div>
            Phần trăm điều chỉnh (dương = tăng, âm = giảm):
            <InputNumber
              value={bulkPercent}
              onChange={(v) => {
                setBulkPercent(Number(v ?? 0));
                setBulkPreview(null);
              }}
              min={-90}
              max={200}
              step={1}
              addonAfter="%"
              style={{ width: 160, marginLeft: 8 }}
            />
          </div>
          <div>
            Áp dụng cho hãng:
            <Select
              allowClear
              placeholder="Tất cả hãng"
              style={{ width: 220, marginLeft: 8 }}
              value={bulkBrand}
              onChange={(v) => {
                setBulkBrand(v);
                setBulkPreview(null);
              }}
              options={brands.map((b) => ({ label: b.name, value: b.id }))}
            />
          </div>
          <Button onClick={() => runBulk(true)} loading={bulkBusy}>
            Xem trước ảnh hưởng
          </Button>

          {bulkPreview && (
            <Alert
              type="info"
              message={`Sẽ đổi giá ${bulkPreview.affected} máy`}
              description={
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                  {bulkPreview.samples.map((s: any) => (
                    <li key={s.id}>
                      {s.name}: {formatVnd(s.oldPrice)} → <strong>{formatVnd(s.newPrice)}</strong>
                    </li>
                  ))}
                  {bulkPreview.affected > bulkPreview.samples.length && <li>…</li>}
                </ul>
              }
            />
          )}
        </Space>
      </Modal>
    </div>
  );
}
