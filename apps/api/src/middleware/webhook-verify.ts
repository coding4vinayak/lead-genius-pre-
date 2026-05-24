import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { config } from '../config.js';
import { AppError } from '../lib/errors.js';

export function verifyWebhook(req: Request, _res: Response, next: NextFunction) {
  const signature = req.headers['x-webhook-signature'] as string;
  if (!config.webhookSecret || !signature) {
    return next();
  }

  const payload = JSON.stringify(req.body);
  const expected = crypto
    .createHmac('sha256', config.webhookSecret)
    .update(payload)
    .digest('hex');

  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return next(new AppError(401, 'Invalid webhook signature'));
  }

  next();
}
