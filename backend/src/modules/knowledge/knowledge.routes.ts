import { Router } from 'express';
import { prisma } from '../../lib/prisma';
import { requireAuth, requireRole } from '../../middlewares/auth';
import { toJson } from '../../lib/json';
import { AppError } from '../../middlewares/error';
import { writeAudit } from '../../lib/audit';

// 2 nhom API: "config" (cau hinh tri thuc dang key-value tuy y, vd nguong canh bao dashboard -
// luu JSON trong `valueJson` vi SQL Server khong ho tro kieu Json cua Prisma, xem lib/json.ts)
// va "pins" (CUA HANG chu dong GHIM/CAM 1 may cho 1 phan khuc - xem field `isPinned` o
// recommend.service.ts, hien thi "De xuat tu cua hang" thay vi "AI goi y" tren giao dien).
export const knowledgeRouter = Router();

knowledgeRouter.get('/config/:key', requireAuth, requireRole('ADMIN'), async (req, res, next) => {
  try {
    const data = await prisma.knowledgeConfig.findUnique({ where: { key: req.params.key } });
    if (!data) throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy cấu hình');
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

knowledgeRouter.put('/config/:key', requireAuth, requireRole('ADMIN'), async (req, res, next) => {
  try {
    const data = await prisma.knowledgeConfig.upsert({
      where: { key: req.params.key },
      create: { key: req.params.key, valueJson: toJson(req.body.value), updatedBy: req.user!.id },
      update: { valueJson: toJson(req.body.value), updatedBy: req.user!.id },
    });
    await writeAudit({
      userId: req.user!.id,
      action: 'UPDATE_CONFIG',
      entity: 'KnowledgeConfig',
      entityId: req.params.key,
      detail: req.body.value,
    });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

knowledgeRouter.get('/pins', requireAuth, requireRole('ADMIN', 'STAFF'), async (_req, res, next) => {
  try {
    res.json({ success: true, data: await prisma.laptopPin.findMany({ include: { laptop: true }, orderBy: { createdAt: 'desc' } }) });
  } catch (err) {
    next(err);
  }
});

knowledgeRouter.post('/pins', requireAuth, requireRole('ADMIN'), async (req, res, next) => {
  try {
    const { laptopId, action, segment, reason, expiresAt } = req.body;
    const data = await prisma.laptopPin.create({
      data: { laptopId, action, segment, reason, expiresAt: expiresAt ? new Date(expiresAt) : null, createdBy: req.user!.id },
    });
    await writeAudit({
      userId: req.user!.id,
      action: action === 'BAN' ? 'BAN_LAPTOP' : 'PIN_LAPTOP',
      entity: 'LaptopPin',
      entityId: data.id,
      detail: { laptopId, action, segment, reason },
    });
    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

knowledgeRouter.delete('/pins/:id', requireAuth, requireRole('ADMIN'), async (req, res, next) => {
  try {
    const pin = await prisma.laptopPin.delete({ where: { id: Number(req.params.id) } });
    await writeAudit({
      userId: req.user!.id,
      action: 'UNPIN_LAPTOP',
      entity: 'LaptopPin',
      entityId: pin.id,
      detail: { laptopId: pin.laptopId, action: pin.action },
    });
    res.json({ success: true, data: null });
  } catch (err) {
    next(err);
  }
});
