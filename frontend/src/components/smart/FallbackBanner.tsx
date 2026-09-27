import { Alert } from 'antd';

/** Hien khi backend phai dung CHE DO DU PHONG (ML service khong phan hoi - vd dang restart) -
 * xep hang tam theo performanceIdx/valueIdx co san trong DB thay vi goi kNN that (xem
 * `mode: "FALLBACK"` trong recommend.service.ts). Nguoi dung van xem/so sanh duoc binh thuong,
 * chi khong co giai thich chi tiet tung tieu chi. */
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

/** Hien khi loc cung theo ngan sach nguoi dung chon tra ve QUA IT may (backend tu mo rong them
 * 10% ngoai ngan sach de van co du may cho kNN xep hang, thay vi tra ve danh sach rong). */
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
