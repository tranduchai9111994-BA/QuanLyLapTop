import cors from 'cors';
import express from 'express';
import { requestId } from './middlewares/requestId';
import { errorHandler, notFoundHandler } from './middlewares/error';
import { authRouter } from './modules/auth/auth.routes';
import { laptopsRouter } from './modules/laptops/laptops.routes';
import { brandsRouter } from './modules/brands/brands.routes';
import { benchmarksRouter } from './modules/benchmarks/benchmarks.routes';
import { recommendationsRouter } from './modules/recommendations/recommendations.routes';
import { eventsRouter } from './modules/feedback/events.routes';
import { favoritesRouter, sessionsRouter } from './modules/users/favorites.routes';
import { modelsRouter } from './modules/models/models.routes';
import { knowledgeRouter } from './modules/knowledge/knowledge.routes';
import { dashboardRouter, feedbackSummaryRouter } from './modules/dashboard/dashboard.routes';
import { labelsRouter } from './modules/labels/labels.routes';

/** Dung 1 ham `createApp()` rieng (thay vi goi `app.listen` thang o day) de file nay TACH BIET
 * khoi viec KHOI DONG that su (server.ts) - cho phep test tu dong (vd supertest) tao app roi
 * goi API ma khong can mo cong mang that, va tranh vong lap import voi cron/logger o server.ts. */
export function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());
  app.use(requestId);

  app.get('/api/health', (_req, res) => res.json({ success: true, data: { status: 'ok' } }));

  app.use('/api/auth', authRouter);
  app.use('/api/laptops', laptopsRouter);
  app.use('/api/brands', brandsRouter);
  app.use('/api/benchmarks', benchmarksRouter);
  app.use('/api/recommendations', recommendationsRouter);
  app.use('/api/events', eventsRouter);
  app.use('/api/me/favorites', favoritesRouter);
  app.use('/api/me/sessions', sessionsRouter);
  app.use('/api/models', modelsRouter);
  app.use('/api/knowledge', knowledgeRouter);
  app.use('/api/dashboard', dashboardRouter);
  app.use('/api/feedback', feedbackSummaryRouter);
  app.use('/api/labels', labelsRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
