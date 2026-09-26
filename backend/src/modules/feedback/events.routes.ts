import { Router } from 'express';
import { z } from 'zod';
import { optionalAuth } from '../../middlewares/auth';
import { prisma } from '../../lib/prisma';

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
