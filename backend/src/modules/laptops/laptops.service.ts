import { prisma } from '../../lib/prisma';
import { AppError } from '../../middlewares/error';
import { fromJson } from '../../lib/json';
import { mlClient } from '../../lib/mlClient';

/** Mat do diem anh (pixel per inch) tu do phan giai + kich thuoc man hinh - cong thuc hinh hoc
 * chuan (duong cheo tinh bang Pythagoras, chia cho so inch man hinh). Dung lam 1 dac trung "man
 * hinh sac net" cho Mo hinh B (kNN), khong the suy truc tiep tu resWidth/resHeight rieng le vi
 * con phu thuoc kich thuoc man hinh vat ly. */
export function computePpi(resWidth: number, resHeight: number, screenInch: number): number {
  return Math.sqrt(resWidth ** 2 + resHeight ** 2) / screenInch;
}

/** Tinh 2 CHI SO TONG HOP luu san trong DB (khong tinh lai moi lan truy van, vi CPU/GPU/gia it
 * doi hon so voi so lan doc): `performanceIdx` (diem hieu nang tong hop, uu tien CPU 50% + GPU
 * 35% + RAM/SSD chuan hoa theo may MANH NHAT dang co trong catalog), `valueIdx` (hieu nang tren
 * MOI TRIEU DONG - cang cao cang "dang tien"). Dung o nhieu noi: hien thi the "Dang tien nhat",
 * sap xep Danh muc theo `value_desc`/`perf_desc`, va lam dac trung dau vao cua Mo hinh B. */
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

/** Chi tiet 1 may kem LICH SU GIA day du (sap moi nhat truoc) - dung cho trang Chi tiet khach
 * hang (khong hien lich su gia) va man Quan ly gia admin (hien bieu do). */
export async function getLaptopDetail(id: number) {
  const laptop = await prisma.laptop.findUnique({
    where: { id },
    include: { brand: true, cpu: true, gpu: true, segmentLabel: true, priceHistory: { orderBy: { changedAt: 'desc' } } },
  });
  if (!laptop) throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy laptop');

  // docs/08_FRONTEND_SPEC.md muc 5: "Dang tien" so voi TRUNG VI phan khuc - "Tot hon 68% may
  // cung phan khuc". Chi tinh khi may DA co nhan phan khuc (segmentLabel) - may chua gan nhan
  // (hiem, dang cho AI du doan) thi khong co gi de so sanh, tra ve null de frontend an dong nay.
  let valuePercentile: number | null = null;
  if (laptop.segmentLabel) {
    const peers = await prisma.laptop.findMany({
      where: { isActive: true, segmentLabel: { segment: laptop.segmentLabel.segment } },
      select: { valueIdx: true },
    });
    if (peers.length > 1) {
      const worseCount = peers.filter((p) => p.valueIdx < laptop.valueIdx).length;
      valuePercentile = Math.round((worseCount / (peers.length - 1)) * 100);
    }
  }

  return { ...laptop, valuePercentile };
}

/** "May tuong tu" (item-item) tren trang Chi tiet - goi ML service de kNN tim k may GAN NHAT
 * VE THONG SO (khong lien quan ho so nhu cau nguoi dung, xem retriever.similar_items), roi tra
 * cuu lai thong tin day du (ten/gia/anh) tu DB theo id ML tra ve. */
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

/** Lay day du thong tin cua NHIEU may cung luc theo danh sach id (dung cho trang So sanh -
 * Compare.tsx) - khong loc `isActive` vi nguoi dung co the muon so sanh voi may da ngung ban. */
export async function compareLaptops(ids: number[]) {
  return prisma.laptop.findMany({
    where: { id: { in: ids } },
    include: { brand: true, cpu: true, gpu: true, segmentLabel: true },
  });
}

/** Giai nen phan bo xac suat cua Mo hinh A (luu dang chuoi JSON trong SegmentLabel.probaJson,
 * xem lib/json.ts) - dung khi hien "89% Gaming, 11% Do hoa" tren giao dien admin. */
export function parseProba(probaJson: string | null | undefined) {
  return fromJson<Record<string, number>>(probaJson, {});
}
