import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { requireAuth, requireRole } from '../../middlewares/auth';
import { AppError } from '../../middlewares/error';
import { writeAudit } from '../../lib/audit';

// UC-16 Quan ly nguoi dung (chi ADMIN): xem/tao/sua tai khoan NHAN VIEN va QUAN TRI VIEN. Tai
// khoan CUSTOMER (khach hang tu dang ky qua /auth/register) khong quan ly o day - man nay chi
// phuc vu noi bo cua hang. Khong co DELETE that su - "xoa" 1 tai khoan nhan vien nghia la
// isActive=false (khoa dang nhap), giu lai lich su audit/RecommendationSession gan voi ho.
export const usersRouter = Router();

const SELECT_FIELDS = { id: true, email: true, fullName: true, role: true, isActive: true, createdAt: true } as const;

usersRouter.get('/', requireAuth, requireRole('ADMIN'), async (_req, res, next) => {
  try {
    const data = await prisma.user.findMany({
      where: { role: { in: ['STAFF', 'ADMIN'] } },
      select: SELECT_FIELDS,
      orderBy: { createdAt: 'asc' },
    });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

const createSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6, 'Mật khẩu phải có ít nhất 6 ký tự'),
  fullName: z.string().min(1),
  role: z.enum(['STAFF', 'ADMIN']),
});

usersRouter.post('/', requireAuth, requireRole('ADMIN'), async (req, res, next) => {
  try {
    const body = createSchema.parse(req.body);
    const existing = await prisma.user.findUnique({ where: { email: body.email } });
    if (existing) throw new AppError(409, 'EMAIL_TAKEN', 'Email này đã được dùng cho tài khoản khác.');

    const passwordHash = await bcrypt.hash(body.password, 10);
    const user = await prisma.user.create({
      data: { email: body.email, passwordHash, fullName: body.fullName, role: body.role },
      select: SELECT_FIELDS,
    });
    await writeAudit({
      userId: req.user!.id,
      action: 'CREATE_USER',
      entity: 'User',
      entityId: user.id,
      detail: { email: user.email, role: user.role },
    });
    res.status(201).json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
});

const updateSchema = z.object({
  fullName: z.string().min(1).optional(),
  role: z.enum(['STAFF', 'ADMIN']).optional(),
  isActive: z.boolean().optional(),
  password: z.string().min(6).optional(),
});

usersRouter.patch('/:id', requireAuth, requireRole('ADMIN'), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const body = updateSchema.parse(req.body);

    // Khong cho tu khoa/tu ha quyen CHINH MINH - tranh tinh huong quan tri vien duy nhat tu
    // khoa tai khoan cua minh roi khong ai con quyen mo lai (phai nho ADMIN khac lam thay).
    if (id === req.user!.id && (body.isActive === false || (body.role && body.role !== 'ADMIN'))) {
      throw new AppError(400, 'CANNOT_MODIFY_SELF', 'Không thể tự khoá hoặc hạ quyền chính tài khoản đang đăng nhập.');
    }

    const data: Record<string, unknown> = {};
    if (body.fullName !== undefined) data.fullName = body.fullName;
    if (body.role !== undefined) data.role = body.role;
    if (body.isActive !== undefined) data.isActive = body.isActive;
    if (body.password) data.passwordHash = await bcrypt.hash(body.password, 10);

    const user = await prisma.user.update({ where: { id }, data, select: SELECT_FIELDS });
    await writeAudit({
      userId: req.user!.id,
      action: 'UPDATE_USER',
      entity: 'User',
      entityId: id,
      detail: { ...body, password: body.password ? '(đã đổi)' : undefined },
    });
    res.json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
});

export const auditLogsRouter = Router();

auditLogsRouter.get('/', requireAuth, requireRole('ADMIN'), async (req, res, next) => {
  try {
    const take = Math.min(Number(req.query.limit ?? 100), 200);
    const data = await prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take,
      include: { user: { select: { fullName: true, email: true } } },
    });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});
