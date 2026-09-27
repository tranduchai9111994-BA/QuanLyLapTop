import { prisma } from '../../lib/prisma';
import { AppError } from '../../middlewares/error';
import { computeIndices } from './laptops.service';

/**
 * Nghiep vu QUAN LY GIA - gia nha cung cap thay doi lien tuc nen can:
 *  1. Ghi LICH SU moi lan doi gia (ai doi, doi tu bao nhieu sang bao nhieu, luc nao)
 *  2. Tinh lai `valueIdx` (hieu nang tren moi trieu dong) vi no phu thuoc gia - neu quen,
 *     Mo hinh B se xep hang theo gia CU
 *  3. Cho phep dieu chinh HANG LOAT theo % (vd nha cung cap tang 5% toan bo hang ASUS)
 */

/** Doi gia mot may: ghi lich su + tinh lai chi so. Tra ve ban ghi da cap nhat.
 *
 * `originalPriceVnd`/`salesCount` (khuyen mai + luot ban) la 2 tham so TUY CHON di kem: cho phep
 * man Quan ly gia sua luon 2 truong nay cung luc voi gia ban, vi ca 3 deu la nghiep vu "gia/
 * khuyen mai" nam chung 1 man hinh. Truyen `null` cho `originalPriceVnd` de HUY khuyen mai (may
 * tro lai gia goc = gia ban, khong con giam gia).
 */
export async function updatePrice(
  laptopId: number,
  newPrice: number,
  note?: string,
  originalPriceVnd?: number | null,
  salesCount?: number
) {
  const laptop = await prisma.laptop.findUnique({
    where: { id: laptopId },
    include: { cpu: true, gpu: true },
  });
  if (!laptop) throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy laptop');

  const promotionChanged =
    (originalPriceVnd !== undefined && originalPriceVnd !== laptop.originalPriceVnd) ||
    (salesCount !== undefined && salesCount !== laptop.salesCount);
  const priceChanged = newPrice !== laptop.priceVnd;

  if (!priceChanged && !promotionChanged) {
    return { laptop, changed: false, oldPrice: laptop.priceVnd };
  }

  const agg = await prisma.laptop.aggregate({ _max: { ramGb: true, ssdGb: true } });
  const { performanceIdx, valueIdx } = computeIndices({
    cpuScore: laptop.cpu.score,
    gpuScore: laptop.gpu.score,
    ramGb: laptop.ramGb,
    ssdGb: laptop.ssdGb,
    priceVnd: newPrice,
    maxRamGb: agg._max.ramGb ?? laptop.ramGb,
    maxSsdGb: agg._max.ssdGb ?? laptop.ssdGb,
  });

  const data: Record<string, unknown> = { priceVnd: newPrice, performanceIdx, valueIdx };
  if (originalPriceVnd !== undefined) data.originalPriceVnd = originalPriceVnd;
  if (salesCount !== undefined) data.salesCount = salesCount;

  // Kieu `any[]`: 2 lenh trong transaction tra ve 2 model KHAC nhau (Laptop vs PriceHistory), nen
  // khong the de TypeScript tu suy kieu tu phan tu dau tien (se bao loi sai kieu o phan tu thu 2).
  const ops: any[] = [prisma.laptop.update({ where: { id: laptopId }, data })];
  // Chi ghi LICH SU GIA khi gia ban thuc su doi - khuyen mai/luot ban khong phai la 1 "lan doi gia"
  if (priceChanged) ops.push(prisma.priceHistory.create({ data: { laptopId, priceVnd: newPrice } }));

  const [updated] = await prisma.$transaction(ops);

  return { laptop: updated, changed: true, oldPrice: laptop.priceVnd, note };
}

export async function getPriceHistory(laptopId: number) {
  const rows = await prisma.priceHistory.findMany({
    where: { laptopId },
    orderBy: { changedAt: 'asc' },
  });
  if (rows.length === 0) return { points: [], summary: null };

  const prices = rows.map((r) => r.priceVnd);
  const first = prices[0];
  const last = prices[prices.length - 1];
  return {
    points: rows.map((r) => ({ priceVnd: r.priceVnd, changedAt: r.changedAt })),
    summary: {
      current: last,
      lowest: Math.min(...prices),
      highest: Math.max(...prices),
      firstRecorded: first,
      changeVsFirst: last - first,
      changePercent: first ? Number((((last - first) / first) * 100).toFixed(1)) : 0,
      timesChanged: rows.length - 1,
    },
  };
}

