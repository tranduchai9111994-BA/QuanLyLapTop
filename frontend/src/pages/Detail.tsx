import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button, Skeleton, Result, Card, Tag, message } from 'antd';
import { HeartOutlined, HeartFilled } from '@ant-design/icons';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { api } from '../lib/api';
import type { Laptop } from '../types';
import { SegmentTag } from '../components/smart/SegmentTag';
import { LaptopThumbnail } from '../components/smart/LaptopThumbnail';
import { DiscountBadge } from '../components/smart/DiscountBadge';
import { formatVnd, formatKg, formatInch } from '../utils/format';
import { t } from '../theme/tokens';

/** docs/08_FRONTEND_SPEC.md muc 5: "1 khac biet chinh" - chon DUY NHAT 1 dac trung lech nhieu
 * NHAT (theo % tuong doi) giua may goc va may tuong tu, giup nguoi xem nam nhanh diem khac biet
 * ro nhat thay vi doc lai toan bo bang thong so. Chi xet cac dac trung "cang thap/cao cang tot"
 * co huong ro rang (bo qua RAM/SSD vi kNN item-item da uu tien chon may CUNG cau hinh, chenh
 * lech thuong khong dang ke va de gay nhieu dong nghia hon la co ich). */
function biggestDifference(base: Laptop, other: Laptop): string | null {
  const candidates: { diff: number; text: string }[] = [];
  const pct = (a: number, b: number) => (b === 0 ? 0 : Math.abs(a - b) / b);

  if (other.weightKg !== base.weightKg) {
    const d = other.weightKg - base.weightKg;
    candidates.push({
      diff: pct(other.weightKg, base.weightKg),
      text: d < 0 ? `Nhẹ hơn ${Math.abs(d).toFixed(1)} kg` : `Nặng hơn ${d.toFixed(1)} kg`,
    });
  }
  if (other.ramGb !== base.ramGb) {
    const d = other.ramGb - base.ramGb;
    candidates.push({ diff: pct(other.ramGb, base.ramGb), text: `RAM ${d > 0 ? 'nhiều hơn' : 'ít hơn'} ${Math.abs(d)}GB` });
  }
  if (other.ssdGb !== base.ssdGb) {
    const d = other.ssdGb - base.ssdGb;
    candidates.push({ diff: pct(other.ssdGb, base.ssdGb), text: `SSD ${d > 0 ? 'nhiều hơn' : 'ít hơn'} ${Math.abs(d)}GB` });
  }
  if (other.refreshHz !== base.refreshHz) {
    const d = other.refreshHz - base.refreshHz;
    candidates.push({ diff: pct(other.refreshHz, base.refreshHz), text: `Màn hình ${d > 0 ? 'mượt hơn' : 'tần số thấp hơn'} ${Math.abs(d)}Hz` });
  }
  const batteryDiff = (other.batteryWh ?? 0) - (base.batteryWh ?? 0);
  if (batteryDiff !== 0) {
    candidates.push({
      diff: pct(other.batteryWh ?? 0, base.batteryWh ?? 0),
      text: `Pin ${batteryDiff > 0 ? 'lớn hơn' : 'nhỏ hơn'} ${Math.abs(batteryDiff)}Wh`,
    });
  }

  if (candidates.length === 0) return null;
  return candidates.sort((a, b) => b.diff - a.diff)[0].text;
}

/** Trang Chi tiet 1 may: thong so ky thuat day du + danh sach "May tuong tu" (item-item kNN,
 * xem retriever.similar_items - docs/13_GIAI_THICH_THUAT_TOAN_KNN.md muc 4.2). 2 API duoc goi doc lap:
 * neu "may tuong tu" loi (vd ML service chua dong bo may nay) trang CHINH van hien binh thuong,
 * chi rieng phan "May tuong tu" hien trang thai rong - khong lam sap ca trang vi 1 phan phu. */
