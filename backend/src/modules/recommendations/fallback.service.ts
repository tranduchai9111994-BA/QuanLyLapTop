import type { Laptop } from '@prisma/client';

/** Che do du phong khi ML service loi/timeout (docs/09 SS4): xep hang theo value_index /
 * performance_index tuy uu tien, khong goi mo hinh. */
export function fallbackRank(
  candidates: (Laptop & { cpu: { score: number }; gpu: { score: number } })[],
  priorities: { performance: number; mobility: number; display: number; price: number },
  topN: number
) {
  // Cong thuc DON GIAN (khong phai kNN - day chinh la diem khac biet voi Mo hinh B that su):
  // diem cang cao cang tot, cong theo hieu nang (uu tien cao -> cong nhieu), cong theo do "dang
  // tien" (valueIdx, nhan 5 de cung thang do voi performanceIdx), TRU theo can nang (uu tien di
  // dong cao -> tru nhieu hon cho may nang). Cac he so 5/3 la HANG SO KINH NGHIEM de 3 yeu to
  // co anh huong tuong duong nhau, khong phai tinh toan khoa hoc - chi la giai phap TAM THOI
  // khi khong goi duoc kNN that.
  const wPerf = priorities.performance;
  const wPrice = priorities.price;
  const scored = candidates.map((l) => {
    const score = wPerf * l.performanceIdx + wPrice * l.valueIdx * 5 - priorities.mobility * l.weightKg * 3;
    return { laptop: l, score };
  });
  scored.sort((a, b) => b.score - a.score);
  const top = scored.slice(0, topN);
  const maxScore = top[0]?.score ?? 1;
  return top.map((s, idx) => ({
    rank: idx + 1,
    laptopId: s.laptop.id,
    distance: 0,
    matchPct: Math.max(40, Math.min(95, Math.round((s.score / (maxScore || 1)) * 100))),
    explanation: {
      strengths: [
        { code: 'price_under', params: { money: '' }, tone: 'positive' },
      ],
      warnings: [],
    },
    laptop: s.laptop,
  }));
}
