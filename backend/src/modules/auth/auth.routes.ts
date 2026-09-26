import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middlewares/auth';
import * as authService from './auth.service';

export const authRouter = Router();

const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1) });

authRouter.post('/login', async (req, res, next) => {
  try {
    const body = loginSchema.parse(req.body);
    const data = await authService.login(body.email, body.password);
    res.json({ success: true, data });
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