export function Detail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [laptop, setLaptop] = useState<Laptop | null>(null);
  const [similar, setSimilar] = useState<{ laptopId: number; distance: number; laptop: Laptop }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [favBusy, setFavBusy] = useState(false);
  const token = localStorage.getItem('smartlap_token');
  const userRaw = localStorage.getItem('smartlap_user');
  const isCustomer = (userRaw ? JSON.parse(userRaw) : null)?.role === 'CUSTOMER';

  useEffect(() => {
    setLoading(true);
    setError(false);
    setSimilar([]);
    // "May tuong tu" khong duoc phep lam sap ca trang Chi tiet neu no loi (vd ML service
    // chua dong bo catalog) - moi lenh goi doc lap, chi trang chinh moi bat buoc thanh cong.
    api
      .get(`/laptops/${id}`)
      .then((detailRes) => {
        setLaptop(detailRes.data.data);
        api
          .get(`/laptops/${id}/similar?k=6`)
          .then((similarRes) => setSimilar(similarRes.data.data))
          .catch(() => setSimilar([]));
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));

    api.post('/events', { laptopId: Number(id), type: 'VIEW_DETAIL' }).catch(() => null);

    // Kiem tra may nay DA duoc yeu thich chua (chi khi da dang nhap voi tai khoan khach hang) -
    // de nut trai tim hien dung trang thai ngay tu dau, khong phai bam thu moi biet.
    if (token && isCustomer) {
      api
        .get('/me/favorites')
        .then((r) => setIsFavorite(r.data.data.some((f: { laptopId: number }) => f.laptopId === Number(id))))
        .catch(() => undefined);
    } else {
      setIsFavorite(false);
    }
  }, [id]);

  async function toggleFavorite() {
    if (!token || !isCustomer) {
      navigate('/login', { state: { from: `/laptop/${id}` } });
      return;
    }
    setFavBusy(true);
    try {
      if (isFavorite) {
        await api.delete(`/me/favorites/${id}`);
        setIsFavorite(false);
      } else {
        await api.post('/me/favorites', { laptopId: Number(id) });
        await api.post('/events', { laptopId: Number(id), type: 'ADD_FAVORITE' }).catch(() => undefined);
        setIsFavorite(true);
        message.success('Đã thêm vào máy yêu thích.');
      }
    } catch {
      message.error('Không thực hiện được, thử lại sau.');
    } finally {
      setFavBusy(false);
    }
  }

  if (loading) return <div style={{ maxWidth: 900, margin: '32px auto' }}><Skeleton active /></div>;
  if (error || !laptop)
    return (
      <Result
        status="error"
        title="Không kết nối được máy chủ"
        subTitle="Kiểm tra mạng và thử lại."
        extra={<Button onClick={() => navigate(0)}>Thử lại</Button>}
      />
    );

  return (
    <div style={{ maxWidth: 1200, margin: '24px auto', padding: '0 24px' }}>
      <LaptopThumbnail imageUrl={laptop.imageUrl} segment={laptop.segmentLabel?.segment} brand={laptop.brand?.name} name={laptop.name} width={320} height={240} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <h1 style={{ margin: 0 }}>{laptop.name}</h1>
        <Button
          shape="circle"
          size="large"
          icon={isFavorite ? <HeartFilled /> : <HeartOutlined />}
          loading={favBusy}
          onClick={toggleFavorite}
          style={{ color: isFavorite ? t.error : undefined }}
        />
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {laptop.segmentLabel && <SegmentTag segment={laptop.segmentLabel.segment} />}
        <Tag>{laptop.brand.name}</Tag>
      </div>
      <div style={{ fontSize: 28, fontWeight: 700, color: t.primary700 }} className="tabular-nums">
        {formatVnd(laptop.priceVnd)}
      </div>
      <div style={{ marginBottom: 8 }}>
        <DiscountBadge
          priceVnd={laptop.priceVnd}
          originalPriceVnd={laptop.originalPriceVnd}
          salesCount={laptop.salesCount}
        />
      </div>
      {/* docs/08_FRONTEND_SPEC.md muc 5: "Dang tien" so voi TRUNG VI phan khuc - tinh san o
          backend (percentile theo valueIdx trong CUNG phan khuc). */}
      {laptop.valuePercentile != null && (
        <div style={{ marginBottom: 16, fontSize: 14, color: t.success, fontWeight: 600 }}>
          💎 Đáng tiền — tốt hơn {laptop.valuePercentile}% máy cùng phân khúc
        </div>
      )}

      {laptop.priceHistory && laptop.priceHistory.length >= 2 && (
        <Card title="Lịch sử giá" style={{ marginBottom: 24 }}>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart
              data={[...laptop.priceHistory]
                .sort((a, b) => new Date(a.changedAt).getTime() - new Date(b.changedAt).getTime())
                .map((h) => ({ date: new Date(h.changedAt).toLocaleDateString('vi-VN'), price: h.priceVnd }))}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={(v) => `${Math.round(v / 1_000_000)}tr`} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => formatVnd(Number(v))} />
              <Line type="monotone" dataKey="price" name="Giá" stroke={t.primary700} strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      )}

      <Card title="Thông số kỹ thuật" style={{ marginBottom: 24 }}>
        <table style={{ width: '100%' }}>
          <tbody>
            <tr><td>CPU</td><td>{laptop.cpu.displayName}</td></tr>
            <tr><td>GPU</td><td>{laptop.gpu.displayName} {laptop.gpu.dedicated ? '(rời)' : '(tích hợp)'}</td></tr>
            <tr><td>RAM</td><td>{laptop.ramGb} GB</td></tr>
            <tr><td>SSD</td><td>{laptop.ssdGb} GB</td></tr>
            <tr><td>Màn hình</td><td>{formatInch(laptop.screenInch)}, {laptop.refreshHz} Hz{laptop.srgb100 ? ', sRGB 100%' : ''}</td></tr>
            <tr><td>Trọng lượng</td><td>{formatKg(laptop.weightKg)}</td></tr>
            <tr><td>Pin</td><td>{laptop.batteryWh ?? '—'} Wh</td></tr>
          </tbody>
        </table>
      </Card>

      <h2>Máy tương tự</h2>
      {similar.length === 0 ? (
        <Result
          status="info"
          title="Chưa tìm được máy tương tự"
          subTitle="Có thể catalog gợi ý (ML service) chưa đồng bộ máy này, hoặc đây là cấu hình hiếm gặp."
          extra={
            <Button type="primary" onClick={() => navigate('/laptops')}>
              Xem toàn bộ danh mục
            </Button>
          }
        />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
          {similar.map((s) => {
            // FR-04: hien chenh lech gia SO VOI may dang xem, giup nguoi dung nhanh chong biet
            // may tuong tu nay dat/re hon bao nhieu ma khong phai tu nham trong dau.
            const diff = s.laptop ? s.laptop.priceVnd - laptop.priceVnd : 0;
            const diffPct = laptop.priceVnd ? Math.round((diff / laptop.priceVnd) * 100) : 0;
            return (
              <Card key={s.laptopId} hoverable onClick={() => navigate(`/laptop/${s.laptopId}`)} size="small">
                <LaptopThumbnail imageUrl={s.laptop?.imageUrl} segment={s.laptop?.segmentLabel?.segment} brand={s.laptop?.brand?.name} name={s.laptop?.name ?? ''} height={90} />
                <div style={{ fontWeight: 600 }}>{s.laptop?.name}</div>
                <div className="tabular-nums">{formatVnd(s.laptop?.priceVnd)}</div>
                {s.laptop && diff !== 0 && (
                  <Tag color={diff > 0 ? 'red' : 'green'} style={{ marginTop: 4 }}>
                    {diff > 0 ? `Đắt hơn ${diffPct}%` : `Rẻ hơn ${Math.abs(diffPct)}%`}
                  </Tag>
                )}
                {s.laptop && diff === 0 && (
                  <Tag style={{ marginTop: 4 }}>Cùng mức giá</Tag>
                )}
                {/* docs/08_FRONTEND_SPEC.md muc 5: "1 khac biet chinh" - 1 cau ngan nhat nam bat
                    su khac biet ro nhat, khong bat nguoi xem phai tu doc bang thong so day du. */}
                {s.laptop && (
                  <div style={{ fontSize: 12, color: t.textTertiary, marginTop: 4 }}>
                    {biggestDifference(laptop, s.laptop) ?? 'Cấu hình gần như tương đương'}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
