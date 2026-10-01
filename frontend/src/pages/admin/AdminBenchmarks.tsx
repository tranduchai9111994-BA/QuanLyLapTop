import { Alert } from 'antd';
import { CrudTable } from '../../components/admin/CrudTable';

// docs/08_FRONTEND_SPEC.md muc 12: canh bao khi SUA (khong phai them moi) diem benchmark - vi
// diem nay dung CHUNG cho MOI laptop dang gan CPU/GPU nay (computeIndices trong laptops.service.ts),
// sua se lam thay doi performanceIdx/valueIdx cua hang loat may cung luc, khong chi 1 dong dang sua.
function ScoreEditWarning(_form: unknown, isEdit: boolean) {
  if (!isEdit) return null;
  return (
    <Alert
      type="warning"
      showIcon
      style={{ marginBottom: 16 }}
      message="Thay đổi điểm sẽ ảnh hưởng mọi máy dùng linh kiện này"
      description="Điểm chuẩn hóa dùng chung để tính hiệu năng/độ đáng tiền cho tất cả laptop đang gắn linh kiện này — sửa sẽ cập nhật lại xếp hạng của toàn bộ các máy đó."
    />
  );
}

// Cac truong DUNG CHUNG cho ca 2 man Benchmark CPU va GPU - luu diem PassMark THAT (khong phai
// mo phong) kem nguon tra cuu + ngay tra, de nhom co the doi chieu lai tren cpubenchmark.net/
// videocardbenchmark.net khi can (xem docs/14_KET_QUA_THUC_NGHIEM.md muc 7 - han che can neu ro).
const COMMON_FIELDS = [
  { key: 'id', label: 'ID', type: 'number' as const, hideInForm: true },
  { key: 'pattern', label: 'Mã tra cứu (pattern)', type: 'text' as const, required: true },
  { key: 'displayName', label: 'Tên hiển thị', type: 'text' as const, required: true },
  { key: 'rawScore', label: 'Điểm PassMark thô', type: 'number' as const, required: true, thousands: true },
  { key: 'score', label: 'Điểm chuẩn hóa (0-100)', type: 'number' as const, required: true },
  { key: 'source', label: 'Nguồn tra cứu', type: 'text' as const, required: true },
  { key: 'checkedAt', label: 'Ngày tra (ISO)', type: 'text' as const, required: true },
];

export function AdminCpuBenchmark() {
  return (
    <CrudTable
      title="Benchmark CPU"
      endpoint="/benchmarks/cpu"
      fields={COMMON_FIELDS}
      renderFormExtra={ScoreEditWarning}
    />
  );
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
      renderFormExtra={ScoreEditWarning}
    />
  );
}
