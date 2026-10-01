import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import type { Role } from '../constants/enums';
import { AppError } from './error';
import { env } from '../config/env';

const JWT_SECRET = env.jwtSecret;

export interface AuthUser {
  id: number;
  role: Role;
  email: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

/** Ký (sign) 1 JWT chứa id/role/email - hết hạn sau 8 giờ nên người dùng phải đăng nhập lại
 * định kỳ, không cần cơ chế refresh token riêng cho quy mô đồ án này. */
export function signToken(user: AuthUser): string {
  return jwt.sign(user, JWT_SECRET, { expiresIn: '8h' });
}

/** Middleware BẮT BUỘC đăng nhập - dùng cho các route CHỈ dành cho STAFF/ADMIN (CRUD, quản lý
 * giá,...). Thiếu header hoặc token hết hạn/sai đều ném lỗi 401 NGAY, không cho đi tiếp. */
export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    throw new AppError(401, 'UNAUTHORIZED', 'Vui lòng đăng nhập');
  }
  try {
    const payload = jwt.verify(header.slice(7), JWT_SECRET) as AuthUser;
    req.user = payload;
    next();
  } catch {
    throw new AppError(401, 'UNAUTHORIZED', 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn');
  }
}

/** Middleware KHÔNG BẮT BUỘC đăng nhập - dùng cho các route khách hàng cũng xem được (vd
 * GET /laptops) nhưng nếu CÓ đăng nhập thì vẫn muốn biết `req.user` là ai (vd để ghi nhận
 * "khách quen"). Token sai/hết hạn chỉ bị BỎ QUA IM LẶNG (coi như khách vãng lai), không báo lỗi -
 * khác hẳn `requireAuth` ở trên. */
export function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    try {
      req.user = jwt.verify(header.slice(7), JWT_SECRET) as AuthUser;
    } catch {
      // bỏ qua, coi như khách vãng lai
    }
  }
  next();
}

/** Middleware kiểm tra QUYỀN (phải đứng SAU `requireAuth` trong chuỗi middleware, vì cần
 * `req.user` đã được điền sẵn). Vd `requireRole('ADMIN')` chỉ cho ADMIN, còn
 * `requireRole('STAFF', 'ADMIN')` cho cả 2 vai trò cùng được phép. */
export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      throw new AppError(403, 'FORBIDDEN', 'Bạn không có quyền thực hiện thao tác này');
    }
    next();
  };
}
