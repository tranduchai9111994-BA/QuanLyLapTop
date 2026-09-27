import { prisma } from '../../lib/prisma';
import { AppError } from '../../middlewares/error';
import { fromJson } from '../../lib/json';
import { mlClient } from '../../lib/mlClient';

export function computePpi(resWidth: number, resHeight: number, screenInch: number): number {
  return Math.sqrt(resWidth ** 2 + resHeight ** 2) / screenInch;
}

export function computeIndices(params: {
  cpuScore: number;
  gpuScore: number;
  ramGb: number;
  ssdGb: number;
  priceVnd: number;
  maxRamGb: number;
  maxSsdGb: number;
}) {
  const ramNorm = (params.ramGb / params.maxRamGb) * 100;
  const ssdNorm = (params.ssdGb / params.maxSsdGb) * 100;
  const performanceIdx = 0.5 * params.cpuScore + 0.35 * params.gpuScore + 0.1 * ramNorm + 0.05 * ssdNorm;
  const valueIdx = performanceIdx / (params.priceVnd / 1_000_000);
  return { performanceIdx, valueIdx };
}

export interface LaptopFilters {
  segment?: string;
  brandIds?: number[];
  priceMin?: number;
  priceMax?: number;
  ramMin?: number;
  weightMax?: number;
  q?: string;
  // Mang (khong con la 1 gia tri don) - nguoi dung chon NHIEU tieu chi qua checkbox, THU TU
  // trong mang la thu tu uu tien khi sap xep (Prisma ho tro orderBy la MANG cac dieu kien, ap
  // dung LAN LUOT: tieu chi dau tien so sanh truoc, may nao "hoa" nhau moi xet tieu chi tiep theo).
  sort?: ('price_asc' | 'price_desc' | 'perf_desc' | 'value_desc')[];
  page?: number;
  pageSize?: number;
}

export async function listLaptops(filters: LaptopFilters) {
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 20;

  const where: any = { isActive: true };
  if (filters.segment) where.segmentLabel = { segment: filters.segment };
  if (filters.brandIds?.length) where.brandId = { in: filters.brandIds };
  if (filters.priceMin != null || filters.priceMax != null) {
    where.priceVnd = {};
    if (filters.priceMin != null) where.priceVnd.gte = filters.priceMin;
    if (filters.priceMax != null) where.priceVnd.lte = filters.priceMax;
  }
  if (filters.ramMin != null) where.ramGb = { gte: filters.ramMin };
  if (filters.weightMax != null) where.weightKg = { lte: filters.weightMax };
  if (filters.q) where.name = { contains: filters.q };

  // Moi "khoa sap xep" (key) ung voi 1 dieu kien orderBy that su cua Prisma
  const SORT_KEY_TO_ORDER_BY: Record<string, Record<string, 'asc' | 'desc'>> = {
    price_asc: { priceVnd: 'asc' },
    price_desc: { priceVnd: 'desc' },
    perf_desc: { performanceIdx: 'desc' },
    value_desc: { valueIdx: 'desc' },
  };
  // Chuyen danh sach khoa (co the nhieu khoa, dung thu tu uu tien nguoi dung chon) thanh MANG
  // dieu kien cho Prisma - Prisma se sap theo dieu kien DAU TIEN truoc, chi khi cac ban ghi
  // "hoa" nhau (bang gia tri) o dieu kien do moi xet tiep dieu kien thu 2, v.v.
  const keys = filters.sort?.length ? filters.sort : (['price_asc'] as const);
  const orderBy = keys.map((k) => SORT_KEY_TO_ORDER_BY[k]);

  const [items, total] = await Promise.all([
    prisma.laptop.findMany({
      where,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { brand: true, cpu: true, gpu: true, segmentLabel: true },
    }),
    prisma.laptop.count({ where }),
  ]);

  return { items, meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } };
}

export async function getLaptopDetail(id: number) {
  const laptop = await prisma.laptop.findUnique({
    where: { id },
    include: { brand: true, cpu: true, gpu: true, segmentLabel: true, priceHistory: { orderBy: { changedAt: 'desc' } } },
  });
  if (!laptop) throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy laptop');
  return laptop;
}

export async function getSimilarLaptops(id: number, k: number) {
  let similarItems: any[];
  try {
    const r = await mlClient.post('/similar', { laptopId: id, k });
    similarItems = r.data.items;
  } catch (err) {
    // ML service loi/timeout/chua dong bo catalog -> tra danh sach rong, khong lam sap trang Chi tiet
    // (cung triet ly du phong nhu recommend.service.ts, xem docs/09 §4)
    return [];
  }
  const ids: number[] = similarItems.map((it: any) => it.laptopId);
  const laptops = await prisma.laptop.findMany({
    where: { id: { in: ids } },
    include: { brand: true, cpu: true, gpu: true, segmentLabel: true },
  });
  const byId = new Map(laptops.map((l) => [l.id, l]));
  return similarItems
    .map((it: any) => ({ ...it, laptop: byId.get(it.laptopId) }))
    .filter((it: any) => it.laptop);
}

export async function compareLaptops(ids: number[]) {
  return prisma.laptop.findMany({
    where: { id: { in: ids } },
    include: { brand: true, cpu: true, gpu: true, segmentLabel: true },
  });
}

export function parseProba(probaJson: string | null | undefined) {
  return fromJson<Record<string, number>>(probaJson, {});
}
