import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button, Skeleton, Result, Card, Tag } from 'antd';
import { api } from '../lib/api';
import type { Laptop } from '../types';
import { SegmentTag } from '../components/smart/SegmentTag';
import { LaptopThumbnail } from '../components/smart/LaptopThumbnail';
import { formatVnd, formatKg, formatInch } from '../utils/format';
import { t } from '../theme/tokens';

export function Detail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [laptop, setLaptop] = useState<Laptop | null>(null);
  const [similar, setSimilar] = useState<{ laptopId: number; distance: number; laptop: Laptop }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

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
  }, [id]);

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
    <div style={{ maxWidth: 900, margin: '32px auto', padding: '0 16px' }}>
      <LaptopThumbnail imageUrl={laptop.imageUrl} segment={laptop.segmentLabel?.segment} name={laptop.name} height={220} />
      <h1>{laptop.name}</h1>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {laptop.segmentLabel && <SegmentTag segment={laptop.segmentLabel.segment} />}
        <Tag>{laptop.brand.name}</Tag>
      </div>
      <div style={{ fontSize: 28, fontWeight: 700, color: t.primary700, marginBottom: 16 }} className="tabular-nums">
        {formatVnd(laptop.priceVnd)}
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
        <div style={{ color: t.textTertiary }}>Chưa tìm được máy tương tự lúc này.</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
          {similar.map((s) => (
            <Card key={s.laptopId} hoverable onClick={() => navigate(`/laptop/${s.laptopId}`)} size="small">
              <LaptopThumbnail imageUrl={s.laptop?.imageUrl} segment={s.laptop?.segmentLabel?.segment} name={s.laptop?.name ?? ''} height={70} />
              <div style={{ fontWeight: 600 }}>{s.laptop?.name}</div>
              <div className="tabular-nums">{formatVnd(s.laptop?.priceVnd)}</div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
