import { Alert } from 'antd';

export function FallbackBanner() {
  return (
    <Alert
      type="warning"
      showIcon
      message="Hệ thống AI đang bảo trì, kết quả được sắp xếp theo hiệu năng/giá. Bạn vẫn có thể xem và so sánh bình thường."
      style={{ marginBottom: 16 }}
    />
  );
}

export function BudgetRelaxedBanner() {
  return (
    <Alert
      type="info"
      showIcon
      message="Chỉ có ít máy trong ngân sách nên hệ thống đã mở rộng thêm 10%."
      style={{ marginBottom: 16 }}
    />
  );
}
