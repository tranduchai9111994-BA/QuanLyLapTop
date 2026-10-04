import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { env } from '../config/env';

// Client axios để backend gọi sang ML service (Python/FastAPI, cổng 8001).
const ML_SERVICE_URL = env.mlServiceUrl;
const ML_INTERNAL_KEY = env.mlInternalKey;

export const mlClient = axios.create({
  baseURL: ML_SERVICE_URL,
  // Timeout ngắn vì là gọi nội bộ: chậm hơn 3s là ML service có vấn đề, báo lỗi sớm để kịp
  // fallback (xem fallback.service.ts).
  timeout: 3000,
  headers: { 'X-Internal-Key': ML_INTERNAL_KEY },
});

// ML service giữ catalog trong RAM nên mất khi khởi động lại và trả 409 "chưa đồng bộ". Interceptor
// tự đồng bộ lại rồi gọi lại request đó 1 lần; import() động để tránh vòng import với
// snapshotSync.ts; các request 409 đồng thời dùng chung 1 lần đồng bộ (`resyncing`).
let resyncing: Promise<unknown> | null = null;
mlClient.interceptors.response.use(undefined, async (error: AxiosError) => {
  const config = error.config as (InternalAxiosRequestConfig & { _resynced?: boolean }) | undefined;
  if (error.response?.status === 409 && config && !config._resynced) {
    config._resynced = true;
    resyncing ??= import('../modules/jobs/snapshotSync')
      .then((m) => m.snapshotSync())
      .finally(() => {
        resyncing = null;
      });
    if (await resyncing) return mlClient.request(config);
  }
  throw error;
});

/** Lỗi đánh dấu "gọi ML service thất bại", để phân biệt với lỗi CSDL/logic khi quyết định fallback. */
export class MlServiceError extends Error {}
