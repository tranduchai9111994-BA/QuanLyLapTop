import { Router } from 'express';
import { prisma } from '../../lib/prisma';
import { requireAuth, requireRole } from '../../middlewares/auth';
import { fromJson } from '../../lib/json';

export const dashboardRouter = Router();

/** Cac chi so tong quan cho man Dashboard quan tri, tinh trong 1 KHOANG THOI GIAN (mac dinh 30
 * ngay gan nhat neu khong truyen from/to). `fallbackRate` cao bat thuong bao hieu ML service hay
 * bi loi/qua tai; `likeRate` do muc do hai long thuc te cua nguoi dung voi goi y. */
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

/** Cac CAU NHU CAU THAT nguoi dung da go, kem nhan Mo hinh C suy ra, CHI lay nhung phien co
 * phan hoi 👍 (nguoi dung hai long) - dung lam du lieu hoc them cho Mo hinh C (tieu chi 3).
 * Khong lay phien 👎 vi nhan co the sai; cung khong tu tin vao du doan cua chinh minh. */
feedbackSummaryRouter.get('/need-texts', requireAuth, requireRole('ADMIN'), async (_req, res, next) => {
  try {
    const liked = await prisma.interactionEvent.findMany({
      where: { type: 'LIKE', sessionId: { not: null } },
      select: { sessionId: true },
      distinct: ['sessionId'],
    });
    const sessionIds = liked.map((e) => e.sessionId!).filter(Boolean);
    if (sessionIds.length === 0) return res.json({ success: true, data: [] });

    const sessions = await prisma.recommendationSession.findMany({
      where: { id: { in: sessionIds } },
      select: { needJson: true },
    });

    const seen = new Set<string>();
    const data: { text: string; label: string }[] = [];
    for (const s of sessions) {
      const need = fromJson<{ needText?: string; needLabel?: string }>(s.needJson, {});
      if (!need.needText || !need.needLabel) continue;
      const key = need.needText.trim().toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      data.push({ text: need.needText.trim(), label: need.needLabel });
    }
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

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
