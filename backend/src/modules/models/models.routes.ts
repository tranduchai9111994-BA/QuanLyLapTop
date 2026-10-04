import { Router } from 'express';
import { prisma } from '../../lib/prisma';
import { requireAuth, requireRole } from '../../middlewares/auth';
import { AppError } from '../../middlewares/error';
import { mlClient } from '../../lib/mlClient';
import { toJson, fromJson } from '../../lib/json';
import { writeAudit } from '../../lib/audit';

// Quan ly VONG DOI MO HINH (docs/09_VONG_DOI_TRI_TUE.md): moi lan train ra 1 "challenger" (ung
// vien) - KHONG tu dong thay the mo hinh dang chay ("champion") ma phai qua buoc "promote" co
// KIEM QUY TAC ro rang (xem comment o /:version/promote ben duoi). "rollback" cho phep quay lai
// mot phien ban CU bat ky da tung la champion neu ban moi co van de.
export const modelsRouter = Router();

modelsRouter.get('/', requireAuth, requireRole('ADMIN'), async (_req, res, next) => {
  try {
    const data = await prisma.modelVersion.findMany({ orderBy: { trainedAt: 'desc' } });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

modelsRouter.get('/:version', requireAuth, requireRole('ADMIN'), async (req, res, next) => {
  try {
    const data = await prisma.modelVersion.findUnique({ where: { version: req.params.version } });
    if (!data) throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy phiên bản mô hình');
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

/** Dong bo (chay dong, vai giay voi ~300 mau - docs/06 §4). Trong production nen chay nen (jobId). */
modelsRouter.post('/train', requireAuth, requireRole('ADMIN'), async (req, res, next) => {
  try {
    const r = await mlClient.post('/train', { note: req.body?.note }, { timeout: 60_000 });
    const metadata = r.data.metadata;
    const version = await prisma.modelVersion.create({
      data: {
        version: metadata.version,
        type: 'CLASSIFIER',
        status: 'CHALLENGER',
        paramsJson: toJson(metadata.best_params),
        metricsJson: toJson({
          cv: { f1_macro_mean: metadata.cv_f1_macro_mean, f1_macro_std: metadata.cv_f1_macro_std },
          test: metadata.test_metrics,
          baseline: metadata.baseline,
          k_curve: metadata.k_curve,
        }),
        datasetHash: metadata.dataset_hash,
        nSamples: metadata.n_samples,
        trainedAt: new Date(metadata.trained_at),
        note: req.body?.note,
      },
    });
    res.json({ success: true, data: version });
  } catch (err) {
    next(err);
  }
});

/** Kiem quy tac truoc khi promote (docs/09 §2.3): challenger khong duoc te hon champion
 * qua 0.02 macro-F1 tren tap test dong bang, va macro-F1 tung lop >= 0.5. */
modelsRouter.post('/:version/promote', requireAuth, requireRole('ADMIN'), async (req, res, next) => {
  try {
    const challenger = await prisma.modelVersion.findUnique({ where: { version: req.params.version } });
    if (!challenger) throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy phiên bản mô hình');

    const champion = await prisma.modelVersion.findFirst({ where: { status: 'CHAMPION', type: 'CLASSIFIER' } });
    const challengerMetrics = fromJson<any>(challenger.metricsJson, {});
    const challengerF1 = challengerMetrics.test?.f1_macro ?? 0;

    if (champion) {
      const championMetrics = fromJson<any>(champion.metricsJson, {});
      const championF1 = championMetrics.test?.f1_macro ?? 0;
      if (challengerF1 < championF1 - 0.02) {
        throw new AppError(
          422,
          'PROMOTE_REJECTED',
          `Từ chối: macro-F1 challenger (${challengerF1.toFixed(3)}) thấp hơn champion (${championF1.toFixed(3)}) quá 0.02`
        );
      }
    }

    const perClassF1: Record<string, any> = challengerMetrics.test?.report ?? {};
    for (const [label, m] of Object.entries<any>(perClassF1)) {
      if (['accuracy', 'macro avg', 'weighted avg'].includes(label)) continue;
      if (m['f1-score'] < 0.5) {
        throw new AppError(422, 'PROMOTE_REJECTED', `Từ chối: lớp ${label} có F1 = ${m['f1-score'].toFixed(2)} < 0.5`);
      }
    }

    await mlClient.post(`/models/${challenger.version}/activate`);
    await prisma.$transaction([
      prisma.modelVersion.updateMany({ where: { status: 'CHAMPION' }, data: { status: 'ARCHIVED' } }),
      prisma.modelVersion.update({
        where: { id: challenger.id },
        data: { status: 'CHAMPION', promotedAt: new Date(), promotedById: req.user!.id },
      }),
    ]);
    await writeAudit({
      userId: req.user!.id,
      action: 'PROMOTE_MODEL',
      entity: 'ModelVersion',
      entityId: challenger.version,
      detail: { previousChampion: champion?.version ?? null, f1Macro: challengerF1 },
    });
    res.json({ success: true, data: { version: challenger.version } });
  } catch (err) {
    next(err);
  }
});

// Xóa 1 phiên bản dư (Ứng viên/đã lưu trữ): xóa thư mục artifacts bên ML rồi xóa dòng trong DB.
// Không cho xóa bản đang dùng (CHAMPION).
modelsRouter.delete('/:version', requireAuth, requireRole('ADMIN'), async (req, res, next) => {
  try {
    const target = await prisma.modelVersion.findUnique({ where: { version: req.params.version } });
    if (!target) throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy phiên bản mô hình');
    if (target.status === 'CHAMPION') {
      throw new AppError(409, 'CANNOT_DELETE_CHAMPION', 'Không xóa được bản đang dùng. Hãy đưa bản khác vào sử dụng trước.');
    }
    try {
      await mlClient.delete(`/models/${target.version}`);
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 409) throw new AppError(409, 'MODEL_IN_USE', 'Bản này đang được dịch vụ AI sử dụng, chưa xóa được.');
      if (status !== 404) throw err; // 404 = thư mục đã mất từ trước, vẫn tiếp tục xóa dòng trong DB
    }
    await prisma.modelVersion.delete({ where: { id: target.id } });
    await writeAudit({ userId: req.user!.id, action: 'DELETE_MODEL', entity: 'ModelVersion', entityId: target.version });
    res.json({ success: true, data: { version: target.version } });
  } catch (err) {
    next(err);
  }
});

modelsRouter.post('/:version/rollback', requireAuth, requireRole('ADMIN'), async (req, res, next) => {
  try {
    const target = await prisma.modelVersion.findUnique({ where: { version: req.params.version } });
    if (!target) throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy phiên bản mô hình');
    await mlClient.post(`/models/${target.version}/activate`);
    await prisma.$transaction([
      prisma.modelVersion.updateMany({ where: { status: 'CHAMPION' }, data: { status: 'ARCHIVED' } }),
      prisma.modelVersion.update({ where: { id: target.id }, data: { status: 'CHAMPION' } }),
    ]);
    await writeAudit({
      userId: req.user!.id,
      action: 'ROLLBACK_MODEL',
      entity: 'ModelVersion',
      entityId: target.version,
    });
    res.json({ success: true, data: { version: target.version } });
  } catch (err) {
    next(err);
  }
});
