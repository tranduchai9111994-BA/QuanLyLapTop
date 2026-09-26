import { CrudTable } from '../../components/admin/CrudTable';

const COMMON_FIELDS = [
  { key: 'id', label: 'ID', type: 'number' as const, hideInForm: true },
  { key: 'pattern', label: 'Mã tra cứu (pattern)', type: 'text' as const, required: true },
  { key: 'displayName', label: 'Tên hiển thị', type: 'text' as const, required: true },
  { key: 'rawScore', label: 'Điểm PassMark thô', type: 'number' as const, required: true },
  { key: 'score', label: 'Điểm chuẩn hóa (0-100)', type: 'number' as const, required: true },
  { key: 'source', label: 'Nguồn tra cứu', type: 'text' as const, required: true },
  { key: 'checkedAt', label: 'Ngày tra (ISO)', type: 'text' as const, required: true },
];

export function AdminCpuBenchmark() {
  return <CrudTable title="Benchmark CPU" endpoint="/benchmarks/cpu" fields={COMMON_FIELDS} />;
}

export function AdminGpuBenchmark() {
  return (
    <CrudTable
      title="Benchmark GPU"
      endpoint="/benchmarks/gpu"
      fields={[
        ...COMMON_FIELDS,
        { key: 'dedicated', label: 'Card rời', type: 'boolean' },
        { key: 'vramGb', label: 'VRAM (GB)', type: 'number' },
      ]}
    />
  );
}
