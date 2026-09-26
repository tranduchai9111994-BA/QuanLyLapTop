import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Table } from 'antd';
import { api } from '../lib/api';
import type { Laptop } from '../types';
import { formatVnd, formatKg, formatInch } from '../utils/format';

export function Compare() {
  const [params] = useSearchParams();
  const ids = params.get('ids') ?? '';
  const [laptops, setLaptops] = useState<Laptop[]>([]);

  useEffect(() => {
    if (!ids) return;
    api.get(`/laptops/compare?ids=${ids}`).then((r) => setLaptops(r.data.data));
  }, [ids]);

  const rows = [
    { key: 'name', label: 'Tên máy', get: (l: Laptop) => l.name },
    { key: 'price', label: 'Giá', get: (l: Laptop) => formatVnd(l.priceVnd) },
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

  return (
    <div style={{ maxWidth: 1000, margin: '32px auto', padding: '0 16px' }}>
      <h1>So sánh laptop</h1>
      <Table columns={columns} dataSource={dataSource} pagination={false} scroll={{ x: true }} />
    </div>
  );
}
