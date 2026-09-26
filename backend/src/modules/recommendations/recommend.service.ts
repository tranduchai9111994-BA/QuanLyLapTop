import { prisma } from '../../lib/prisma';
import { mlClient } from '../../lib/mlClient';
import { toJson } from '../../lib/json';
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
const DEFAULT_CONFIDENCE_THRESHOLD = 0.6;

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

  return prisma.laptop.findMany({ where, include: { cpu: true, gpu: true, segmentLabel: true } });
}

async function findPins(segment: Segment) {
  return prisma.laptopPin.findMany({ where: { action: 'PIN', OR: [{ segment }, { segment: null }] } });
}

export async function recommend(body: RecommendRequestBody) {
  const startedAt = Date.now();
  const topN = body.topN ?? 5;

  let usedSegment = body.segment;
  let inferredSegment: Segment | null = null;
  let inferredConf: number | null = null;

  if (!usedSegment) {
    const inferred = await inferSegment(body.activities);
    usedSegment = inferred.segment;
    inferredSegment = inferred.segment;
    inferredConf = inferred.confidence;
  }

  let candidates = await findCandidates(usedSegment, body.budget.max, body.must);
  let budgetRelaxed = false;
  if (candidates.length < DEFAULT_MIN_CANDIDATES) {
    budgetRelaxed = true;
    const relaxedMax = Math.round(body.budget.max * (1 + DEFAULT_BUDGET_RELAX_RATIO));
    candidates = await findCandidates(usedSegment, relaxedMax, body.must);
  }

  let mode: 'ML' | 'FALLBACK' = 'ML';
  let ideal: Record<string, number> = {};
  let weights: Record<string, number> = {};
  let items: any[] = [];
  let modelVersion: string | null = null;

  if (candidates.length === 0) {
    mode = 'FALLBACK';
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
      });
      ideal = r.data.ideal;
      weights = r.data.weights;
      modelVersion = r.data.modelVersion;
      const byId = new Map(candidates.map((c) => [c.id, c]));
      items = r.data.items.map((it: any) => ({ ...it, laptop: byId.get(it.laptopId) })).filter((it: any) => it.laptop);
    } catch (err) {
      logger.warn('ML /recommend loi hoac timeout, chuyen sang che do du phong', err);
      mode = 'FALLBACK';
    }
  }

  if (mode === 'FALLBACK') {
    items = candidates.length ? fallbackRank(candidates, body.priorities, topN) : [];
  }

  const pins = await findPins(usedSegment);
  const existingIds = new Set(items.map((it) => it.laptopId));
  for (const pin of pins) {
    if (existingIds.has(pin.laptopId)) continue;
    const laptop = await prisma.laptop.findUnique({ where: { id: pin.laptopId } });
    if (!laptop || laptop.priceVnd > body.budget.max * (1 + DEFAULT_BUDGET_RELAX_RATIO)) continue;
    items.push({
      rank: items.length + 1,
      laptopId: pin.laptopId,
      distance: null,
      matchPct: null,
      isPinned: true,
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
    ideal,
    weights,
    items,
    modelVersion,
    latencyMs,
  };
}
