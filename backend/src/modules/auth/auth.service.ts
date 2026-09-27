import bcrypt from 'bcryptjs';
import { prisma } from '../../lib/prisma';
import { signToken } from '../../middlewares/auth';
import { AppError } from '../../middlewares/error';
import type { Role } from '../../constants/enums';

/** Kiem tra email + mat khau, tra ve JWT neu dung. Co tinh dung 1 THONG BAO LOI chung chung
 * ("Email hoặc mật khẩu không đúng") cho ca 2 truong hop sai email VA sai mat khau - khong noi
 * ro "email khong ton tai" de tranh lo lieu tai khoan nao co that trong he thong (bao mat co ban). */
export async function login(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.isActive) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Email hoặc mật khẩu không đúng');
  }
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Email hoặc mật khẩu không đúng');
  }
  const token = signToken({ id: user.id, role: user.role as Role, email: user.email });
  return { token, user: { id: user.id, email: user.email, fullName: user.fullName, role: user.role } };
}

/** Dang ky tai khoan KHACH HANG moi (UC-07) - luon gan role CUSTOMER, khong cho tu chon role
 * qua API cong khai nay (STAFF/ADMIN chi tao duoc qua seed/man quan tri noi bo, xem UC-16). Tra
 * ve JWT ngay (tu dong dang nhap sau khi dang ky thanh cong) de nguoi dung khong phai dang nhap
 * lai lan nua. */
export async function register(email: string, password: string, fullName: string) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new AppError(409, 'EMAIL_TAKEN', 'Email này đã được đăng ký. Hãy đăng nhập hoặc dùng email khác.');
  }
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { email, passwordHash, fullName, role: 'CUSTOMER' },
  });
  const token = signToken({ id: user.id, role: user.role as Role, email: user.email });
  return { token, user: { id: user.id, email: user.email, fullName: user.fullName, role: user.role } };
}

export async function getMe(userId: number) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy người dùng');
  return { id: user.id, email: user.email, fullName: user.fullName, role: user.role };
}
