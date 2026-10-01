import 'dotenv/config';
import cron from 'node-cron';
import { createApp } from './app';
import { snapshotSync } from './modules/jobs/snapshotSync';
import { alertScan } from './modules/jobs/alertScan';
import { logger } from './lib/logger';
import { env } from './config/env';

const PORT = env.port;

const app = createApp();

/** ML service (Python/uvicorn) khởi động chậm hơn backend (Node) rất nhiều - đo thực tế trên máy
 * dev có lúc mất ~110 giây (import pandas/sklearn + huấn luyện Mô hình C lúc startup). Nếu đồng
 * bộ lần đầu thất bại vì ML chưa sẵn sàng (ECONNREFUSED), phải thử lại ĐỦ LÂU (60 lần x 5s = 5
 * phút) thay vì bỏ cuộc sau 15 giây - bỏ cuộc sớm khiến ML chạy với catalog rỗng (trả 409) và mọi
 * lượt gợi ý rơi vào chế độ dự phòng cho tới 02:00 hôm sau. Các lần CRUD sau này vẫn gọi
 * snapshotSync() bình thường. */
async function syncWithRetry(maxAttempts = 60, delayMs = 5000) {
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