/** Dieu chinh gia HANG LOAT theo phan tram (vd nha cung cap bao tang 5% toan bo hang ASUS).
 * `percent` duong = tang gia, am = giam gia. Tra ve so may da doi + vai vi du de kiem chung. */
export async function bulkAdjustPrice(params: {
  percent: number;
  brandId?: number;
  segment?: string;
  dryRun?: boolean;
}) {
  const { percent, brandId, segment, dryRun } = params;
  if (percent === 0) throw new AppError(400, 'INVALID_PERCENT', 'Phần trăm điều chỉnh phải khác 0');
  if (percent < -90 || percent > 200) {
    throw new AppError(400, 'INVALID_PERCENT', 'Phần trăm điều chỉnh chỉ cho phép trong khoảng -90% đến +200%');
  }

  const where: any = { isActive: true };
  if (brandId) where.brandId = brandId;
  if (segment) where.segmentLabel = { segment };

  const laptops = await prisma.laptop.findMany({
    where,
    include: { cpu: true, gpu: true, brand: true },
  });
  if (laptops.length === 0) {
    return { affected: 0, dryRun: !!dryRun, samples: [] };
  }

  const agg = await prisma.laptop.aggregate({ _max: { ramGb: true, ssdGb: true } });
  const factor = 1 + percent / 100;

  const samples = laptops.slice(0, 5).map((l) => ({
    id: l.id,
    name: l.name,
    oldPrice: l.priceVnd,
    newPrice: Math.round((l.priceVnd * factor) / 10_000) * 10_000,
  }));

  // `dryRun`: xem truoc anh huong truoc khi thuc su doi gia hang loat
  if (dryRun) {
    return { affected: laptops.length, dryRun: true, samples };
  }

  const ops = laptops.flatMap((l) => {
    const newPrice = Math.round((l.priceVnd * factor) / 10_000) * 10_000;
    const { performanceIdx, valueIdx } = computeIndices({
      cpuScore: l.cpu.score,
      gpuScore: l.gpu.score,
      ramGb: l.ramGb,
      ssdGb: l.ssdGb,
      priceVnd: newPrice,
      maxRamGb: agg._max.ramGb ?? l.ramGb,
      maxSsdGb: agg._max.ssdGb ?? l.ssdGb,
    });
    return [
      prisma.laptop.update({ where: { id: l.id }, data: { priceVnd: newPrice, performanceIdx, valueIdx } }),
      prisma.priceHistory.create({ data: { laptopId: l.id, priceVnd: newPrice } }),
    ];
  });

  await prisma.$transaction(ops);
  return { affected: laptops.length, dryRun: false, samples };
}

/** Danh sach may co bien dong gia gan day - de quan tri theo doi thi truong.
 *
 * Phai lay theo TUNG MAY (2 ban ghi cuoi cua may do), khong the lay N ban ghi moi nhat roi gom:
 * moi may thuong chi co 1 ban ghi trong N ban ghi moi nhat nen se khong tim ra gia truoc do.
 */
export async function recentPriceChanges(limit = 30) {
  // Cac may vua co thay doi gia gan day nhat
  const recent = await prisma.priceHistory.findMany({
    orderBy: { changedAt: 'desc' },
    take: limit * 3,
    select: { laptopId: true },
    distinct: ['laptopId'],
  });
  if (recent.length === 0) return [];

  const results: {
    laptopId: number;
    name: string;
    brand: string;
    previousPrice: number;
    currentPrice: number;
    diff: number;
    percent: number;
    changedAt: Date;
  }[] = [];

  for (const { laptopId } of recent) {
    if (results.length >= limit) break;
    const [current, previous] = await prisma.priceHistory.findMany({
      where: { laptopId },
      orderBy: { changedAt: 'desc' },
      take: 2,
      include: { laptop: { include: { brand: true } } },
    });
    if (!previous || previous.priceVnd === current.priceVnd) continue;

    results.push({
      laptopId,
      name: current.laptop.name,
      brand: current.laptop.brand.name,
      previousPrice: previous.priceVnd,
      currentPrice: current.priceVnd,
      diff: current.priceVnd - previous.priceVnd,
      percent: Number((((current.priceVnd - previous.priceVnd) / previous.priceVnd) * 100).toFixed(1)),
      changedAt: current.changedAt,
    });
  }
  return results;
}
