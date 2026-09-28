/**
 * Data mau cho khoi "Cảnh báo đang mở" tren Dashboard (FR-14, docs/09_VONG_DOI_TRI_TUE.md muc 6) -
 * khoi nay truoc gio luon rong luc demo vi `alertScan()` chi tao ban ghi khi CO THAT su co vuot
 * nguong (can du lieu telemetry that trong 7-30 ngay), kho tai hien trong moi truong demo. Chen
 * thang 1 dong AlertLog cho MOI 6 luat trong alertScan.ts (dung dung ma + gan dung format thong
 * diep + severity nhu code that tao ra) de man Dashboard hien du 6 dong thay vi "Trong".
 *
 * Chay: npx tsx scripts/seedAlerts.ts
 */
import { prisma } from '../src/lib/prisma';

interface AlertSeed {
  code: string;
  severity: 'INFO' | 'WARN' | 'CRITICAL';
  message: string;
  value: number;
  threshold: number;
}

// Thong diep khop dung format string ma alertScan.ts sinh ra cho tung luat (xem cac loi goi
// `raise(...)` trong file do) - chi khac o cho gia tri la SO LIEU MO PHONG thay vi tinh that tu
// RecommendationSession/InteractionEvent.
const ALERT_SEEDS: AlertSeed[] = [
  {
    code: 'LOW_SATISFACTION',
    severity: 'WARN',
    message: 'Tỷ lệ hài lòng 34.5% dưới ngưỡng 40% (7 ngày gần nhất)',
    value: 0.345,
    threshold: 0.4,
  },
  {
    code: 'FALLBACK_HIGH',
    severity: 'CRITICAL',
    message: 'Tỷ lệ dự phòng 8.2% vượt ngưỡng 5% (24 giờ gần nhất)',
    value: 0.082,
    threshold: 0.05,
  },
  {
    code: 'LATENCY_HIGH',
    severity: 'WARN',
    message: 'Độ trễ p95 954ms vượt ngưỡng 800ms (7 ngày gần nhất)',
    value: 954,
    threshold: 800,
  },
  {
    code: 'LOW_CONFIDENCE_RATE',
    severity: 'WARN',
    message:
      '37.5% máy mới nhập trong 30 ngày có độ tin cậy phân khúc dưới 0.6 — có thể dữ liệu đã "trôi", nên huấn luyện lại Mô hình A',
    value: 0.375,
    threshold: 0.3,
  },
  {
    code: 'REVIEW_BACKLOG',
    severity: 'INFO',
    message: '24 nhãn đang chờ xác minh, vượt ngưỡng 20',
    value: 24,
    threshold: 20,
  },
  {
    code: 'RANK1_WEAK',
    severity: 'WARN',
    message: 'Tỷ lệ thích hạng #1 (58.0%) thấp hơn hạng #2–#5 (67.0%) — nên xem lại trọng số Mô hình B',
    value: 0.58,
    threshold: 0.67,
  },
];

async function main() {
  let done = 0;
  for (const a of ALERT_SEEDS) {
    // Giong logic `raise()` that: bo qua neu da co canh bao CUNG MA dang mo, tranh tao trung
    // khi chay lai script hoac khi alertScan that cung vua tao ban ghi tuong tu.
    const existing = await prisma.alertLog.findFirst({ where: { code: a.code, resolved: false } });
    if (existing) {
      console.log(`[bo qua] Đã có cảnh báo ${a.code} đang mở`);
      continue;
    }
    await prisma.alertLog.create({
      data: { code: a.code, severity: a.severity, message: a.message, value: a.value, threshold: a.threshold },
    });
    console.log(`[ok] ${a.severity} ${a.code}: ${a.message}`);
    done += 1;
  }
  console.log(`\nDa tao ${done}/${ALERT_SEEDS.length} canh bao moi.`);
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
