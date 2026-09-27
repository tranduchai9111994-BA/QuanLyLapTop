import { useEffect, useState } from 'react';
import { Button, Card, Empty, Result } from 'antd';
import { HeartFilled } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import type { Laptop } from '../types';
import { SegmentTag } from '../components/smart/SegmentTag';
import { LaptopThumbnail } from '../components/smart/LaptopThumbnail';
import { formatVnd } from '../utils/format';
import { t } from '../theme/tokens';

interface FavoriteRow {
  laptopId: number;
  laptop: Laptop;
}

/** UC-07: danh sách máy khách hàng đã "Yêu thích" (nút trái tim ở trang Chi tiết). Yêu cầu đăng
 * nhập - nếu chưa có token thì hiện màn hình mời đăng nhập thay vì gọi API rồi nhận 401 khó hiểu. */
export function Favorites() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<FavoriteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const token = localStorage.getItem('smartlap_token');
  const userRaw = localStorage.getItem('smartlap_user');
  const user = userRaw ? JSON.parse(userRaw) : null;

  useEffect(() => {
    if (!token || user?.role !== 'CUSTOMER') return;
    api
      .get('/me/favorites')
      .then((r) => setRows(r.data.data))
      .finally(() => setLoading(false));
  }, [token]);

  if (!token || user?.role !== 'CUSTOMER') {
    return (
      <div style={{ maxWidth: 600, margin: '60px auto' }}>
        <Result
          status="info"
          title="Đăng nhập để xem danh sách yêu thích"
          extra={
            <Button type="primary" onClick={() => navigate('/login', { state: { from: '/favorites' } })}>
              Đăng nhập / Tạo tài khoản
            </Button>
          }
        />
      </div>
    );
  }

  async function remove(laptopId: number) {
    await api.delete(`/me/favorites/${laptopId}`);
    setRows((prev) => prev.filter((r) => r.laptopId !== laptopId));
  }

  return (
    <div style={{ maxWidth: 1200, margin: '24px auto', padding: '0 24px' }}>
      <h1>Máy đã yêu thích</h1>
      {!loading && rows.length === 0 && (
        <Empty description="Chưa có máy nào — bấm biểu tượng trái tim ở trang Chi tiết để lưu lại.">
          <Button type="primary" onClick={() => navigate('/laptops')}>
            Xem danh mục
          </Button>
        </Empty>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
        {rows.map((r) => (
          <Card
            key={r.laptopId}
            hoverable
            size="small"
            actions={[
              // stopPropagation: Card ben ngoai cung co onClick (dieu huong sang Chi tiet) -
              // khong chan bubble thi bam "Bo thich" se VUA xoa VUA dieu huong sang trang Chi
              // tiet cua chinh may vua xoa, gay kho hieu.
              <Button
                key="remove"
                type="text"
                danger
                icon={<HeartFilled />}
                onClick={(e) => {
                  e.stopPropagation();
                  remove(r.laptopId);
                }}
              >
                Bỏ thích
              </Button>,
            ]}
            onClick={() => navigate(`/laptop/${r.laptopId}`)}
          >
            <LaptopThumbnail
              imageUrl={r.laptop.imageUrl}
              segment={r.laptop.segmentLabel?.segment}
              brand={r.laptop.brand?.name}
              name={r.laptop.name}
              height={100}
            />
            <div style={{ fontWeight: 600, marginTop: 4 }}>{r.laptop.name}</div>
            {r.laptop.segmentLabel && <SegmentTag segment={r.laptop.segmentLabel.segment} />}
            <div className="tabular-nums" style={{ color: t.primary700, fontWeight: 700 }}>
              {formatVnd(r.laptop.priceVnd)}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
