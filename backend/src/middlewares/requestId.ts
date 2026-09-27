import { randomUUID } from 'crypto';
import type { NextFunction, Request, Response } from 'express';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      requestId: string;
    }
  }
}

/** Gan 1 ID ngau nhien duy nhat cho MOI request ngay tu dau - dung khi doc log de theo dau
 * VET DUONG DI cua 1 request cu the qua nhieu dong log khac nhau (huu ich khi debug loi hiem
 * gap trong production, dac biet khi nhieu request chay dong thoi). */
export function requestId(req: Request, _res: Response, next: NextFunction) {
  req.requestId = randomUUID();
  next();
}
