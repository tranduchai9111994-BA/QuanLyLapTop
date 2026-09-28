import { logger } from '../lib/logger';

/** Doc TOAN BO bien moi truong (.env) mot lan duy nhat tai day, thay vi de tung file tu doc
 * `process.env.XXX` rai rac (truoc day o server.ts, middlewares/auth.ts, lib/mlClient.ts). Loi
 * ich: (1) nhin vao file nay la biet du an can DUNG bao nhieu bien, khong phai grep rai rac;
 * (2) canh bao ngay luc khoi dong neu bien nhay cam (JWT_SECRET) dang dung gia tri mac dinh cho
 * dev - quen dat bien nay o production se ky secret bang 1 chuoi ai cung doan duoc, gia mao duoc
 * token dang nhap.
 *
 * KHONG bao gom DATABASE_URL: Prisma tu doc bien nay truc tiep tu `.env` qua khai bao
 * `env("DATABASE_URL")` trong schema.prisma, khong di qua process.env trong code TypeScript. */

function readEnv(key: string, fallback: string, warnIfInsecureDefault = false): string {
  const value = process.env[key];
  if (value) return value;
  if (warnIfInsecureDefault) {
    logger.warn(`[config] Thiếu biến môi trường ${key} — đang dùng giá trị mặc định KHÔNG AN TOÀN cho production.`);
  }
  return fallback;
}

export const env = {
  port: Number(process.env.PORT ?? 4000),
  jwtSecret: readEnv('JWT_SECRET', 'dev-secret', true),
  mlServiceUrl: readEnv('ML_SERVICE_URL', 'http://localhost:8001'),
  mlInternalKey: readEnv('ML_INTERNAL_KEY', ''),
};
