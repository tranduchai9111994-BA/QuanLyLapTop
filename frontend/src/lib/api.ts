import axios from 'axios';

// Client axios DUNG CHUNG cho toan bo app (khach hang lan quan tri) - moi noi goi API deu import
// tu day thay vi tu tao axios rieng, de dam bao CUNG 1 cau hinh (baseURL, timeout, token).
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api',
  timeout: 10_000,
});

// Tu dong dinh kem token dang nhap (neu co) vao MOI request gui di - nho vay cac trang quan tri
// (CrudTable, AdminPrices,...) khong can tu viet header Authorization o tung noi goi rieng le.
// Token duoc luu trong localStorage tu luc dang nhap thanh cong (xem AdminLogin.tsx).
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('smartlap_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Hinh dang JSON CHUNG ma moi API cua backend tra ve (xem backend/src/middlewares/error.ts va
// cac route handler) - `success` bao co loi hay khong, `data` la noi dung that su can dung,
// `meta` chi co o cac API phan trang (vd GET /laptops), `error` chi co khi that bai.
export interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  meta?: { page: number; pageSize: number; total: number; totalPages: number };
  error?: { code: string; message: string };
}
