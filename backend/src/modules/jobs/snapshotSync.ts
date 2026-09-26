import { prisma } from '../../lib/prisma';
import { mlClient } from '../../lib/mlClient';
import { logger } from '../../lib/logger';

export async function snapshotSync() {
  const laptops = await prisma.laptop.findMany({
    where: { isActive: true },
    include: { cpu: true, gpu: true, segmentLabel: true },
  });

  const items = laptops
    .filter((l) => l.segmentLabel)
    .map((l) => ({
      id: l.id,
      cpu_score: l.cpu.score,
      gpu_score: l.gpu.score,
      gpu_dedicated: l.gpu.dedicated ? 1 : 0,
      ram_gb: l.ramGb,
      ssd_gb: l.ssdGb,
      screen_inch: l.screenInch,
      ppi: l.ppi,
      refresh_hz: l.refreshHz,
      srgb_100: l.srgb100 ? 1 : 0,
      weight_kg: l.weightKg,
      battery_wh: l.batteryWh ?? 55,
      price_vnd: l.priceVnd,
      segment: l.segmentLabel!.segment,
      name: l.name,
      gpu_model: l.gpu.displayName,
    }));

  try {
    const r = await mlClient.post('/catalog/sync', { items });
    logger.info(`snapshotSync: da dong bo ${items.length} laptop`, r.data);
    return r.data;
  } catch (err) {
    logger.error('snapshotSync that bai (ML service co the dang tat)', err);
    return null;
  }
}
