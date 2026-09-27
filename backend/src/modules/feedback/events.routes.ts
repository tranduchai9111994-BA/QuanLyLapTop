import { Router } from 'express';
import { z } from 'zod';
import { optionalAuth } from '../../middlewares/auth';
import { prisma } from '../../lib/prisma';

// Ghi lai HANH VI nguoi dung (xem may/thich/khong thich/them so sanh/them yeu thich) - day la
// nguon du lieu de "hoc tu phan hoi" (xem retrain_from_feedback trong ml-service) va tinh KPI
// dashboard (ty le thich). `optionalAuth`: khach chua dang nhap van ghi duoc (userId = null),
// vi phan lon nguoi dung KHONG dang nhap khi duyet web.
export const eventsRouter = Router();

const eventSchema = z.object({
  sessionId: z.string().optional(),
  laptopId: z.number(),
  type: z.enum(['VIEW_DETAIL', 'LIKE', 'DISLIKE', 'ADD_COMPARE', 'ADD_FAVORITE']),
  reason: z.enum(['TOO_EXPENSIVE', 'TOO_HEAVY', 'WEAK_PERFORMANCE', 'POOR_DISPLAY', 'BRAND', 'OTHER']).optional(),
  note: z.string().optional(),
});

eventsRouter.post('/', optionalAuth, async (req, res, next) => {
  try {
    const body = eventSchema.parse(req.body);
    const event = await prisma.interactionEvent.create({
      data: { ...body, userId: req.user?.id },
    });
    res.json({ success: true, data: event });
  } catch (err) {
    next(err);
  }
});
