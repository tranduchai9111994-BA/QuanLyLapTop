import { CrudTable } from '../../components/admin/CrudTable';

export function AdminBrands() {
  return (
    <CrudTable
      title="Hãng máy"
      endpoint="/brands"
      fields={[
        { key: 'id', label: 'ID', type: 'number', hideInForm: true },
        { key: 'name', label: 'Tên hãng', type: 'text', required: true },
      ]}
    />
  );
}
