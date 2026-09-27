import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';

/** Loi "co chu dich" - moi route nem AppError khi biet CHINH XAC ma loi/thong bao/status code
 * nao can tra ve (vd khong tim thay, sai quyen, du lieu trung). Loi KHONG PHAI AppError (vd loi
 * Prisma, loi lap trinh) se roi xuong nhanh "else" 500 chung o `errorHandler` ben duoi. */
export class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string
  ) {
    super(message);
  }
}

/** Bat moi request KHONG khop route nao (phai dat SAU tat ca `app.use('/api/...')` trong
 * app.ts) - tra JSON 404 nhat quan thay vi trang HTML mac dinh cua Express. */
export function notFoundHandler(_req: Request, res: Response) {
  res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Không tìm thấy tài nguyên' } });
}

/** Middleware xu ly loi TAP TRUNG (phai dat SAU CUNG trong app.ts, sau moi router) - MOI route
 * chi can `next(err)` khi bat duoc loi, khong can tu viet res.json rieng cho tung noi. Phan
 * biet 3 loai: AppError (loi co chu dich, tra dung status/message da khai bao), ZodError (loi
 * validate dau vao - luon tra 400 kem chi tiet tung truong sai trong `details`), con lai (loi
 * khong luong truoc duoc) tra 500 chung chung + log ra console de debug. */
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ success: false, error: { code: err.code, message: err.message } });
  }
  if (err instanceof ZodError) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Dữ liệu gửi lên không hợp lệ', details: err.issues },
    });
  }
  // eslint-disable-next-line no-console
  console.error(err);
  return res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Có lỗi hệ thống, vui lòng thử lại sau' } });
}
