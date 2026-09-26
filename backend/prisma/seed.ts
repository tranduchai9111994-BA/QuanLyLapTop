import 'dotenv/config';
import { readFileSync } from 'fs';
import { join } from 'path';
import { parse } from 'csv-parse/sync';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { computePpi, computeIndices } from '../src/modules/laptops/laptops.service';
import { toJson } from '../src/lib/json';

const prisma = new PrismaClient();
const DATA_DIR = join(process.cwd(), '..', 'data');

function readCsv(path: string): Record<string, string>[] {
  const content = readFileSync(path, 'utf-8').replace(/^﻿/, '');
  return parse(content, { columns: true, skip_empty_lines: true });
}

async function seedUsers() {
  const passwordHash = await bcrypt.hash('Demo@123', 10);
  const users = [
    { email: 'admin@smartlap.vn', fullName: 'Quản trị viên', role: 'ADMIN' },
    { email: 'staff@smartlap.vn', fullName: 'Nhân viên tư vấn', role: 'STAFF' },
    { email: 'khach@smartlap.vn', fullName: 'Khách hàng demo', role: 'CUSTOMER' },
  ];
  for (const u of users) {
    await prisma.user.upsert({
      where: { email: u.email },
      create: { ...u, passwordHash },
      update: {},
    });
  }
  console.log('Da tao 3 tai khoan demo (mat khau: Demo@123)');
}

async function seedBenchmarks() {
  const cpuRows = readCsv(join(DATA_DIR, 'processed', 'cpu_benchmark.csv'));
  const gpuRows = readCsv(join(DATA_DIR, 'processed', 'gpu_benchmark.csv'));
  const maxCpu = Math.max(...cpuRows.map((r) => Number(r.raw_score)));
  const maxGpu = Math.max(...gpuRows.map((r) => Number(r.raw_score)));
  const dedicatedMarkers = ['geforce', 'radeon rx', 'rtx', 'quadro', 'arc a'];

  const cpuMap = new Map<string, number>();
  for (const row of cpuRows) {
    const score = (100 * Number(row.raw_score)) / maxCpu;
    const rec = await prisma.cpuBenchmark.upsert({
      where: { pattern: row.pattern },
      create: {
        pattern: row.pattern,
        displayName: row.display_name,
        rawScore: Number(row.raw_score),
        score,
        source: row.source,
        checkedAt: new Date(),
      },
      update: { score, rawScore: Number(row.raw_score) },
    });
    cpuMap.set(row.pattern, rec.id);
  }

  const gpuMap = new Map<string, number>();
  for (const row of gpuRows) {
    const score = (100 * Number(row.raw_score)) / maxGpu;
    // Uu tien cot `dedicated` that trong file benchmark; chi doan tu ten khi file khong co cot do
    const norm = row.display_name.toLowerCase();
    const dedicated =
      row.dedicated !== undefined && row.dedicated !== ''
        ? row.dedicated === '1' || String(row.dedicated).toLowerCase() === 'true'
        : dedicatedMarkers.some((m) => norm.includes(m));
    const rec = await prisma.gpuBenchmark.upsert({
      where: { pattern: row.pattern },
      create: {
        pattern: row.pattern,
        displayName: row.display_name,
        rawScore: Number(row.raw_score),
        score,
        dedicated,
        source: row.source,
        checkedAt: new Date(),
      },
      update: { score, rawScore: Number(row.raw_score), dedicated },
    });
    gpuMap.set(row.pattern, rec.id);
  }
  console.log(`Da nhap ${cpuMap.size} CPU benchmark, ${gpuMap.size} GPU benchmark`);
  return { cpuMap, gpuMap };
}

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\(r\)|\(tm\)|processor/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function matchPattern(modelName: string, candidates: { pattern: string; displayName: string }[]): string | null {
  const norm = normalizeName(modelName);
  for (const c of candidates) {
    const np = normalizeName(c.pattern);
    if (norm === np || norm.includes(np) || np.includes(norm)) return c.pattern;
  }
  for (const c of candidates) {
    const nd = normalizeName(c.displayName);
    if (norm === nd || norm.includes(nd) || nd.includes(norm)) return c.pattern;
  }
  return null;
}

