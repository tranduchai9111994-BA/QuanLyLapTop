import { Router } from 'express';
import { prisma } from '../../lib/prisma';
import { requireAuth, requireRole } from '../../middlewares/auth';

// CRUD cho 2 bang benchmark THAT (CPU/GPU) - moi dong la 1 dong chip cu the kem diem PassMark
// da quy doi (0-100) va nguon tra cuu. Day la dau vao cho `cpu_score`/`gpu_score` cua ca Mo hinh
// A lan Mo hinh B (xem ml-service/app/features.py build_bench_lookup). GET khong yeu cau dang
// nhap (ai cung xem duoc bang tham khao), nhung POST/PUT/DELETE chi ADMIN moi duoc sua.
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

benchmarksRouter.put('/cpu/:id', requireAuth, requireRole('ADMIN'), async (req, res, next) => {
  try {
    const { pattern, displayName, rawScore, score, source, checkedAt } = req.body;
    const data = await prisma.cpuBenchmark.update({
      where: { id: Number(req.params.id) },
      data: { pattern, displayName, rawScore, score, source, checkedAt: checkedAt ? new Date(checkedAt) : undefined },
    });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

benchmarksRouter.delete('/cpu/:id', requireAuth, requireRole('ADMIN'), async (req, res, next) => {
  try {
    await prisma.cpuBenchmark.delete({ where: { id: Number(req.params.id) } });
    res.json({ success: true, data: null });
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

benchmarksRouter.put('/gpu/:id', requireAuth, requireRole('ADMIN'), async (req, res, next) => {
  try {
    const { pattern, displayName, rawScore, score, dedicated, vramGb, source, checkedAt } = req.body;
    const data = await prisma.gpuBenchmark.update({
      where: { id: Number(req.params.id) },
      data: {
        pattern,
        displayName,
        rawScore,
        score,
        dedicated,
        vramGb,
        source,
        checkedAt: checkedAt ? new Date(checkedAt) : undefined,
      },
    });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

benchmarksRouter.delete('/gpu/:id', requireAuth, requireRole('ADMIN'), async (req, res, next) => {
  try {
    await prisma.gpuBenchmark.delete({ where: { id: Number(req.params.id) } });
    res.json({ success: true, data: null });
  } catch (err) {
    next(err);
  }
});
