import axios from 'axios';

// Client axios DÙNG CHUNG cho toàn bộ app (khách hàng lẫn quản trị) - mọi nơi gọi API đều import
// từ đây thay vì tự tạo axios riêng, để đảm bảo CÙNG 1 cấu hình (baseURL, timeout, token).
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api',
  timeout: 10_000,
});

// Tự động đính kèm token đăng nhập (nếu có) vào MỌI request gửi đi - nhờ vậy các trang quản trị
// (CrudTable, AdminPrices,...) không cần tự viết header Authorization ở từng nơi gọi riêng lẻ.
// Token được lưu trong localStorage từ lúc đăng nhập thành công (xem AdminLogin.tsx).
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('smartlap_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Hình dạng JSON CHUNG mà mọi API của backend trả về (xem backend/src/middlewares/error.ts và
// các route handler) - `success` báo có lỗi hay không, `data` là nội dung thật sự cần dùng,
// `meta` chỉ có ở các API phân trang (vd GET /laptops), `error` chỉ có khi thất bại.
export interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  meta?: { page: number; pageSize: number; total: number; totalPages: number };
  error?: { code: string; message: string };
}
