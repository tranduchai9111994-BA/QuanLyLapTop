import { Router } from 'express';
import { z } from 'zod';
import { optionalAuth } from '../../middlewares/auth';
import { mlClient } from '../../lib/mlClient';
import * as recommendService from './recommend.service';

export const recommendationsRouter = Router();

const prioritySchema = z.object({
  performance: z.number().min(1).max(5),
  mobility: z.number().min(1).max(5),
  display: z.number().min(1).max(5),
  price: z.number().min(1).max(5),
});

const recommendSchema = z.object({
  segment: z.enum(['OFFICE', 'ULTRABOOK', 'GAMING', 'CREATOR']).nullable(),
  activities: z.array(z.string()).default([]),
  budget: z.object({ min: z.number(), max: z.number() }),
  priorities: prioritySchema,
  must: z
    .object({
      ramMin: z.number().optional(),
      ssdMin: z.number().optional(),
      weightMax: z.number().optional(),
      brandIds: z.array(z.number()).optional(),
    })
    .default({}),
  topN: z.number().optional(),
});

recommendationsRouter.post('/', optionalAuth, async (req, res, next) => {
  try {
    const body = recommendSchema.parse(req.body);
    const data = await recommendService.recommend({ ...body, userId: req.user?.id });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

const inferSchema = z.object({ activities: z.array(z.string()) });

recommendationsRouter.post('/infer-segment', async (req, res, next) => {
  try {
    const body = inferSchema.parse(req.body);
    const r = await mlClient.post('/infer-segment', body);
    res.json({ success: true, data: r.data });
  } catch (err) {
    next(err);
  }
});
