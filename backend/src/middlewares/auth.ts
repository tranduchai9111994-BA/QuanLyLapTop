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

/** Ky (sign) 1 JWT chua id/role/email - het han sau 8 gio nen nguoi dung phai dang nhap lai
 * dinh ky, khong can co che refresh token rieng cho quy mo do an nay. */
export function signToken(user: AuthUser): string {
  return jwt.sign(user, JWT_SECRET, { expiresIn: '8h' });
}

/** Middleware BAT BUOC dang nhap - dung cho cac route CHI danh cho STAFF/ADMIN (CRUD, quan ly
 * gia,...). Thieu header hoac token het han/sai deu nem loi 401 NGAY, khong cho di tiep. */
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

/** Middleware KHONG BAT BUOC dang nhap - dung cho cac route khach hang cung xem duoc (vd
 * GET /laptops) nhung neu CO dang nhap thi van muon biet `req.user` la ai (vd de ghi nhan
 * "khach quen"). Token sai/het han chi bi BO QUA IM LANG (coi nhu khach vang lai), khong bao loi -
 * khac han `requireAuth` o tren. */
export function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    try {
      req.user = jwt.verify(header.slice(7), JWT_SECRET) as AuthUser;
    } catch {
      // bo qua, coi nhu khach vang lai
    }
  }
  next();
}

/** Middleware kiem tra QUYEN (phai dung SAU `requireAuth` trong chuoi middleware, vi can
 * `req.user` da duoc dien san). Vd `requireRole('ADMIN')` chi cho ADMIN, con
 * `requireRole('STAFF', 'ADMIN')` cho ca 2 vai tro cung duoc phep. */
export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      throw new AppError(403, 'FORBIDDEN', 'Bạn không có quyền thực hiện thao tác này');
    }
    next();
  };
}
