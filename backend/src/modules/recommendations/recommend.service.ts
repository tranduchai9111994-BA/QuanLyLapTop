import { prisma } from '../../lib/prisma';
import { mlClient } from '../../lib/mlClient';
import { toJson, fromJson } from '../../lib/json';
import { logger } from '../../lib/logger';
import { fallbackRank } from './fallback.service';
import type { Segment } from '../../constants/enums';

export interface RecommendRequestBody {
  segment: Segment | null;
  activities: string[];
  budget: { min: number; max: number };
  priorities: { performance: number; mobility: number; display: number; price: number };
  must: { ramMin?: number; ssdMin?: number; weightMax?: number; brandIds?: number[] };
  topN?: number;
  userId?: number;
  /** Trong so uy tin thuong hieu (Mo hinh C day len khi cau noi co "ben", "bao hanh tot"). */
  brandWeight?: number;
  /** Cau nhu cau goc neu nguoi dung nhap bang van ban tu do (luu vao telemetry de hoc them). */
  needText?: string;
  /** Nhan nhu cau do Mo hinh C suy ra, dung de hien thi va thong ke. */
  needLabel?: string;
}

const DEFAULT_MIN_CANDIDATES = 3;
const DEFAULT_BUDGET_RELAX_RATIO = 0.1;
const DEFAULT_TOP_N = 5;

/** FR-13 (Cau hinh tri thuc): 3 gia tri quan tri vien sua duoc qua man /admin/knowledge, luu
 * trong KnowledgeConfig (key-value chung). Doc lai TUNG LAN goi de luon dung gia tri moi nhat
 * (khong cache trong bien tinh - luu luong /recommend khong nhieu den muc can toi uu chuyen). */
async function getKnowledgeNumber(key: string, fallback: number): Promise<number> {
  const row = await prisma.knowledgeConfig.findUnique({ where: { key } });
  if (!row) return fallback;
  const v = fromJson<number>(row.valueJson, fallback);
  return typeof v === 'number' && !Number.isNaN(v) ? v : fallback;
}

async function getDefaultWeights(): Promise<Record<string, Record<string, number>> | undefined> {
  const row = await prisma.knowledgeConfig.findUnique({ where: { key: 'default_weights' } });
  if (!row) return undefined;
  return fromJson<Record<string, Record<string, number>>>(row.valueJson, undefined as any) ?? undefined;
}

async function inferSegment(activities: string[]) {
  try {
    const r = await mlClient.post('/infer-segment', { activities });
    return { segment: r.data.segment as Segment, confidence: r.data.confidence as number, mode: 'ML' as const };
  } catch (err) {
    logger.warn('infer-segment that bai, dung mac dinh OFFICE', err);
    return { segment: 'OFFICE' as Segment, confidence: 0, mode: 'FALLBACK' as const };
  }
}

/** LOC CUNG chi gom nhung dieu kien nguoi dung noi ro: ngan sach, RAM/SSD/can nang toi thieu,
 * hang may, va may bi BAN. KHONG loc theo phan khuc nua - phan khuc da chuyen sang LOC MEM
 * (la mot dac trung trong metric cua Mo hinh B), de khong loai mat may tot o phan khuc ke ben. */
async function findCandidates(segment: Segment, budgetMax: number, must: RecommendRequestBody['must']) {
  const where: any = {
    isActive: true,
    priceVnd: { lte: budgetMax },
  };
  if (must.ramMin) where.ramGb = { gte: must.ramMin };
  if (must.ssdMin) where.ssdGb = { gte: must.ssdMin };
  if (must.weightMax) where.weightKg = { lte: must.weightMax };
  if (must.brandIds?.length) where.brandId = { in: must.brandIds };

  const bannedLaptopIds = (
    await prisma.laptopPin.findMany({ where: { action: 'BAN', OR: [{ segment }, { segment: null }] } })
  ).map((p) => p.laptopId);
  if (bannedLaptopIds.length) where.id = { notIn: bannedLaptopIds };

  // `brand` can thiet cho giao dien (anh dai dien hien ten hang) va cho trong so uy tin thuong hieu
  return prisma.laptop.findMany({ where, include: { cpu: true, gpu: true, segmentLabel: true, brand: true } });
}

async function findPins(segment: Segment) {
  return prisma.laptopPin.findMany({ where: { action: 'PIN', OR: [{ segment }, { segment: null }] } });
}

