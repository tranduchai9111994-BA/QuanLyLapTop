/**
 * Data mau cho man "Duyet nhan phan khuc" (AdminReviewQueue.tsx, UC-10), dung KET QUA THAT cua Mo hinh A.
 *
 * Nguyen tac: moi may trong hang doi la may ma mo hinh DANG DUNG thuc su du doan voi do tin cay duoi
 * nguong (confidence_threshold, mac dinh 0.6); xac suat, phan bo va phien ban mo hinh deu lay thang tu
 * ML service, khong tu dat. Nho vay bam "Chi tiet" tinh lai ra dung so da luu.
 *
 * Chi chon may KHONG khop hoan toan voi bat ky may nao trong tap huan luyen (khoang cach lang gieng gan
 * nhat > 0): may nam san trong tap huan luyen se tu bo phieu cho chinh no nen ket qua qua de, khong phai
 * truong hop "may moi" ma hang doi nham toi.
 *
 * Buoc chay:
 *  1. Khoi phuc cac the du lieu mau cu (predictedBy = demo-seed-review-queue, do ban truoc tu dat xac suat)
 *     ve nhan goc trong data/processed/catalog_vn.csv, nguon RETAILER, da duyet.
 *  2. Quet cac may da duyet bang mo hinh that, lay may co do tin cay thap nhat dua vao hang doi (toi da
 *     TARGET may, chia deu theo phan khuc du doan de hang doi da dang).
 *
 * Chay: npx tsx scripts/seedReviewQueue.ts          (ghi vao DB)
 *       npx tsx scripts/seedReviewQueue.ts --dry    (chi in ra, khong ghi)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { prisma } from '../src/lib/prisma';
import { toJson } from '../src/lib/json';
import { predictSegment, type SegmentCode } from '../src/modules/laptops/segment.service';

const TARGET = 6; // so may toi da trong hang doi
const DRY = process.argv.includes('--dry');
const DEMO_MARK = 'demo-seed-review-queue';
const CATALOG_CSV = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../data/processed/catalog_vn.csv');

/** Tach 1 dong CSV, co xu ly dau ngoac kep. */
function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else quoted = !quoted;
    } else if (ch === ',' && !quoted) {
      out.push(cur);
      cur = '';
    } else cur += ch;
  }
  out.push(cur);
  return out;
}

/** Nhan goc cua tung SKU trong catalog_vn.csv. */
function loadCatalogSegments(): Map<string, SegmentCode> {
  const lines = fs.readFileSync(CATALOG_CSV, 'utf-8').replace(/^﻿/, '').split(/\r?\n/).filter(Boolean);
  const header = splitCsvLine(lines[0]);
  const iSku = header.indexOf('sku');
  const iSeg = header.indexOf('segment');
  if (iSku < 0 || iSeg < 0) throw new Error('catalog_vn.csv thieu cot sku/segment');
  const map = new Map<string, SegmentCode>();
  for (const line of lines.slice(1)) {
    const cells = splitCsvLine(line);
    map.set(cells[iSku], cells[iSeg] as SegmentCode);
  }
  return map;
}

/** Goi mo hinh, thu lai vai lan vi ML co luc tu choi tam thoi khi bi goi lien tuc. */
async function predictWithRetry(input: Parameters<typeof predictSegment>[0]) {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await predictSegment(input);
    } catch (err) {
      if (attempt >= 4) throw err;
      await new Promise((r) => setTimeout(r, 500 * attempt));
    }
  }
}

async function restoreDemoRows(catalog: Map<string, SegmentCode>) {
  const demo = await prisma.segmentLabel.findMany({ where: { predictedBy: DEMO_MARK }, include: { laptop: true } });
  for (const row of demo) {
    const original = catalog.get(row.laptop.sku);
    if (!original) {
      console.warn(`[bo qua] ${row.laptop.sku} khong co trong catalog_vn.csv, giu nguyen`);
      continue;
    }
    console.log(`[khoi phuc] ${row.laptop.name} (${row.laptop.sku}): ${row.segment} ${Math.round((row.confidence ?? 0) * 100)}% (mau cu) -> ${original}, da duyet`);
    if (!DRY) {
      await prisma.segmentLabel.update({
        where: { laptopId: row.laptopId },
        data: { segment: original, source: 'RETAILER', status: 'VERIFIED', confidence: null, predictedBy: null, probaJson: null, locked: false, verifiedById: null },
      });
    }
  }
  console.log(`Da khoi phuc ${demo.length} the mau cu.\n`);
}

