import { Router } from 'express';
import { z } from 'zod';
import { optionalAuth, requireAuth, requireRole } from '../../middlewares/auth';
import { AppError } from '../../middlewares/error';
import { prisma } from '../../lib/prisma';
import { snapshotSync } from '../jobs/snapshotSync';
import * as laptopsService from './laptops.service';
import * as priceService from './price.service';
import { SEGMENTS, applySegmentLabel, predictSegment } from './segment.service';

export const laptopsRouter = Router();

// Giá trị chuẩn + ngưỡng hợp lệ, phải khớp frontend/src/constants/laptopSpecs.ts và
// ml-service/app/data_check.py. Đây là tuyến phòng thủ cuối: API tự chặn dữ liệu vô lý dù ai gọi.
const VALID_RAM = [4, 8, 12, 16, 24, 32, 64, 96, 128] as const;
const VALID_SSD = [128, 256, 512, 1024, 2048, 4096] as const;

const laptopInputSchema = z.object({
  sku: z.string().min(2, 'Mã SKU quá ngắn').max(80),
  name: z.string().min(2, 'Tên máy quá ngắn').max(200),
  // Các trường nullable thật trong Prisma trả về `null` (không phải `undefined`) khi đọc từ DB,
  // mà `.optional()` của zod chỉ nhận `undefined` -> phải dùng `.nullable().optional()`.
  series: z.string().max(80).nullable().optional(),
  brandId: z.number().int().positive(),
  cpuId: z.number().int().positive(),
  gpuId: z.number().int().positive(),
  ramGb: z
    .number()
    .int()
    .refine((v) => (VALID_RAM as readonly number[]).includes(v), {
      message: `RAM phải thuộc: ${VALID_RAM.join(', ')} GB`,
    }),
  ramUpgradable: z.boolean().optional(),
  ssdGb: z
    .number()
    .int()
    .refine((v) => (VALID_SSD as readonly number[]).includes(v), {
      message: `SSD phải thuộc: ${VALID_SSD.join(', ')} GB`,
    }),
  screenInch: z.number().min(10, 'Màn hình nhỏ hơn 10 inch là không hợp lệ').max(20),
  resWidth: z.number().int().min(1024).max(7680),
  resHeight: z.number().int().min(600).max(4320),
  // refreshHz có @default(60) nên không bao giờ null
  refreshHz: z.number().int().min(30).max(500).optional(),
  srgb100: z.boolean().optional(),
  weightKg: z.number().min(0.8, 'Trọng lượng tối thiểu 0,8 kg').max(4.5, 'Trọng lượng tối đa 4,5 kg'),
  batteryWh: z.number().min(20).max(120).nullable().optional(),
  priceVnd: z.number().int().min(3_000_000, 'Giá tối thiểu 3 triệu').max(200_000_000, 'Giá tối đa 200 triệu'),
  imageUrl: z.string().nullable().optional(),
  sourceUrl: z.string().nullable().optional(),
  // Không bắt buộc: bỏ trống thì Mô hình A tự gán (xem segment.service.ts). Lưu vào SegmentLabel.
  segment: z.enum(SEGMENTS).nullable().optional(),
});

async function computeAndUpsertLaptop(id: number | null, input: z.infer<typeof laptopInputSchema>) {
  // Tách `segment` ra vì thuộc bảng SegmentLabel, đưa vào Laptop sẽ bị Prisma báo lỗi
  const { segment: _segment, ...body } = input;
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
    // Ghi lịch sử giá nếu giá đổi, để mọi đường sửa giá đều được lưu vết
    const current = await prisma.laptop.findUnique({ where: { id }, select: { priceVnd: true } });
    const updated = await prisma.laptop.update({ where: { id }, data });
    if (current && current.priceVnd !== body.priceVnd) {
      await prisma.priceHistory.create({ data: { laptopId: id, priceVnd: body.priceVnd } });
    }
    return updated;
  }
  const created = await prisma.laptop.create({ data });
  await prisma.priceHistory.create({ data: { laptopId: created.id, priceVnd: body.priceVnd } });
  return created;
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
  // Sắp xếp đa tiêu chí: chuỗi cách nhau bởi dấu phẩy, thứ tự trong chuỗi là thứ tự ưu tiên.
  // Vẫn nhận 1 giá trị đơn (vd `sort=price_desc` ở AdminPrices.tsx) để tương thích ngược.
  sort: z
    .string()
    .optional()
    .transform((s) => (s ? s.split(',') : undefined))
    .pipe(z.array(z.enum(['price_asc', 'price_desc', 'perf_desc', 'value_desc'])).optional()),
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

// Route tĩnh phải khai báo TRƯỚC route động '/:id', nếu không "price-changes" bị coi là :id.
laptopsRouter.get('/price-changes', requireAuth, requireRole('STAFF', 'ADMIN'), async (req, res, next) => {
  try {
    const limit = Number(req.query.limit ?? 30);
    res.json({ success: true, data: await priceService.recentPriceChanges(limit) });
  } catch (err) {
    next(err);
  }
});

