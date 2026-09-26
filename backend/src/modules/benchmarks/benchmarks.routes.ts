import { Router } from 'express';
import { prisma } from '../../lib/prisma';
import { requireAuth, requireRole } from '../../middlewares/auth';

export const benchmarksRouter = Router();

benchmarksRouter.get('/cpu', async (_req, res, next) => {
  try {
    res.json({ success: true, data: await prisma.cpuBenchmark.findMany({ orderBy: { score: 'desc' } }) });
  } catch (err) {
    next(err);
  }
});

benchmarksRouter.post('/cpu', requireAuth, requireRole('ADMIN'), async (req, res, next) => {
  try {
    const data = await prisma.cpuBenchmark.create({ data: { ...req.body, checkedAt: new Date(req.body.checkedAt) } });
    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

benchmarksRouter.get('/gpu', async (_req, res, next) => {
  try {
    res.json({ success: true, data: await prisma.gpuBenchmark.findMany({ orderBy: { score: 'desc' } }) });
  } catch (err) {
    next(err);
  }
});

benchmarksRouter.post('/gpu', requireAuth, requireRole('ADMIN'), async (req, res, next) => {
  try {
    const data = await prisma.gpuBenchmark.create({ data: { ...req.body, checkedAt: new Date(req.body.checkedAt) } });
    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
});
