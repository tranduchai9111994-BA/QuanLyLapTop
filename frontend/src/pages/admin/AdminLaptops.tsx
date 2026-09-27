import { useEffect, useState } from 'react';
import { Spin } from 'antd';
import { api } from '../../lib/api';
import { CrudTable, type CrudField } from '../../components/admin/CrudTable';
import { SegmentSuggester } from '../../components/admin/SegmentSuggester';
import {
  NUMERIC_LIMITS,
  RAM_OPTIONS,
  REFRESH_HZ_OPTIONS,
  RESOLUTION_OPTIONS,
  SCREEN_INCH_OPTIONS,
  SSD_OPTIONS,
} from '../../constants/laptopSpecs';

const numOptions = (values: number[], suffix = '') =>
  values.map((v) => ({ label: `${v}${suffix}`, value: v }));

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
            help: 'Chọn từ bảng benchmark đã có — điểm PassMark lấy tự động',
            options: cpus.data.data.map((c: any) => ({ label: c.displayName, value: c.id })),
          },
          {
            key: 'gpuId',
            label: 'GPU',
            type: 'select',
            required: true,
            help: 'Chọn từ bảng benchmark đã có',
            options: gpus.data.data.map((g: any) => ({ label: g.displayName, value: g.id })),
          },
          // Cac thong so duoi day chi co mot tap gia tri chuan tren thi truong -> cho CHON,
          // khong cho go tay (truoc day go tay nen nhap duoc RAM = -2, SSD = 0).
          { key: 'ramGb', label: 'RAM (GB)', type: 'select', required: true, options: numOptions(RAM_OPTIONS) },
          { key: 'ssdGb', label: 'SSD (GB)', type: 'select', required: true, options: numOptions(SSD_OPTIONS) },
          {
            key: 'screenInch',
            label: 'Màn hình (inch)',
            type: 'select',
            required: true,
            options: numOptions(SCREEN_INCH_OPTIONS, '"'),
          },
          {
            key: 'resolution',
            label: 'Độ phân giải',
            type: 'select',
            required: true,
            help: 'Chọn theo cặp để không nhập lệch tỉ lệ',
            options: RESOLUTION_OPTIONS.map((r) => ({ label: r.label, value: r.value })),
            hideInTable: true,
          },
          { key: 'resWidth', label: 'Rộng (px)', type: 'number', hideInForm: true },
          { key: 'resHeight', label: 'Cao (px)', type: 'number', hideInForm: true },
          {
            key: 'refreshHz',
            label: 'Tần số quét (Hz)',
            type: 'select',
            options: numOptions(REFRESH_HZ_OPTIONS, ' Hz'),
          },
          { key: 'srgb100', label: 'sRGB 100%', type: 'boolean' },
          { key: 'weightKg', label: 'Trọng lượng (kg)', type: 'number', required: true, ...NUMERIC_LIMITS.weightKg },
          { key: 'batteryWh', label: 'Pin (Wh)', type: 'number', ...NUMERIC_LIMITS.batteryWh },
          { key: 'priceVnd', label: 'Giá (VND)', type: 'number', required: true, ...NUMERIC_LIMITS.priceVnd },
        ]);
      }
    );
  }, []);

  if (!fields) return <Spin />;
  return (
    <CrudTable
      title="Laptop"
      endpoint="/laptops"
      listEndpoint="/laptops?pageSize=1000"
      fields={fields}
      renderFormExtra={(form) => <SegmentSuggester form={form} />}
      // Form dung o `resolution` dang "2560x1440" cho de chon; backend nhan resWidth/resHeight
      transformSubmit={(values) => {
        const { resolution, ...rest } = values;
        if (!resolution) return rest;
        const [w, h] = String(resolution).split('x').map(Number);
        return { ...rest, resWidth: w, resHeight: h };
      }}
      // Khi sua: dung resWidth/resHeight co san de chon dung muc trong danh sach do phan giai
      transformEdit={(row) => ({ ...row, resolution: `${row.resWidth}x${row.resHeight}` })}
    />
  );
}