// Chi tiết 1 máy: công khai, không yêu cầu đăng nhập
laptopsRouter.get('/:id', async (req, res, next) => {
  try {
    const data = await laptopsService.getLaptopDetail(Number(req.params.id));
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

/** Lưu laptop, gán nhãn phân khúc, rồi đồng bộ sang ML service để máy mới vào ngay catalog gợi ý.
 * Trả về laptop kèm nhãn và `labelWarning` (vd độ tin cậy thấp). */
async function saveLaptopWithLabel(id: number | null, input: z.infer<typeof laptopInputSchema>, userId?: number) {
  const laptop = await computeAndUpsertLaptop(id, input);
  const { label, warning } = await applySegmentLabel(laptop.id, input, input.segment ?? undefined, userId);
  await snapshotSync();
  return { ...laptop, segmentLabel: label, labelWarning: warning };
}

laptopsRouter.post('/', requireAuth, requireRole('STAFF', 'ADMIN'), async (req, res, next) => {
  try {
    const body = laptopInputSchema.parse(req.body);
    const data = await saveLaptopWithLabel(null, body, req.user?.id);
    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

laptopsRouter.put('/:id', requireAuth, requireRole('STAFF', 'ADMIN'), async (req, res, next) => {
  try {
    const body = laptopInputSchema.parse(req.body);
    const data = await saveLaptopWithLabel(Number(req.params.id), body, req.user?.id);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

// Xóa mềm (isActive=false) vì máy còn được PriceHistory/InteractionEvent/RecommendationSession
// tham chiếu. Hệ quả: SKU của máy đã "xóa" vẫn bị chiếm, không tạo lại được với cùng SKU.
laptopsRouter.delete('/:id', requireAuth, requireRole('STAFF', 'ADMIN'), async (req, res, next) => {
  try {
    await prisma.laptop.update({ where: { id: Number(req.params.id) }, data: { isActive: false } });
    await snapshotSync();
    res.json({ success: true, data: null });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// Quản lý giá
// ---------------------------------------------------------------------------
const priceSchema = z.object({
  priceVnd: z.number().int().min(3_000_000, 'Giá tối thiểu 3 triệu').max(200_000_000, 'Giá tối đa 200 triệu'),
  note: z.string().max(300).optional(),
  // originalPriceVnd: null = "hết khuyến mãi", undefined = "không đổi" -> cần .nullable().optional()
  originalPriceVnd: z
    .number()
    .int()
    .min(3_000_000, 'Giá gốc tối thiểu 3 triệu')
    .max(200_000_000, 'Giá gốc tối đa 200 triệu')
    .nullable()
    .optional(),
  salesCount: z.number().int().min(0, 'Lượt bán không được âm').max(1_000_000).optional(),
});

laptopsRouter.patch('/:id/price', requireAuth, requireRole('STAFF', 'ADMIN'), async (req, res, next) => {
  try {
    const body = priceSchema.parse(req.body);
    if (body.originalPriceVnd != null && body.originalPriceVnd <= body.priceVnd) {
      throw new AppError(400, 'INVALID_ORIGINAL_PRICE', 'Giá gốc khuyến mãi phải lớn hơn giá bán hiện tại');
    }
    const result = await priceService.updatePrice(
      Number(req.params.id),
      body.priceVnd,
      body.note,
      body.originalPriceVnd,
      body.salesCount
    );
    await snapshotSync(); // đẩy giá mới sang ML service ngay, không chờ cron
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

laptopsRouter.get('/:id/price-history', async (req, res, next) => {
  try {
    res.json({ success: true, data: await priceService.getPriceHistory(Number(req.params.id)) });
  } catch (err) {
    next(err);
  }
});

const bulkPriceSchema = z.object({
  percent: z.number().min(-90).max(200),
  brandId: z.number().int().positive().optional(),
  segment: z.enum(['OFFICE', 'ULTRABOOK', 'GAMING', 'CREATOR']).optional(),
  dryRun: z.boolean().optional(),
});

laptopsRouter.post('/bulk-price', requireAuth, requireRole('ADMIN'), async (req, res, next) => {
  try {
    const body = bulkPriceSchema.parse(req.body);
    const result = await priceService.bulkAdjustPrice(body);
    if (!result.dryRun && result.affected > 0) await snapshotSync();
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

// Nút "AI gợi ý phân khúc": chỉ dự đoán để xem trước, không lưu (lưu ở saveLaptopWithLabel).
laptopsRouter.post('/predict-segment', requireAuth, requireRole('STAFF', 'ADMIN'), async (req, res, next) => {
  try {
    res.json({ success: true, data: await predictSegment(req.body) });
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
