import { Router } from 'express';
import { requireAuth } from '../../middlewares/auth';
import { prisma } from '../../lib/prisma';

// Danh sach "yeu thich" cua NGUOI DUNG DA DANG NHAP (khac voi so sanh - chi luu tren trinh
// duyet, khong can dang nhap). `upsert` o POST: bam "yeu thich" 1 may da co san se khong bao
// loi trung, chi coi nhu khong doi gi (idempotent).
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

// Lich su TU VAN cua nguoi dung da dang nhap (moi lan bam "Xem ket qua" o Wizard tao 1
// RecommendationSession) - de nguoi dung xem lai cac lan tu van truoc, khong can lam lai tu dau.
export const sessionsRouter = Router();

sessionsRouter.get('/', requireAuth, async (req, res, next) => {
  try {
    const data = await prisma.recommendationSession.findMany({
      where: { userId: req.user!.id },
      orderBy: { createdAt: 'desc' },
      take: 20,
      // Include day du quan he cua laptop (khong chi cac truong vo huong) - man Lich su tu van
      // (History.tsx) tai dung lai RecommendationCard, component nay doc laptop.cpu.displayName/
      // laptop.gpu.displayName/laptop.brand/laptop.segmentLabel nen thieu quan he nao se vo bao
      // loi "Cannot read properties of undefined".
      include: {
        items: {
          include: { laptop: { include: { brand: true, cpu: true, gpu: true, segmentLabel: true } } },
          orderBy: { rank: 'asc' },
        },
      },
    });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});
