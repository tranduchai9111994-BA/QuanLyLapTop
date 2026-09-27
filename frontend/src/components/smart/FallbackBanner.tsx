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
 * 10% ngoai ngan sach de van co du may cho kNN xep hang, thay vi tra ve danh sach rong).
 * `count` (FR-02): so may THAT SU thoa dieu kien ban dau, de nguoi dung hieu ro vi sao he thong
 * phai noi rong thay vi 1 cau chung chung. */
export function BudgetRelaxedBanner({ count }: { count: number }) {
  return (
    <Alert
      type="info"
      showIcon
      message={`Chỉ có ${count} máy thỏa điều kiện trong ngân sách bạn chọn nên hệ thống đã mở rộng thêm 10%.`}
      style={{ marginBottom: 16 }}
    />
  );
}
