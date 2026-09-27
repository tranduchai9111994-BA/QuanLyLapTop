import { CrudTable } from '../../components/admin/CrudTable';

// Cac truong DUNG CHUNG cho ca 2 man Benchmark CPU va GPU - luu diem PassMark THAT (khong phai
// mo phong) kem nguon tra cuu + ngay tra, de nhom co the doi chieu lai tren cpubenchmark.net/
// videocardbenchmark.net khi can (xem KET_QUA_THUC_NGHIEM.md muc 7 - han che can neu ro).
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