/**
 * Ham TRUNG TAM cua toan bo he thong goi y - dieu phoi 7 buoc tu luc nguoi dung bam "Xem ket
 * qua" den luc tra ve danh sach 5 laptop kem giai thich. Day la noi "noi" tat ca cac phan lai:
 * Mo hinh A (suy phan khuc), Mo hinh B (xep hang), che do du phong, va ghi telemetry.
 *
 * Cac buoc thuc hien (dung thu tu):
 *   1. Neu nguoi dung KHONG chon phan khuc ro rang (segment = null, vd khi dung cau tu do va
 *      Mo hinh C khong chac chan) -> goi ML /infer-segment de Mo hinh A doan phan khuc
 *   2. Loc CUNG trong CSDL: chi giu may thoa ngan sach toi da + cac rang buoc bat buoc
 *      (RAM/SSD/can nang toi thieu, hang may) + LOAI BO may bi quan tri vien cam (BAN)
 *   3. Neu loc xong con QUA IT may (< 3) -> tu dong NOI RONG ngan sach them 10% va loc lai,
 *      danh dau `budgetRelaxed = true` de frontend hien thong bao cho nguoi dung biet
 *   4. Goi dich vu ML (Mo hinh B) de XEP HANG cac may con lai theo do phu hop voi nhu cau
 *   5. Neu ML loi/qua thoi gian cho (mang, dich vu ML dang tat,...) -> CHUYEN SANG CHE DO DU
 *      PHONG (xep hang bang cong thuc don gian trong fallback.service.ts, khong dung ML nua)
 *      - day la co che dam bao he thong VAN CHAY DUOC ngay ca khi Mo hinh ML gap su co
 *   6. Chen them may duoc QUAN TRI VIEN GHIM (PIN) neu chua co trong ket qua va van hop ngan
 *      sach - danh dau ro "De xuat tu cua hang" de nguoi dung biet day KHONG PHAI goi y cua AI
 *   7. GHI LAI toan bo phien tu van (RecommendationSession) vao CSDL - du lieu nay dung de:
 *      (a) hien lai lich su cho nguoi dung, (b) tinh KPI dashboard, (c) lam nguon hoc them cho
 *      Mo hinh C khi nguoi dung 👍 (xem retrain_from_feedback.py o ml-service)
 */
