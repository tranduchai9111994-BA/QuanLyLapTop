import { useEffect, useState } from 'react';
import { Spin, message } from 'antd';
import { segmentColors } from '../../theme/tokens';
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

// 4 phan khuc cho o chon "Phan khuc" (ma luu DB -> ten tieng Viet hien thi)
const SEGMENT_OPTIONS = ['OFFICE', 'ULTRABOOK', 'GAMING', 'CREATOR'].map((s) => ({
  label: segmentColors[s].label,
  value: s,
}));

/** Chuoi hien trong cot "Phan khuc" cua bang: ten phan khuc + danh dau neu dang cho xac minh
 * hoac chua co nhan (may chua co nhan se KHONG duoc goi y cho khach). Tra ve chuoi de o tim kiem
 * va file Excel xuat ra dung duoc luon. */
function segmentCell(row: any): string {
  const l = row.segmentLabel;
  if (!l) return 'Chưa có (chưa được gợi ý)';
  const name = segmentColors[l.segment]?.label ?? l.segment;
  return l.status === 'NEEDS_REVIEW' ? `${name} · cần xác minh` : name;
}

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
          {
            key: 'segment',
            label: 'Phân khúc',
            type: 'select',
            options: SEGMENT_OPTIONS,
            help: 'Bấm "AI gợi ý" để điền sẵn. Để trống thì AI tự gán khi lưu.',
            tableValue: segmentCell,
          },
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
      // Khi sua: dung resWidth/resHeight co san de chon dung muc trong danh sach do phan giai;
      // phan khuc nam trong segmentLabel nen phai lay ra de do vao o "Phan khuc"
      transformEdit={(row) => ({
        ...row,
        resolution: `${row.resWidth}x${row.resHeight}`,
        segment: row.segmentLabel?.segment,
      })}
      // Bao ro cho nhan vien nhan da duoc luu the nao (hoac vi sao chua gan duoc)
      afterSave={(saved) => {
        if (saved?.labelWarning) message.warning(saved.labelWarning, 6);
        else if (saved?.segmentLabel)
          message.info(`Đã gán phân khúc: ${segmentColors[saved.segmentLabel.segment]?.label ?? saved.segmentLabel.segment}`);
      }}
    />
  );
}
