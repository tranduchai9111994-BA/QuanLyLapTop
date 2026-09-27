import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middlewares/auth';
import * as authService from './auth.service';

export const authRouter = Router();

const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1) });
const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6, 'Mật khẩu phải có ít nhất 6 ký tự'),
  fullName: z.string().min(1, 'Vui lòng nhập họ tên'),
});

authRouter.post('/login', async (req, res, next) => {
  try {
    const body = loginSchema.parse(req.body);
    const data = await authService.login(body.email, body.password);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

// UC-07: dang ky tai khoan khach hang - khong yeu cau dang nhap (nguoc voi /me/* ben duoi).
authRouter.post('/register', async (req, res, next) => {
  try {
    const body = registerSchema.parse(req.body);
    const data = await authService.register(body.email, body.password, body.fullName);
    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

authRouter.get('/me', requireAuth, async (req, res, next) => {
  try {
    const data = await authService.getMe(req.user!.id);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});
