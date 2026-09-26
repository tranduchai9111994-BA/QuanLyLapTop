import 'dotenv/config';
import { readFileSync } from 'fs';
import { join } from 'path';
import { PrismaClient } from '@prisma/client';
import { toJson } from '../src/lib/json';

const prisma = new PrismaClient();
const DATA_DIR = join(process.cwd(), '..', 'data');

/** Sinh phien tu van gia lap tu persona (docs/03 §6) de dashboard/man phan hoi co du lieu khi demo.
 * Danh dau needJson.synthetic = true de loai khoi thong ke that neu can. */
async function main() {
  const personas = JSON.parse(readFileSync(join(DATA_DIR, 'personas', 'personas.json'), 'utf-8'));
  const laptops = await prisma.laptop.findMany({ include: { segmentLabel: true }, take: 315 });
  const bySegment = new Map<string, typeof laptops>();
  for (const l of laptops) {
    const seg = l.segmentLabel?.segment ?? 'OFFICE';
    if (!bySegment.has(seg)) bySegment.set(seg, []);
    bySegment.get(seg)!.push(l);
  }

  const reasons = ['TOO_EXPENSIVE', 'TOO_HEAVY', 'WEAK_PERFORMANCE', 'POOR_DISPLAY', 'BRAND', 'OTHER'];
  let sessionCount = 0;
  let eventCount = 0;

  for (let i = 0; i < 400; i += 1) {
    const persona = personas[i % personas.length];
    const expectSegments: string[] = persona.expect.segment_in ?? ['OFFICE'];
    const segment = expectSegments[i % expectSegments.length];
    const candidates = bySegment.get(segment) ?? laptops;
    if (!candidates.length) continue;

    const shuffled = [...candidates].sort(() => Math.random() - 0.5).slice(0, 5);
    const createdAt = new Date(Date.now() - Math.floor(Math.random() * 30) * 86_400_000);

    const session = await prisma.recommendationSession.create({
      data: {
        needJson: toJson({ ...persona.input, synthetic: true, personaId: persona.id }),
        usedSegment: segment,
        weightsJson: toJson({}),
        idealJson: toJson({}),
        isFallback: Math.random() < 0.05,
        budgetRelaxed: false,
        latencyMs: 50 + Math.floor(Math.random() * 150),
        createdAt,
        items: {
          create: shuffled.map((l, idx) => ({
            laptopId: l.id,
            rank: idx + 1,
            distance: Math.random() * 2,
            matchPct: 60 + Math.random() * 35,
            explanationJson: toJson({ strengths: [], warnings: [] }),
          })),
        },
      },
    });
    sessionCount += 1;

    const meetsExpect = Math.random() < 0.75;
    const target = shuffled[0];
    if (target) {
      await prisma.interactionEvent.create({
        data: {
          sessionId: session.id,
          laptopId: target.id,
          type: meetsExpect ? 'LIKE' : 'DISLIKE',
          reason: meetsExpect ? null : reasons[Math.floor(Math.random() * reasons.length)],
          createdAt,
        },
      });
      eventCount += 1;
    }
  }

  console.log(`Da sinh ${sessionCount} phien tu van + ${eventCount} su kien tuong tac gia lap`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
