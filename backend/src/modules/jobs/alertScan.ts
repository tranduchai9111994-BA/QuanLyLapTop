import { prisma } from '../../lib/prisma';
import { fromJson } from '../../lib/json';
import { logger } from '../../lib/logger';

// Trien khai dung 6 luat trong docs/09_VONG_DOI_TRI_TUE.md muc 6 - "cua so truot 7 ngay, toi
// thieu 30 phien" ap dung cho 4/6 luat (nhung luat can du lieu on dinh moi co y nghia thong ke);
// FALLBACK_HIGH dung cua so 24h rieng (phan ung nhanh hon voi su co ML service); REVIEW_BACKLOG
// khong can cua so thoi gian (chi dem hang doi hien tai).
const WINDOW_DAYS = 7;
const MIN_SESSIONS = 30;

interface AlertThresholds {
  lowSatisfaction: number;
  fallbackHighPct: number;
  latencyHighMs: number;
  lowConfidenceRatePct: number;
  reviewBacklogCount: number;
}

// Gia tri mac dinh KHOP dung bang luat trong docs/09 - nguoi dung sua duoc qua
// KnowledgeConfig key "alert_thresholds" (man Cau hinh tri thuc, FR-13).
const DEFAULT_THRESHOLDS: AlertThresholds = {
  lowSatisfaction: 0.4,
  fallbackHighPct: 0.05,
  latencyHighMs: 800,
  lowConfidenceRatePct: 0.3,
  reviewBacklogCount: 20,
};

async function getThresholds(): Promise<AlertThresholds> {
  const row = await prisma.knowledgeConfig.findUnique({ where: { key: 'alert_thresholds' } });
  if (!row) return DEFAULT_THRESHOLDS;
  return { ...DEFAULT_THRESHOLDS, ...fromJson<Partial<AlertThresholds>>(row.valueJson, {}) };
}

/** Ghi 1 canh bao MOI - neu da co canh bao CUNG MA dang o trang thai chua xu ly (`resolved:
 * false`) thi bo qua, tranh spam hang tram dong lap moi lan quet (chay dinh ky, vd moi gio). */
async function raise(
  code: string,
  severity: 'INFO' | 'WARN' | 'CRITICAL',
  message: string,
  value?: number,
  threshold?: number
) {
  const existing = await prisma.alertLog.findFirst({ where: { code, resolved: false } });
  if (existing) return;
  await prisma.alertLog.create({ data: { code, severity, message, value, threshold } });
  logger.warn(`[alertScan] ${code}: ${message}`);
}

/** Quet toan bo 6 luat canh bao (FR-14) - goi dinh ky bang cron (server.ts) hoac thu cong qua
 * nut "Quét ngay" tren Dashboard (dashboard.routes.ts). Moi luat doc lap, 1 luat loi khong lam
 * hong cac luat con lai (bao ve bang try/catch rieng cho tung nhom). */
