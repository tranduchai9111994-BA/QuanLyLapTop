import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { requireAuth, requireRole } from '../../middlewares/auth';
import { AppError } from '../../middlewares/error';
import { fromJson } from '../../lib/json';
import { snapshotSync } from '../jobs/snapshotSync';
import { SEGMENTS } from '../laptops/segment.service';

/**
 * UC-10: hàng đợi nhãn "Cần xác minh" (human-in-the-loop, docs/09_VONG_DOI_TRI_TUE.md).
 *
 * Khi Mô hình A tự gán nhãn cho máy mới nhưng độ tin cậy dưới ngưỡng, `segment.service.ts` đặt
 * `status = NEEDS_REVIEW` thay vì chặn việc lưu máy (máy vẫn được gợi ý tạm bằng nhãn đó - xem
 * ghi chú trong segment.service.ts). Màn này cho nhân viên/quản trị viên xem lại TỪNG máy đang
 * chờ, kèm đầy đủ căn cứ (xác suất từng lớp), rồi DUYỆT (giữ nguyên) hoặc SỬA nhãn.
 */
export const labelsRouter = Router();

labelsRouter.get('/review-queue', requireAuth, requireRole('STAFF', 'ADMIN'), async (_req, res, next) => {
  try {
    const rows = await prisma.segmentLabel.findMany({
      where: { status: 'NEEDS_REVIEW' },
      orderBy: { updatedAt: 'asc' }, // may cho lau nhat hien truoc - tranh bi "ngam" mai trong hang doi
      include: { laptop: { include: { brand: true, cpu: true, gpu: true } } },
    });
    const data = rows.map((r) => ({
      laptopId: r.laptopId,
      laptop: r.laptop,
      segment: r.segment,
      confidence: r.confidence,
      distribution: fromJson<Record<string, number>>(r.probaJson, {}),
      predictedBy: r.predictedBy,
      waitingSince: r.updatedAt,
    }));
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

const verifySchema = z.object({
  // Nhan cuoi cung - co the giu nguyen nhan AI da gan tam, hoac doi sang nhan khac
  segment: z.enum(SEGMENTS),
});

labelsRouter.patch('/review-queue/:laptopId', requireAuth, requireRole('STAFF', 'ADMIN'), async (req, res, next) => {
  try {
    const laptopId = Number(req.params.laptopId);
    const body = verifySchema.parse(req.body);
    const existing = await prisma.segmentLabel.findUnique({ where: { laptopId } });
    if (!existing) throw new AppError(404, 'NOT_FOUND', 'Máy này chưa có nhãn nào để duyệt.');

    // Giu lai confidence/predictedBy CU de sau nay con biet AI tung du doan gi luc dau (lich su),
    // chi doi status + nguon + nguoi duyet. Neu nhan vien SUA sang khac AI thi nguon la ADMIN,
    // giu nguyen nhan AI van tinh la ADMIN (chinh nguoi nay xac nhan, khong con la "MODEL tu dong").
    const updated = await prisma.segmentLabel.update({
      where: { laptopId },
      data: { segment: body.segment, source: 'ADMIN', status: 'VERIFIED', verifiedById: req.user!.id },
    });
    await snapshotSync();
    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
});
