import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button, Skeleton, Result, Card, Tag, message } from 'antd';
import { HeartOutlined, HeartFilled } from '@ant-design/icons';
import { api } from '../lib/api';
import type { Laptop } from '../types';
import { SegmentTag } from '../components/smart/SegmentTag';
import { LaptopThumbnail } from '../components/smart/LaptopThumbnail';
import { DiscountBadge } from '../components/smart/DiscountBadge';
import { formatVnd, formatKg, formatInch } from '../utils/format';
import { t } from '../theme/tokens';

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
      <div style={{ marginBottom: 16 }}>
        <DiscountBadge
          priceVnd={laptop.priceVnd}
          originalPriceVnd={laptop.originalPriceVnd}
          salesCount={laptop.salesCount}
        />
      </div>

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
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