export async function recommend(body: RecommendRequestBody) {
  const startedAt = Date.now(); // do thoi gian xu ly, luu vao latencyMs de theo doi hieu nang

  // FR-13: "so ket qua mac dinh" va "ty le noi ngan sach" sua duoc qua man Cau hinh tri thuc,
  // khong con la hang so cung trong code - doc gia tri hien tai (hoac mac dinh neu chua tung
  // cau hinh) song song voi buoc suy phan khuc de khong tang do tre.
  const [defaultTopN, budgetRelaxRatio, defaultWeights] = await Promise.all([
    getKnowledgeNumber('default_top_n', DEFAULT_TOP_N),
    getKnowledgeNumber('budget_relax_ratio', DEFAULT_BUDGET_RELAX_RATIO),
    getDefaultWeights(),
  ]);
  const topN = body.topN ?? defaultTopN;

  let usedSegment = body.segment;
  let inferredSegment: Segment | null = null;
  let inferredConf: number | null = null;

  // ---- BUOC 1: suy phan khuc neu nguoi dung chua noi ro ----
  if (!usedSegment) {
    const inferred = await inferSegment(body.activities);
    usedSegment = inferred.segment;
    inferredSegment = inferred.segment;
    inferredConf = inferred.confidence;
  }

  // ---- BUOC 2 + 3: loc cung, tu dong noi rong ngan sach neu qua it ket qua ----
  let candidates = await findCandidates(usedSegment, body.budget.max, body.must);
  let budgetRelaxed = false;
  // Luu lai SO MAY truoc khi noi rong, de FE hien thong bao cu the "chi co 2 may thoa dieu
  // kien" (FR-02) thay vi cau chung chung khong noi ro con so.
  const candidatesBeforeRelax = candidates.length;
  if (candidates.length < DEFAULT_MIN_CANDIDATES) {
    budgetRelaxed = true;
    const relaxedMax = Math.round(body.budget.max * (1 + budgetRelaxRatio));
    candidates = await findCandidates(usedSegment, relaxedMax, body.must);
  }

  let mode: 'ML' | 'FALLBACK' = 'ML';
  let ideal: Record<string, number> = {};
  let weights: Record<string, number> = {};
  let items: any[] = [];
  let modelVersion: string | null = null;

  // ---- BUOC 4 + 5: goi Mo hinh B qua ML service; loi thi tu dong roi sang FALLBACK ----
  if (candidates.length === 0) {
    mode = 'FALLBACK'; // khong co ung vien nao thi khoi can goi ML, chuyen thang sang du phong
  } else {
    try {
      const r = await mlClient.post('/recommend', {
        candidateIds: candidates.map((c) => c.id),
        segment: usedSegment,
        budget: body.budget,
        priorities: body.priorities,
        must: body.must,
        topN,
        brandWeight: body.brandWeight ?? 1.0,
        baseWeightsOverride: defaultWeights,
      });
      ideal = r.data.ideal; // vector "nhu cau ly tuong" q - dung de hien Drawer "Vi sao goi y?"
      weights = r.data.weights; // trong so tung dac trung - cung dung de giai thich
      modelVersion = r.data.modelVersion;
      // Ket qua tu ML chi co `laptopId` + diem so; ghep them THONG TIN DAY DU cua laptop
      // (ten, gia, cau hinh...) da lay san o buoc 2 (candidates) de tra ve cho frontend
      const byId = new Map(candidates.map((c) => [c.id, c]));
      items = r.data.items.map((it: any) => ({ ...it, laptop: byId.get(it.laptopId) })).filter((it: any) => it.laptop);
    } catch (err) {
      // KHONG duoc de loi nay lam sap ca tinh nang goi y - day la nguyen tac "khong bao gio
      // tra loi 500 cho nguoi dung cuoi" (xem docs/09 SS4 va CLAUDE.md)
      logger.warn('ML /recommend loi hoac timeout, chuyen sang che do du phong', err);
      mode = 'FALLBACK';
    }
  }

  if (mode === 'FALLBACK') {
    // Che do du phong: KHONG dung kNN nua, chi xep hang bang cong thuc don gian dua tren
    // performance_index/value_index da tinh san trong CSDL (xem fallback.service.ts)
    items = candidates.length ? fallbackRank(candidates, body.priorities, topN) : [];
  }

  // ---- BUOC 6: chen may duoc quan tri vien GHIM (neu chua co san trong ket qua) ----
  const pins = await findPins(usedSegment);
  const existingIds = new Set(items.map((it) => it.laptopId));
  for (const pin of pins) {
    if (existingIds.has(pin.laptopId)) continue; // da co san trong ket qua AI thi khong can them
    const laptop = await prisma.laptop.findUnique({ where: { id: pin.laptopId } });
    if (!laptop || laptop.priceVnd > body.budget.max * (1 + DEFAULT_BUDGET_RELAX_RATIO)) continue;
    items.push({
      rank: items.length + 1,
      laptopId: pin.laptopId,
      distance: null,
      matchPct: null,
      isPinned: true, // frontend dung co nay de hien nhan "De xuat tu cua hang" thay vi "AI goi y"
      explanation: { strengths: [{ code: 'store_pick', params: {}, tone: 'positive' }], warnings: [] },
      laptop,
    });
  }

  const latencyMs = Date.now() - startedAt;

  const session = await prisma.recommendationSession.create({
    data: {
      userId: body.userId,
      needJson: toJson({
        activities: body.activities,
        budget: body.budget,
        priorities: body.priorities,
        must: body.must,
        // Luu cau goc + nhan Mo hinh C suy ra: day la nguon du lieu THAT de bo sung vao tap
        // huan luyen Mo hinh C sau nay (tieu chi 3 - he thong thong minh len theo thoi gian)
        needText: body.needText,
        needLabel: body.needLabel,
      }),
      inferredSegment,
      inferredConf,
      usedSegment,
      weightsJson: toJson(weights),
      idealJson: toJson(ideal),
      clfVersion: modelVersion,
      isFallback: mode === 'FALLBACK',
      budgetRelaxed,
      latencyMs,
      items: {
        create: items.map((it) => ({
          laptopId: it.laptopId,
          rank: it.rank,
          distance: it.distance ?? 0,
          matchPct: it.matchPct ?? 0,
          isPinned: !!it.isPinned,
          explanationJson: toJson(it.explanation),
        })),
      },
    },
  });

  return {
    sessionId: session.id,
    segment: {
      used: usedSegment,
      inferred: inferredSegment,
      confidence: inferredConf,
    },
    mode,
    budgetRelaxed,
    candidatesBeforeRelax,
    ideal,
    weights,
    items,
    modelVersion,
    latencyMs,
  };
}
