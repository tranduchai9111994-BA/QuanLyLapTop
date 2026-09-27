import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { requireAuth, requireRole } from '../../middlewares/auth';

export const brandsRouter = Router();

// `tier` (1-5, 5 = uy tin nhat) la dac trung THAT su duoc Mo hinh B dung de xep hang (xem
// ml-service/app/retriever.py, nhom "brand") - khong phai chi de hien thi. Truoc day route nay
// CHI nhan/luu `name`, bo qua hoan toan `tier` du frontend co gui len - da phat hien qua CRUD
// test tren browser va sua lai o day.
const brandInputSchema = z.object({
  name: z.string().min(1, 'Tên hãng không được để trống').max(80),
  tier: z.number().int().min(1, 'Uy tín tối thiểu 1').max(5, 'Uy tín tối đa 5').optional(),
});

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
    const body = brandInputSchema.parse(req.body);
    // Khong truyen tier -> dung mac dinh cua schema Prisma (3 = trung binh)
    const data = await prisma.brand.create({ data: { name: body.name, ...(body.tier !== undefined ? { tier: body.tier } : {}) } });
    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

brandsRouter.put('/:id', requireAuth, requireRole('ADMIN'), async (req, res, next) => {
  try {
    const body = brandInputSchema.parse(req.body);
    const data = await prisma.brand.update({
      where: { id: Number(req.params.id) },
      data: { name: body.name, ...(body.tier !== undefined ? { tier: body.tier } : {}) },
    });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

brandsRouter.delete('/:id', requireAuth, requireRole('ADMIN'), async (req, res, next) => {
  try {
    await prisma.brand.delete({ where: { id: Number(req.params.id) } });
    res.json({ success: true, data: null });
  } catch (err) {
    next(err);
  }
});
