/**
 * Data mau cho man "Duyet nhan phan khuc" (AdminReviewQueue.tsx, UC-10) - dat 1 vai may THAT
 * trong catalog vao trang thai NEEDS_REVIEW voi do tin cay < nguong (confidence_threshold, mac
 * dinh 0.6) de hang doi khong con rong luc demo/bao ve do an. Khong dung du doan that tu ML
 * service (du lieu tong hop qua "sach" nen hiem khi ra do tin cay thap that su) - thay vao do mo
 * phong CAC TRUONG HOP RANH GIOI THUC TE (vd may nhe/pin tot nhung CPU/GPU manh -> ranh gioi
 * OFFICE/ULTRABOOK; may "ProArt"/"Omen" vua co GPU roi vua dinh huong do hoa -> ranh gioi
 * GAMING/CREATOR), giu nguyen SKU that trong DB de nhan vao "Xem chi tiet" van ra dung thong so may.
 *
 * Chay: npx tsx scripts/seedReviewQueue.ts
 */
import { prisma } from '../src/lib/prisma';
import { toJson } from '../src/lib/json';

const SEGMENTS = ['OFFICE', 'ULTRABOOK', 'GAMING', 'CREATOR'] as const;
type Segment = (typeof SEGMENTS)[number];

interface Scenario {
  sku: string;
  segment: Segment; // nhan AI tam gan (chua chac chan)
  distribution: Record<Segment, number>; // phai cong lai = 1
}

const SCENARIOS: Scenario[] = [
  {
    // Nhe, pin tot nhung CPU/GPU cung kha manh -> ranh gioi Van phong / Mong nhe
    sku: 'AVI-00874',
    segment: 'OFFICE',
    distribution: { OFFICE: 0.52, ULTRABOOK: 0.41, GAMING: 0.05, CREATOR: 0.02 },
  },
  {
    sku: 'MAS-00388',
    segment: 'ULTRABOOK',
    distribution: { OFFICE: 0.44, ULTRABOOK: 0.47, GAMING: 0.06, CREATOR: 0.03 },
  },
  {
    // May "Swift" (dong mong nhe) nhung cau hinh gan bang may van phong pho thong
    sku: 'ACE-00845',
    segment: 'ULTRABOOK',
    distribution: { OFFICE: 0.38, ULTRABOOK: 0.5, GAMING: 0.08, CREATOR: 0.04 },
  },
  {
    // May "Nitro" (dong gaming) nhung GPU/man hinh cung hop do hoa -> ranh gioi Gaming/Do hoa
    sku: 'ACE-00421',
    segment: 'CREATOR',
    distribution: { OFFICE: 0.02, ULTRABOOK: 0.03, GAMING: 0.41, CREATOR: 0.54 },
  },
  {
    // May "ProArt" (dong do hoa) nhung dang gan nhan Gaming trong du lieu hien co
    sku: 'ASU-00054',
    segment: 'GAMING',
    distribution: { OFFICE: 0.01, ULTRABOOK: 0.02, GAMING: 0.48, CREATOR: 0.49 },
  },
  {
    // May "Omen" (dong gaming) nhung cau hinh man hinh/GPU thien ve do hoa
    sku: 'HP-00239',
    segment: 'CREATOR',
    distribution: { OFFICE: 0.01, ULTRABOOK: 0.02, GAMING: 0.39, CREATOR: 0.58 },
  },
];

async function main() {
  let done = 0;
  for (const sc of SCENARIOS) {
    const laptop = await prisma.laptop.findUnique({ where: { sku: sc.sku } });
    if (!laptop) {
      console.warn(`[bo qua] Khong tim thay SKU ${sc.sku} trong catalog hien tai`);
      continue;
    }
    const confidence = sc.distribution[sc.segment];
    await prisma.segmentLabel.upsert({
      where: { laptopId: laptop.id },
      create: {
        laptopId: laptop.id,
        segment: sc.segment,
        source: 'MODEL',
        status: 'NEEDS_REVIEW',
        confidence,
        predictedBy: 'demo-seed-review-queue',
        probaJson: toJson(sc.distribution),
      },
      update: {
        segment: sc.segment,
        source: 'MODEL',
        status: 'NEEDS_REVIEW',
        confidence,
        predictedBy: 'demo-seed-review-queue',
        probaJson: toJson(sc.distribution),
        locked: false,
        verifiedById: null,
      },
    });
    console.log(`[ok] ${laptop.name} (${laptop.sku}) -> ${sc.segment} tam gan, tin cay ${Math.round(confidence * 100)}%`);
    done += 1;
  }
  console.log(`\nDa dua ${done}/${SCENARIOS.length} may vao hang doi "Can xac minh".`);
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
