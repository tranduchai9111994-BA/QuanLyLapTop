import 'dotenv/config';
import cron from 'node-cron';
import { createApp } from './app';
import { snapshotSync } from './modules/jobs/snapshotSync';
import { alertScan } from './modules/jobs/alertScan';
import { logger } from './lib/logger';
import { env } from './config/env';

const PORT = env.port;

const app = createApp();

/** ML service (Python/uvicorn) thuong khoi dong cham hon backend (Node). Neu dong bo lan dau
 * that bai vi ML chua kip san sang (ECONNREFUSED), thu lai vai lan thay vi bo cuoc va cho den
 * 02:00 hom sau (cron). Cac lan CRUD sau nay van goi snapshotSync() binh thuong. */
async function syncWithRetry(maxAttempts = 5, delayMs = 3000) {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const result = await snapshotSync();
    if (result) return;
    if (attempt < maxAttempts) {
      logger.warn(`Dong bo catalog that bai (lan ${attempt}/${maxAttempts}), thu lai sau ${delayMs}ms`);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  logger.warn('Dong bo catalog that bai sau nhieu lan thu - se tu dong bo lai khi co CRUD hoac 02:00 hang ngay');
}

app.listen(PORT, () => {
  logger.info(`SmartLap backend dang chay tai http://localhost:${PORT}`);
  syncWithRetry();
});

// dong bo lai catalog moi ngay 02:00 (docs/06 §5)
cron.schedule('0 2 * * *', () => snapshotSync());

// Quet canh bao (FR-14, docs/09 §6) moi gio - "REVIEW_BACKLOG"/"FALLBACK_HIGH" can phat hien
// nhanh hon 1 lan/ngay; cac luat con lai tu bo qua neu chua du du lieu (< 30 phien/7 ngay).
cron.schedule('0 * * * *', () => alertScan().catch((err) => logger.warn('alertScan that bai', err)));
// Quet ngay 1 lan luc khoi dong de Dashboard co du lieu ma khong phai cho den dinh gio dau tien.
alertScan().catch((err) => logger.warn('alertScan (khoi dong) that bai', err));
