import crypto from 'crypto';

export function hashApiKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex');
}

export function generateApiKey(): { raw: string; prefix: string; hash: string } {
  const raw = crypto.randomBytes(32).toString('hex');
  const prefix = 'lg_live_';
  return { raw: `${prefix}${raw}`, prefix, hash: hashApiKey(`${prefix}${raw}`) };
}

export function verifyWebhookSignature(payload: string, signature: string, secret: string): boolean {
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}
