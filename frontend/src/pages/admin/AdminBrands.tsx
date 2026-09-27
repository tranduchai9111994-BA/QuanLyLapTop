import { CrudTable } from '../../components/admin/CrudTable';

const TIER_OPTIONS = [
  { label: '1 - Giá rẻ, ít tên tuổi', value: 1 },
  { label: '2 - Bình dân', value: 2 },
  { label: '3 - Trung bình', value: 3 },
  { label: '4 - Uy tín, phổ biến', value: 4 },
  { label: '5 - Cao cấp, thương hiệu mạnh', value: 5 },
];

export function AdminBrands() {
  return (
    <CrudTable
      title="Hãng máy"
      endpoint="/brands"
      fields={[
        { key: 'id', label: 'ID', type: 'number', hideInForm: true },
        { key: 'name', label: 'Tên hãng', type: 'text', required: true },
        {
          key: 'tier',
          label: 'Mức uy tín',
          type: 'select',
          required: true,
          options: TIER_OPTIONS,
          help: 'Dùng làm đặc trưng "brand_tier" trong mô hình kNN gợi ý (Mô hình B) - ảnh hưởng thật đến xếp hạng, không chỉ để hiển thị.',
        },
      ]}
    />
  );
}
