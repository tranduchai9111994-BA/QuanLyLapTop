import { Router } from 'express';
import { z } from 'zod';
import { optionalAuth, requireAuth, requireRole } from '../../middlewares/auth';
import { AppError } from '../../middlewares/error';
import { prisma } from '../../lib/prisma';
import { mlClient } from '../../lib/mlClient';
import { snapshotSync } from '../jobs/snapshotSync';
import * as laptopsService from './laptops.service';
import * as priceService from './price.service';

export const laptopsRouter = Router();

// Cac gia tri chuan + nguong hop le. Phai khop voi frontend/src/constants/laptopSpecs.ts va
// ml-service/app/data_check.py. Day la TUYEN PHONG THU CUOI: giao dien da cho chon san, nhung
// API van phai tu chan du lieu vo ly (vd RAM am, gia 0 dong) du ai goi truc tiep.
const VALID_RAM = [4, 8, 12, 16, 24, 32, 64, 96, 128] as const;
const VALID_SSD = [128, 256, 512, 1024, 2048, 4096] as const;

const laptopInputSchema = z.object({
  sku: z.string().min(2, 'Mã SKU quá ngắn').max(80),
  name: z.string().min(2, 'Tên máy quá ngắn').max(200),
  // CHU Y: cac truong duoi day la NULLABLE THAT trong Prisma schema (co dau `?`), nghia la khi
  // doc tu DB ve, gia tri thieu se la `null` (KHONG PHAI `undefined`). `.optional()` cua zod CHI
  // chap nhan `undefined`, se BAO LOI neu nhan `null` - day chinh la loi da bat duoc qua CRUD
  // test tren browser (sua may co san `batteryWh = null` bi tra ve "Du lieu gui len khong hop
  // le"). Phai dung `.nullable().optional()` (tuong duong `.nullish()`) cho MOI truong nullable
  // that trong DB, khong chi optional o phia frontend.
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
  // refreshHz co @default(60) trong schema (KHONG co dau `?`) nen khong bao gio null - chi can
  // .optional() la du
  refreshHz: z.number().int().min(30).max(500).optional(),
  srgb100: z.boolean().optional(),
  weightKg: z.number().min(0.8, 'Trọng lượng tối thiểu 0,8 kg').max(4.5, 'Trọng lượng tối đa 4,5 kg'),
  batteryWh: z.number().min(20).max(120).nullable().optional(),
  priceVnd: z.number().int().min(3_000_000, 'Giá tối thiểu 3 triệu').max(200_000_000, 'Giá tối đa 200 triệu'),
  imageUrl: z.string().nullable().optional(),
  sourceUrl: z.string().nullable().optional(),
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
    // Ghi LICH SU GIA neu gia thay doi - de moi duong sua gia deu duoc luu vet, khong chi
    // rieng man "Quan ly gia" (PATCH /:id/price)
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
  // Sap xep DA TIEU CHI (checkbox chon nhieu, ket hop duoc): nguoi dung co the chon dong thoi
  // "Hieu nang cao nhat" + "Dang tien nhat" -> sap theo hieu nang TRUOC, nhung may hoa nhau ve
  // hieu nang thi sap tiep theo do "dang tien". Chuoi cach nhau boi dau phay, THU TU trong chuoi
  // la THU TU UU TIEN (phan tu dau tien uu tien cao nhat). Van nhan 1 gia tri don (khong dau
  // phay) de tuong thich nguoc voi cac noi dang goi `sort=price_desc` (vd AdminPrices.tsx).
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

// CHU Y: route TINH phai khai bao TRUOC route dong '/:id', neu khong Express se coi
// "price-changes" la gia tri cua :id (loi da tung gap: Number("price-changes") = NaN).
laptopsRouter.get('/price-changes', requireAuth, requireRole('STAFF', 'ADMIN'), async (req, res, next) => {
  try {
    const limit = Number(req.query.limit ?? 30);
    res.json({ success: true, data: await priceService.recentPriceChanges(limit) });
  } catch (err) {
    next(err);
  }
});

// Chi tiet 1 may - KHONG yeu cau dang nhap (trang Chi tiet la khach hang cong khai xem duoc)
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

// XOA MEM (chi dat isActive=false), KHONG xoa that ban ghi khoi DB - vi may da xoa co the van
// duoc tham chieu boi PriceHistory/InteractionEvent/RecommendationSession cu (xoa that se vi
// pham khoa ngoai hoac mat lich su). He qua CAN BIET: ma SKU cua may da "xoa" VAN CON bi chiem
// trong DB, khong the tao lai may moi voi CUNG SKU do (da phat hien qua CRUD test tren browser).
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
// Quan ly gia (gia nha cung cap thay doi lien tuc)
// ---------------------------------------------------------------------------
const priceSchema = z.object({
  priceVnd: z.number().int().min(3_000_000, 'Giá tối thiểu 3 triệu').max(200_000_000, 'Giá tối đa 200 triệu'),
  note: z.string().max(300).optional(),
  // Khuyen mai + luot ban: null cho originalPriceVnd = "khong con khuyen mai" (khac voi undefined
  // = "khong doi truong nay"), nen dung .nullable().optional() thay vi chi .optional().
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
    await snapshotSync(); // day gia moi sang ML service ngay, khong doi cron
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
