import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { env } from '../config/env';

// Client axios rieng de GOI SANG ML service (Python/FastAPI, cong 8001) - tach khoi `api` cua
// frontend (do la client CUA trinh duyet goi VAO backend, con day la backend goi ra ML service).
const ML_SERVICE_URL = env.mlServiceUrl;
const ML_INTERNAL_KEY = env.mlInternalKey;

export const mlClient = axios.create({
  baseURL: ML_SERVICE_URL,
  // Timeout NGAN (3s, khac han 10s cua axios goi tu frontend) - vi day la goi NOI BO giua 2
  // service tren cung 1 may, cham hon 3s nghia la co van de that su (ML service treo/qua tai),
  // nen bao loi som de backend con kip fallback (xem fallback.service.ts) thay vi bat nguoi
  // dung cho lau.
  timeout: 3000,
  headers: { 'X-Internal-Key': ML_INTERNAL_KEY },
});

// ML service giữ catalog trong RAM nên mất sạch mỗi khi tiến trình ML khởi động lại; lúc đó mọi
// endpoint cần catalog trả 409 "chưa đồng bộ". Thay vì để từng nơi gọi tự xử lý (và rơi vào chế độ
// dự phòng), interceptor này tự đồng bộ lại catalog rồi gọi lại đúng request đó 1 lần. Dùng
// import() động để tránh vòng import (snapshotSync.ts cũng import mlClient). Nhiều request 409
// cùng lúc dùng chung 1 lần đồng bộ (`resyncing`).
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

/** Loi rieng danh dau "that bai vi goi ML service", de noi bat cu the phai phan biet duoc voi
 * loi CSDL/loi logic thong thuong khi quyet dinh co nen chuyen sang che do FALLBACK hay khong. */
export class MlServiceError extends Error {}