async function seedCatalog(cpuMap: Map<string, number>, gpuMap: Map<string, number>) {
  const rows = readCsv(join(DATA_DIR, 'processed', 'catalog_vn.csv'));

  const cpuBenchByPattern = await prisma.cpuBenchmark.findMany();
  const gpuBenchByPattern = await prisma.gpuBenchmark.findMany();
  const cpuCandidates = cpuBenchByPattern.map((c) => ({ pattern: c.pattern, displayName: c.displayName }));
  const gpuCandidates = gpuBenchByPattern.map((g) => ({ pattern: g.pattern, displayName: g.displayName }));
  const cpuScoreByPattern = new Map(cpuBenchByPattern.map((c) => [c.pattern, c.score]));
  const gpuScoreByPattern = new Map(gpuBenchByPattern.map((g) => [g.pattern, g.score]));

  const maxRam = Math.max(...rows.map((r) => Number(r.ram_gb)));
  const maxSsd = Math.max(...rows.map((r) => Number(r.ssd_gb)));

  let brandCache = new Map<string, number>();
  let created = 0;
  for (const row of rows) {
    let brandId = brandCache.get(row.brand);
    if (!brandId) {
      const tier = row.brand_tier ? Number(row.brand_tier) : 3;
      const brand = await prisma.brand.upsert({
        where: { name: row.brand },
        create: { name: row.brand, tier },
        update: { tier },
      });
      brandId = brand.id;
      brandCache.set(row.brand, brandId);
    }

    const cpuPattern = matchPattern(row.cpu_model, cpuCandidates);
    const gpuPattern = matchPattern(row.gpu_model, gpuCandidates);
    if (!cpuPattern || !gpuPattern) {
      console.warn(`Bo qua ${row.sku}: khong khop benchmark (cpu=${row.cpu_model}, gpu=${row.gpu_model})`);
      continue;
    }
    const cpuId = cpuMap.get(cpuPattern)!;
    const gpuId = gpuMap.get(gpuPattern)!;
    const cpuScore = cpuScoreByPattern.get(cpuPattern)!;
    const gpuScore = gpuScoreByPattern.get(gpuPattern)!;

    const [resWidth, resHeight] = row.resolution.split('x').map(Number);
    const screenInch = Number(row.screen_inch);
    const ppi = computePpi(resWidth, resHeight, screenInch);
    const { performanceIdx, valueIdx } = computeIndices({
      cpuScore,
      gpuScore,
      ramGb: Number(row.ram_gb),
      ssdGb: Number(row.ssd_gb),
      priceVnd: Number(row.price_vnd),
      maxRamGb: maxRam,
      maxSsdGb: maxSsd,
    });

    const laptop = await prisma.laptop.upsert({
      where: { sku: row.sku },
      create: {
        sku: row.sku,
        name: row.name,
        brandId,
        cpuId,
        gpuId,
        ramGb: Number(row.ram_gb),
        ssdGb: Number(row.ssd_gb),
        screenInch,
        resWidth,
        resHeight,
        ppi,
        refreshHz: Number(row.refresh_hz) || 60,
        srgb100: row.srgb_100 === '1',
        weightKg: Number(row.weight_kg),
        batteryWh: Number(row.battery_wh),
        priceVnd: Number(row.price_vnd),
        imageUrl: row.image_url || null,
        sourceUrl: row.source_url || null,
        performanceIdx,
        valueIdx,
      },
      update: { performanceIdx, valueIdx },
    });

    await prisma.segmentLabel.upsert({
      where: { laptopId: laptop.id },
      create: { laptopId: laptop.id, segment: row.segment, source: 'RETAILER', status: 'VERIFIED' },
      update: { segment: row.segment },
    });

    await prisma.priceHistory.create({ data: { laptopId: laptop.id, priceVnd: Number(row.price_vnd) } });
    created += 1;
  }
  console.log(`Da nhap ${created}/${rows.length} laptop vao catalog`);
}

async function seedKnowledgeConfig() {
  const configs: Record<string, unknown> = {
    segment_base_weights: {
      OFFICE: { performance: 0.8, mobility: 1.0, display: 0.8, price: 1.3 },
      ULTRABOOK: { performance: 0.8, mobility: 1.4, display: 1.0, price: 1.0 },
      GAMING: { performance: 1.3, mobility: 0.7, display: 1.0, price: 1.0 },
      CREATOR: { performance: 1.2, mobility: 0.8, display: 1.3, price: 0.8 },
    },
    priority_percentiles: { 1: 25, 2: 40, 3: 55, 4: 75, 5: 90 },
    confidence_threshold: 0.6,
    default_top_n: 5,
    budget_relax_ratio: 0.1,
    min_candidates: 3,
  };
  for (const [key, value] of Object.entries(configs)) {
    await prisma.knowledgeConfig.upsert({
      where: { key },
      create: { key, valueJson: toJson(value) },
      update: {},
    });
  }
  console.log('Da tao cau hinh tri thuc mac dinh');
}

/** Xoa sach catalog + telemetry mo phong truoc khi nap bo du lieu moi.
 * KHONG xoa tai khoan nguoi dung va cau hinh tri thuc.
 * Chay khi truyen co `--reset`: `npm run seed -- --reset`.
 * Can thiet khi doi bo du lieu (vd bang benchmark moi), neu khong DB se lan ca ban cu lan moi
 * khien viec tra cuu CPU/GPU khop nham dong cu. */
async function resetCatalog() {
  await prisma.recommendationItem.deleteMany();
  await prisma.interactionEvent.deleteMany();
  await prisma.recommendationSession.deleteMany();
  await prisma.favorite.deleteMany();
  await prisma.priceHistory.deleteMany();
  await prisma.segmentLabel.deleteMany();
  await prisma.laptopPin.deleteMany();
  await prisma.laptop.deleteMany();
  await prisma.cpuBenchmark.deleteMany();
  await prisma.gpuBenchmark.deleteMany();
  await prisma.brand.deleteMany();
  console.log('Da xoa catalog + telemetry cu (giu lai tai khoan va cau hinh tri thuc)');
}

async function main() {
  if (process.argv.includes('--reset')) {
    await resetCatalog();
  }
  await seedUsers();
  const { cpuMap, gpuMap } = await seedBenchmarks();
  await seedCatalog(cpuMap, gpuMap);
  await seedKnowledgeConfig();
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
