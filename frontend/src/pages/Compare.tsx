import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button, Empty, Table } from 'antd';
import { api } from '../lib/api';
import type { Laptop } from '../types';
import { formatVnd, formatKg, formatInch } from '../utils/format';

export function Compare() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const ids = params.get('ids') ?? '';
  const [laptops, setLaptops] = useState<Laptop[]>([]);

  useEffect(() => {
    if (!ids) return;
    api.get(`/laptops/compare?ids=${ids}`).then((r) => setLaptops(r.data.data));
  }, [ids]);

  const rows = [
    { key: 'name', label: 'Tên máy', get: (l: Laptop) => l.name },
    { key: 'price', label: 'Giá', get: (l: Laptop) => formatVnd(l.priceVnd) },
    {
      key: 'discount',
      label: 'Khuyến mãi',
      get: (l: Laptop) =>
        l.originalPriceVnd && l.originalPriceVnd > l.priceVnd
          ? `Giảm từ ${formatVnd(l.originalPriceVnd)} (-${Math.round(
              ((l.originalPriceVnd - l.priceVnd) / l.originalPriceVnd) * 100
            )}%)`
          : 'Không giảm giá',
    },
    {
      key: 'sales',
      label: 'Đã bán',
      get: (l: Laptop) => (l.salesCount ? l.salesCount.toLocaleString('vi-VN') : '—'),
    },
    { key: 'cpu', label: 'CPU', get: (l: Laptop) => l.cpu.displayName },
    { key: 'gpu', label: 'GPU', get: (l: Laptop) => l.gpu.displayName },
    { key: 'ram', label: 'RAM', get: (l: Laptop) => `${l.ramGb} GB` },
    { key: 'ssd', label: 'SSD', get: (l: Laptop) => `${l.ssdGb} GB` },
    { key: 'screen', label: 'Màn hình', get: (l: Laptop) => `${formatInch(l.screenInch)}, ${l.refreshHz} Hz` },
    { key: 'weight', label: 'Trọng lượng', get: (l: Laptop) => formatKg(l.weightKg) },
  ];

  const columns = [
    { title: 'Thông số', dataIndex: 'label', key: 'label', fixed: 'left' as const },
    ...laptops.map((l) => ({
      title: l.name,
      dataIndex: l.id.toString(),
      key: l.id.toString(),
    })),
  ];

  const dataSource = rows.map((r) => ({
    key: r.key,
    label: r.label,
    ...Object.fromEntries(laptops.map((l) => [l.id.toString(), r.get(l)])),
  }));

  // Chua chon may nao (vao thang trang nay khong qua nut "+ So sanh") - phai huong dan cu the
  // thay vi hien bang trong troc loc, vi nguoi dung khong biet phai lam gi tiep theo.
  if (!ids || laptops.length === 0) {
    return (
      <div style={{ maxWidth: 1200, margin: '32px auto', padding: '0 16px' }}>
        <h1>So sánh laptop</h1>
        <Empty
          description={
            !ids
              ? 'Chưa chọn máy nào để so sánh.'
              : 'Đang tải dữ liệu so sánh, hoặc các máy đã chọn không còn tồn tại.'
          }
        >
          <Button type="primary" onClick={() => navigate('/catalog')}>
            Chọn máy trong danh mục
          </Button>
        </Empty>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1200, margin: '32px auto', padding: '0 16px' }}>
      <h1>So sánh laptop</h1>
      <Table columns={columns} dataSource={dataSource} pagination={false} scroll={{ x: true }} />
    </div>
  );
}