async function main() {
  const catalog = loadCatalogSegments();
  await restoreDemoRows(catalog);

  const thresholdRow = await prisma.knowledgeConfig.findUnique({ where: { key: 'confidence_threshold' } });
  const threshold = Number(thresholdRow ? JSON.parse(thresholdRow.valueJson) : 0.6) || 0.6;

  const alreadyQueued = DRY ? 0 : await prisma.segmentLabel.count({ where: { status: 'NEEDS_REVIEW' } });
  const need = Math.max(0, TARGET - alreadyQueued);
  console.log(`Nguong tin cay: ${threshold}. Hang doi dang co ${alreadyQueued} may, can them ${need} may.`);
  if (need === 0) {
    console.log('Hang doi da du, khong them gi.');
    return;
  }

  // Quet cac may da duyet (nhan do nguoi/nha ban dat), bo may bi khoa nhan
  const rows = await prisma.segmentLabel.findMany({ where: { status: 'VERIFIED', locked: false }, include: { laptop: true } });
  console.log(`Quet ${rows.length} may bang mo hinh that...`);
  const found: { row: (typeof rows)[number]; pred: Awaited<ReturnType<typeof predictSegment>> }[] = [];
  let scanned = 0;
  for (const row of rows) {
    const l = row.laptop;
    try {
      const pred = await predictWithRetry({
        cpuId: l.cpuId, gpuId: l.gpuId, ramGb: l.ramGb, ssdGb: l.ssdGb, screenInch: l.screenInch,
        resWidth: l.resWidth, resHeight: l.resHeight, refreshHz: l.refreshHz, srgb100: l.srgb100,
        weightKg: l.weightKg, batteryWh: l.batteryWh,
      });
      const nearest = pred.neighbors[0]?.distance ?? 0;
      if (pred.proba < threshold && nearest > 1e-6) found.push({ row, pred });
    } catch (err) {
      console.warn(`[bo qua] ${l.sku}: ${err instanceof Error ? err.message : err}`);
    }
    scanned += 1;
    if (scanned % 200 === 0) console.log(`  ... ${scanned}/${rows.length}`);
  }
  console.log(`Co ${found.length} may that su co do tin cay < ${threshold} va khong nam trong tap huan luyen.\n`);

  // Chia deu theo phan khuc du doan: lan luot lay may thap nhat cua moi phan khuc
  found.sort((a, b) => a.pred.proba - b.pred.proba);
  const byLabel = new Map<string, typeof found>();
  for (const f of found) byLabel.set(f.pred.label, [...(byLabel.get(f.pred.label) ?? []), f]);
  const picked: typeof found = [];
  while (picked.length < need && [...byLabel.values()].some((v) => v.length > 0)) {
    for (const list of byLabel.values()) {
      const next = list.shift();
      if (next && picked.length < need) picked.push(next);
    }
  }

  for (const { row, pred } of picked) {
    const l = row.laptop;
    console.log(
      `[hang doi] ${l.name} (${l.sku}): nhan goc ${row.segment} -> mo hinh ${pred.label} ${Math.round(pred.proba * 100)}% ` +
        `(${pred.modelVersion}), lang gieng gan nhat cach ${pred.neighbors[0]?.distance.toFixed(2)}`
    );
    if (!DRY) {
      await prisma.segmentLabel.update({
        where: { laptopId: row.laptopId },
        data: {
          segment: pred.label,
          source: 'MODEL',
          status: 'NEEDS_REVIEW',
          confidence: pred.proba,
          predictedBy: pred.modelVersion,
          probaJson: toJson(pred.distribution),
          locked: false,
          verifiedById: null,
        },
      });
    }
  }
  console.log(`\n${DRY ? '[DRY] ' : ''}Da dua ${picked.length} may vao hang doi "Can xac minh".`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    process.exit();
  });
