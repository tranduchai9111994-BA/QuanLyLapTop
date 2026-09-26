import 'dotenv/config';
import cron from 'node-cron';
import { createApp } from './app';
import { snapshotSync } from './modules/jobs/snapshotSync';
import { logger } from './lib/logger';

const PORT = Number(process.env.PORT ?? 4000);

const app = createApp();

app.listen(PORT, () => {
  logger.info(`SmartLap backend dang chay tai http://localhost:${PORT}`);
  snapshotSync();
});

// dong bo lai catalog moi ngay 02:00 (docs/06 §5)
cron.schedule('0 2 * * *', () => snapshotSync());
