import bcrypt from 'bcryptjs';
import { prisma } from '../../lib/prisma';
import { signToken } from '../../middlewares/auth';
import { AppError } from '../../middlewares/error';
import type { Role } from '../../constants/enums';

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

export async function getMe(userId: number) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy người dùng');
  return { id: user.id, email: user.email, fullName: user.fullName, role: user.role };
}
