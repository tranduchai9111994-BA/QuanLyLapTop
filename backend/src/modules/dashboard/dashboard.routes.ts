import { Router } from 'express';
import { prisma } from '../../lib/prisma';
import { requireAuth, requireRole } from '../../middlewares/auth';

export const dashboardRouter = Router();

dashboardRouter.get('/kpis', requireAuth, requireRole('ADMIN'), async (req, res, next) => {
  try {
    const from = req.query.from ? new Date(String(req.query.from)) : new Date(Date.now() - 30 * 86_400_000);
    const to = req.query.to ? new Date(String(req.query.to)) : new Date();
    const where = { createdAt: { gte: from, lte: to } };

    const [totalSessions, fallbackSessions, avgLatency, likeCount, dislikeCount] = await Promise.all([
      prisma.recommendationSession.count({ where }),
      prisma.recommendationSession.count({ where: { ...where, isFallback: true } }),
      prisma.recommendationSession.aggregate({ where, _avg: { latencyMs: true } }),
      prisma.interactionEvent.count({ where: { ...where, type: 'LIKE' } }),
      prisma.interactionEvent.count({ where: { ...where, type: 'DISLIKE' } }),
    ]);

    const feedbackTotal = likeCount + dislikeCount;
    res.json({
      success: true,
      data: {
        totalSessions,
        fallbackRate: totalSessions ? fallbackSessions / totalSessions : 0,
        avgLatencyMs: avgLatency._avg.latencyMs ?? 0,
        likeRate: feedbackTotal ? likeCount / feedbackTotal : null,
        likeCount,
        dislikeCount,
      },
    });
  } catch (err) {
    next(err);
  }
});

dashboardRouter.get('/alerts', requireAuth, requireRole('ADMIN'), async (_req, res, next) => {
  try {
    const data = await prisma.alertLog.findMany({ where: { resolved: false }, orderBy: { createdAt: 'desc' }, take: 50 });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

export const feedbackSummaryRouter = Router();

feedbackSummaryRouter.get('/summary', requireAuth, requireRole('ADMIN'), async (req, res, next) => {
  try {
    const where: any = {};
    if (req.query.from || req.query.to) {
      where.createdAt = {};
      if (req.query.from) where.createdAt.gte = new Date(String(req.query.from));
      if (req.query.to) where.createdAt.lte = new Date(String(req.query.to));
    }
    const grouped = await prisma.interactionEvent.groupBy({
      by: ['type', 'reason'],
      where,
      _count: true,
    });
    res.json({ success: true, data: grouped });
  } catch (err) {
    next(err);
  }
});
