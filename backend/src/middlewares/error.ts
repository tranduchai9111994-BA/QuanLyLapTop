import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string
  ) {
    super(message);
  }
}

export function notFoundHandler(_req: Request, res: Response) {
  res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Không tìm thấy tài nguyên' } });
}

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
