import { Router } from 'express';
import { prisma } from '../../lib/prisma';
import { requireAuth, requireRole } from '../../middlewares/auth';

export const brandsRouter = Router();

brandsRouter.get('/', async (_req, res, next) => {
  try {
    const data = await prisma.brand.findMany({ orderBy: { name: 'asc' } });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

brandsRouter.post('/', requireAuth, requireRole('ADMIN'), async (req, res, next) => {
  try {
    const data = await prisma.brand.create({ data: { name: req.body.name } });
    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
});