export async function alertScan() {
  const thresholds = await getThresholds();
  const windowStart = new Date(Date.now() - WINDOW_DAYS * 86_400_000);
  const oneDayAgo = new Date(Date.now() - 86_400_000);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000);

  const sessions7d = await prisma.recommendationSession.count({ where: { createdAt: { gte: windowStart } } });
  const enoughData = sessions7d >= MIN_SESSIONS;

  try {
    if (enoughData) {
      const [likeCount, dislikeCount] = await Promise.all([
        prisma.interactionEvent.count({ where: { type: 'LIKE', createdAt: { gte: windowStart } } }),
        prisma.interactionEvent.count({ where: { type: 'DISLIKE', createdAt: { gte: windowStart } } }),
      ]);
      const total = likeCount + dislikeCount;
      if (total > 0) {
        const rate = likeCount / total;
        if (rate < thresholds.lowSatisfaction) {
          await raise(
            'LOW_SATISFACTION',
            'WARN',
            `Tỷ lệ hài lòng ${(rate * 100).toFixed(1)}% dưới ngưỡng ${(thresholds.lowSatisfaction * 100).toFixed(0)}% (7 ngày gần nhất)`,
            rate,
            thresholds.lowSatisfaction
          );
        }
      }
    }
  } catch (err) {
    logger.warn('[alertScan] loi kiem tra LOW_SATISFACTION', err);
  }

  try {
    const sessions24h = await prisma.recommendationSession.count({ where: { createdAt: { gte: oneDayAgo } } });
    if (sessions24h > 0) {
      const fallback24h = await prisma.recommendationSession.count({
        where: { createdAt: { gte: oneDayAgo }, isFallback: true },
      });
      const rate = fallback24h / sessions24h;
      if (rate > thresholds.fallbackHighPct) {
        await raise(
          'FALLBACK_HIGH',
          'CRITICAL',
          `Tỷ lệ dự phòng ${(rate * 100).toFixed(1)}% vượt ngưỡng ${(thresholds.fallbackHighPct * 100).toFixed(0)}% (24 giờ gần nhất)`,
          rate,
          thresholds.fallbackHighPct
        );
      }
    }
  } catch (err) {
    logger.warn('[alertScan] loi kiem tra FALLBACK_HIGH', err);
  }

  try {
    if (enoughData) {
      const latencies = await prisma.recommendationSession.findMany({
        where: { createdAt: { gte: windowStart } },
        select: { latencyMs: true },
        orderBy: { latencyMs: 'asc' },
      });
      if (latencies.length > 0) {
        const idx = Math.min(latencies.length - 1, Math.ceil(0.95 * latencies.length) - 1);
        const p95 = latencies[idx].latencyMs;
        if (p95 > thresholds.latencyHighMs) {
          await raise(
            'LATENCY_HIGH',
            'WARN',
            `Độ trễ p95 ${p95}ms vượt ngưỡng ${thresholds.latencyHighMs}ms (7 ngày gần nhất)`,
            p95,
            thresholds.latencyHighMs
          );
        }
      }
    }
  } catch (err) {
    logger.warn('[alertScan] loi kiem tra LATENCY_HIGH', err);
  }

  try {
    const newLaptops = await prisma.laptop.findMany({
      where: { createdAt: { gte: thirtyDaysAgo } },
      select: { segmentLabel: { select: { confidence: true } } },
    });
    if (newLaptops.length > 0) {
      const lowConf = newLaptops.filter((l) => (l.segmentLabel?.confidence ?? 1) < 0.6).length;
      const rate = lowConf / newLaptops.length;
      if (rate > thresholds.lowConfidenceRatePct) {
        await raise(
          'LOW_CONFIDENCE_RATE',
          'WARN',
          `${(rate * 100).toFixed(1)}% máy mới nhập trong 30 ngày có độ tin cậy phân khúc dưới 0.6 — có thể dữ liệu đã "trôi", nên huấn luyện lại Mô hình A`,
          rate,
          thresholds.lowConfidenceRatePct
        );
      }
    }
  } catch (err) {
    logger.warn('[alertScan] loi kiem tra LOW_CONFIDENCE_RATE', err);
  }

  try {
    const backlogCount = await prisma.segmentLabel.count({ where: { status: 'NEEDS_REVIEW' } });
    if (backlogCount > thresholds.reviewBacklogCount) {
      await raise(
        'REVIEW_BACKLOG',
        'INFO',
        `${backlogCount} nhãn đang chờ xác minh, vượt ngưỡng ${thresholds.reviewBacklogCount}`,
        backlogCount,
        thresholds.reviewBacklogCount
      );
    }
  } catch (err) {
    logger.warn('[alertScan] loi kiem tra REVIEW_BACKLOG', err);
  }

  try {
    if (enoughData) {
      const feedbackEvents = await prisma.interactionEvent.findMany({
        where: { type: { in: ['LIKE', 'DISLIKE'] }, createdAt: { gte: windowStart }, sessionId: { not: null } },
        select: { sessionId: true, laptopId: true, type: true },
      });
      if (feedbackEvents.length > 0) {
        const sessionIds = [...new Set(feedbackEvents.map((f) => f.sessionId!))];
        const items = await prisma.recommendationItem.findMany({
          where: { sessionId: { in: sessionIds } },
          select: { sessionId: true, laptopId: true, rank: true },
        });
        const rankMap = new Map<string, number>();
        for (const it of items) rankMap.set(`${it.sessionId}:${it.laptopId}`, it.rank);

        let rank1Like = 0;
        let rank1Total = 0;
        let otherLike = 0;
        let otherTotal = 0;
        for (const f of feedbackEvents) {
          const rank = rankMap.get(`${f.sessionId}:${f.laptopId}`);
          if (rank == null) continue;
          if (rank === 1) {
            rank1Total += 1;
            if (f.type === 'LIKE') rank1Like += 1;
          } else {
            otherTotal += 1;
            if (f.type === 'LIKE') otherLike += 1;
          }
        }
        if (rank1Total > 0 && otherTotal > 0) {
          const rank1Rate = rank1Like / rank1Total;
          const otherRate = otherLike / otherTotal;
          if (rank1Rate < otherRate) {
            await raise(
              'RANK1_WEAK',
              'WARN',
              `Tỷ lệ thích hạng #1 (${(rank1Rate * 100).toFixed(1)}%) thấp hơn hạng #2–#5 (${(otherRate * 100).toFixed(1)}%) — nên xem lại trọng số Mô hình B`,
              rank1Rate,
              otherRate
            );
          }
        }
      }
    }
  } catch (err) {
    logger.warn('[alertScan] loi kiem tra RANK1_WEAK', err);
  }
}
