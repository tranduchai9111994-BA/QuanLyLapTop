import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { requireAuth, requireRole } from '../../middlewares/auth';
import { AppError } from '../../middlewares/error';
import { fromJson } from '../../lib/json';
import { snapshotSync } from '../jobs/snapshotSync';
import { SEGMENTS } from '../laptops/segment.service';
import { buildLabelCsv } from './labelExport';

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
      locked: r.locked,
    }));
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

// Xuất nhãn đã duyệt ra CSV để chép vào dữ liệu huấn luyện Mô hình A. Mặc định chỉ lấy nhãn do người
// quyết định (ADMIN/RETAILER); `?all=1` lấy thêm nhãn do mô hình tự gán đủ tin cậy (dễ tự củng cố sai).
labelsRouter.get('/export', requireAuth, requireRole('ADMIN'), async (req, res, next) => {
  try {
    const rows = await prisma.segmentLabel.findMany({
      where: { status: 'VERIFIED', ...(req.query.all === '1' ? {} : { source: { in: ['ADMIN', 'RETAILER'] } }) },
      orderBy: { laptopId: 'asc' },
      include: { laptop: { include: { brand: true, cpu: true, gpu: true } } },
    });
    const day = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="nhan_da_duyet_${day}.csv"`);
    res.send(buildLabelCsv(rows));
  } catch (err) {
    next(err);
  }
});

const verifySchema = z.object({
  // Nhan cuoi cung - co the giu nguyen nhan AI da gan tam, hoac doi sang nhan khac
  segment: z.enum(SEGMENTS),
  // docs/08_FRONTEND_SPEC.md muc 11: "Khoa nhan, khong cho mo hinh thay doi" - khi bat, lan sua
  // laptop tiep theo (khong tu chon lai phan khuc) se GIU NGUYEN nhan nay thay vi de Mo hinh A
  // gan de (xem segment.service.ts applySegmentLabel, dieu kien `existing?.locked && !requested`).
  locked: z.boolean().optional(),
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
      data: {
        segment: body.segment,
        source: 'ADMIN',
        status: 'VERIFIED',
        verifiedById: req.user!.id,
        locked: body.locked ?? existing.locked,
      },
    });
    await snapshotSync();
    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
});
