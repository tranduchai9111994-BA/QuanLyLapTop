import { Router } from 'express';
import { z } from 'zod';
import { optionalAuth, requireAuth, requireRole } from '../../middlewares/auth';
import { AppError } from '../../middlewares/error';
import { prisma } from '../../lib/prisma';
import { mlClient } from '../../lib/mlClient';
import { snapshotSync } from '../jobs/snapshotSync';
import * as laptopsService from './laptops.service';

export const laptopsRouter = Router();

const laptopInputSchema = z.object({
  sku: z.string(),
  name: z.string(),
  brandId: z.number(),
  cpuId: z.number(),
  gpuId: z.number(),
  ramGb: z.number(),
  ramUpgradable: z.boolean().optional(),
  ssdGb: z.number(),
  screenInch: z.number(),
  resWidth: z.number(),
  resHeight: z.number(),
  refreshHz: z.number().optional(),
  srgb100: z.boolean().optional(),
  weightKg: z.number(),
  batteryWh: z.number().optional(),
  priceVnd: z.number(),
  imageUrl: z.string().optional(),
  sourceUrl: z.string().optional(),
});

async function computeAndUpsertLaptop(id: number | null, body: z.infer<typeof laptopInputSchema>) {
  const [cpu, gpu, agg] = await Promise.all([
    prisma.cpuBenchmark.findUniqueOrThrow({ where: { id: body.cpuId } }),
    prisma.gpuBenchmark.findUniqueOrThrow({ where: { id: body.gpuId } }),
    prisma.laptop.aggregate({ _max: { ramGb: true, ssdGb: true } }),
  ]);
  const ppi = laptopsService.computePpi(body.resWidth, body.resHeight, body.screenInch);
  const { performanceIdx, valueIdx } = laptopsService.computeIndices({
    cpuScore: cpu.score,
    gpuScore: gpu.score,
    ramGb: body.ramGb,
    ssdGb: body.ssdGb,
    priceVnd: body.priceVnd,
    maxRamGb: Math.max(agg._max.ramGb ?? body.ramGb, body.ramGb),
    maxSsdGb: Math.max(agg._max.ssdGb ?? body.ssdGb, body.ssdGb),
  });
  const data = { ...body, ppi, performanceIdx, valueIdx };
  if (id) {
    return prisma.laptop.update({ where: { id }, data });
  }
  return prisma.laptop.create({ data });
}

const listSchema = z.object({
  segment: z.string().optional(),
  brandIds: z
    .string()
    .optional()
    .transform((s) => (s ? s.split(',').map(Number) : undefined)),
  priceMin: z.coerce.number().optional(),
  priceMax: z.coerce.number().optional(),
  ramMin: z.coerce.number().optional(),
  weightMax: z.coerce.number().optional(),
  q: z.string().optional(),
  sort: z.enum(['price_asc', 'price_desc', 'perf_desc', 'value_desc']).optional(),
  page: z.coerce.number().optional(),
  pageSize: z.coerce.number().optional(),
});

laptopsRouter.get('/', optionalAuth, async (req, res, next) => {
  try {
    const query = listSchema.parse(req.query);
    const data = await laptopsService.listLaptops(query);
    res.json({ success: true, data: data.items, meta: data.meta });
  } catch (err) {
    next(err);
  }
});

laptopsRouter.get('/compare', async (req, res, next) => {
  try {
    const ids = String(req.query.ids ?? '')
      .split(',')
      .filter(Boolean)
      .map(Number);
    const data = await laptopsService.compareLaptops(ids);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

laptopsRouter.get('/:id', async (req, res, next) => {
  try {
    const data = await laptopsService.getLaptopDetail(Number(req.params.id));
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

laptopsRouter.post('/', requireAuth, requireRole('STAFF', 'ADMIN'), async (req, res, next) => {
  try {
    const body = laptopInputSchema.parse(req.body);
    const laptop = await computeAndUpsertLaptop(null, body);
    await snapshotSync();
    res.status(201).json({ success: true, data: laptop });
  } catch (err) {
    next(err);
  }
});

laptopsRouter.put('/:id', requireAuth, requireRole('STAFF', 'ADMIN'), async (req, res, next) => {
  try {
    const body = laptopInputSchema.parse(req.body);
    const laptop = await computeAndUpsertLaptop(Number(req.params.id), body);
    await snapshotSync();
    res.json({ success: true, data: laptop });
  } catch (err) {
    next(err);
  }
});

laptopsRouter.delete('/:id', requireAuth, requireRole('STAFF', 'ADMIN'), async (req, res, next) => {
  try {
    await prisma.laptop.update({ where: { id: Number(req.params.id) }, data: { isActive: false } });
    await snapshotSync();
    res.json({ success: true, data: null });
  } catch (err) {
    next(err);
  }
});

laptopsRouter.post('/predict-segment', requireAuth, requireRole('STAFF', 'ADMIN'), async (req, res, next) => {
  try {
    const { cpuId, gpuId, ramGb, ssdGb, screenInch, resWidth, resHeight, refreshHz, srgb100, weightKg, batteryWh } =
      req.body;
    const [cpu, gpu] = await Promise.all([
      prisma.cpuBenchmark.findUnique({ where: { id: cpuId } }),
      prisma.gpuBenchmark.findUnique({ where: { id: gpuId } }),
    ]);
    // Bao loi ro rang thay vi 500 chung chung: hay gap khi trang dang mo tu truoc luc nap lai
    // du lieu (ID trong dropdown da cu) - luc do nguoi dung chi can tai lai trang.
    if (!cpu || !gpu) {
      throw new AppError(
        404,
        'BENCHMARK_NOT_FOUND',
        'Không tìm thấy CPU/GPU đã chọn. Dữ liệu có thể vừa được cập nhật — hãy tải lại trang rồi chọn lại.'
      );
    }
    const ppi = laptopsService.computePpi(resWidth, resHeight, screenInch);
    const r = await mlClient.post('/predict-segment', {
      items: [
        {
          cpu_score: cpu.score,
          gpu_score: gpu.score,
          gpu_dedicated: gpu.dedicated ? 1 : 0,
          ram_gb: ramGb,
          ssd_gb: ssdGb,
          screen_inch: screenInch,
          ppi,
          refresh_hz: refreshHz ?? 60,
          srgb_100: srgb100 ? 1 : 0,
          weight_kg: weightKg,
          battery_wh: batteryWh ?? 55,
        },
      ],
    });
    res.json({ success: true, data: r.data.items[0] });
  } catch (err) {
    next(err);
  }
});

laptopsRouter.patch('/:id/segment', requireAuth, requireRole('STAFF', 'ADMIN'), async (req, res, next) => {
  try {
    const { segment, locked, note } = req.body;
    const data = await prisma.segmentLabel.upsert({
      where: { laptopId: Number(req.params.id) },
      create: { laptopId: Number(req.params.id), segment, source: 'ADMIN', status: 'VERIFIED', locked: !!locked, note },
      update: { segment, source: 'ADMIN', status: 'VERIFIED', locked: !!locked, note },
    });
    await snapshotSync();
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

laptopsRouter.get('/:id/similar', async (req, res, next) => {
  try {
    const k = Number(req.query.k ?? 6);
    const data = await laptopsService.getSimilarLaptops(Number(req.params.id), k);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});
