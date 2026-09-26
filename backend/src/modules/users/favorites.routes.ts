import { Router } from 'express';
import { requireAuth } from '../../middlewares/auth';
import { prisma } from '../../lib/prisma';

export const favoritesRouter = Router();

favoritesRouter.get('/', requireAuth, async (req, res, next) => {
  try {
    const data = await prisma.favorite.findMany({
      where: { userId: req.user!.id },
      include: { laptop: { include: { brand: true, cpu: true, gpu: true, segmentLabel: true } } },
    });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

favoritesRouter.post('/', requireAuth, async (req, res, next) => {
  try {
    const laptopId = Number(req.body.laptopId);
    const data = await prisma.favorite.upsert({
      where: { userId_laptopId: { userId: req.user!.id, laptopId } },
      create: { userId: req.user!.id, laptopId },
      update: {},
    });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

favoritesRouter.delete('/:laptopId', requireAuth, async (req, res, next) => {
  try {
    await prisma.favorite.delete({
      where: { userId_laptopId: { userId: req.user!.id, laptopId: Number(req.params.laptopId) } },
    });
    res.json({ success: true, data: null });
  } catch (err) {
    next(err);
  }
});

export const sessionsRouter = Router();

sessionsRouter.get('/', requireAuth, async (req, res, next) => {
  try {
    const data = await prisma.recommendationSession.findMany({
      where: { userId: req.user!.id },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: { items: { include: { laptop: true } } },
    });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});
