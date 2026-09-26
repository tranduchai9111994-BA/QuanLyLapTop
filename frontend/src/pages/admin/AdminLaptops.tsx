import { useEffect, useState } from 'react';
import { Spin } from 'antd';
import { api } from '../../lib/api';
import { CrudTable, type CrudField } from '../../components/admin/CrudTable';

export function AdminLaptops() {
  const [fields, setFields] = useState<CrudField[] | null>(null);

  useEffect(() => {
    Promise.all([api.get('/brands'), api.get('/benchmarks/cpu'), api.get('/benchmarks/gpu')]).then(
      ([brands, cpus, gpus]) => {
        setFields([
          { key: 'id', label: 'ID', type: 'number', hideInForm: true },
          { key: 'sku', label: 'Mã SKU', type: 'text', required: true },
          { key: 'name', label: 'Tên máy', type: 'text', required: true },
          {
            key: 'brandId',
            label: 'Hãng',
            type: 'select',
            required: true,
            options: brands.data.data.map((b: any) => ({ label: b.name, value: b.id })),
          },
          {
            key: 'cpuId',
            label: 'CPU',
            type: 'select',
            required: true,
            options: cpus.data.data.map((c: any) => ({ label: c.displayName, value: c.id })),
          },
          {
            key: 'gpuId',
            label: 'GPU',
            type: 'select',
            required: true,
            options: gpus.data.data.map((g: any) => ({ label: g.displayName, value: g.id })),
          },
          { key: 'ramGb', label: 'RAM (GB)', type: 'number', required: true },
          { key: 'ssdGb', label: 'SSD (GB)', type: 'number', required: true },
          { key: 'screenInch', label: 'Màn hình (inch)', type: 'number', required: true },
          { key: 'resWidth', label: 'Độ phân giải rộng', type: 'number', required: true },
          { key: 'resHeight', label: 'Độ phân giải cao', type: 'number', required: true },
          { key: 'refreshHz', label: 'Tần số quét (Hz)', type: 'number' },
          { key: 'srgb100', label: 'sRGB 100%', type: 'boolean' },
          { key: 'weightKg', label: 'Trọng lượng (kg)', type: 'number', required: true },
          { key: 'batteryWh', label: 'Pin (Wh)', type: 'number' },
          { key: 'priceVnd', label: 'Giá (VND)', type: 'number', required: true },
        ]);
      }
    );
  }, []);

  if (!fields) return <Spin />;
  return <CrudTable title="Laptop" endpoint="/laptops" listEndpoint="/laptops?pageSize=500" fields={fields} />;
}
