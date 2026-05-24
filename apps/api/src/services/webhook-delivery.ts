import crypto from 'crypto';
import { prisma } from '../db.js';
import { webhookQueue } from '../queue/index.js';
import { logger } from '../lib/logger.js';

const BASE_RETRY_DELAY_MS = 30000;

export async function deliverWebhook(deliveryId: string): Promise<void> {
  const delivery = await prisma.webhookDelivery.findUnique({
    where: { id: deliveryId },
    include: { webhook: true },
  });

  if (!delivery) {
    logger.error('Webhook delivery not found', { deliveryId });
    return;
  }

  const webhook = delivery.webhook as {
    url: string;
    secret?: string | null;
    headers?: Record<string, string> | null;
  };

  const payloadStr = JSON.stringify(delivery.payload);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(webhook.headers || {}),
  };

  if (webhook.secret) {
    const signature = crypto
      .createHmac('sha256', webhook.secret)
      .update(payloadStr)
      .digest('hex');
    headers['X-Webhook-Signature'] = signature;
  }

  try {
    const response = await fetch(webhook.url, {
      method: 'POST',
      headers,
      body: payloadStr,
    });

    const responseBody = await response.text().catch(() => '');
    const responseStatus = response.status;

    if (response.ok) {
      await prisma.webhookDelivery.update({
        where: { id: deliveryId },
        data: {
          status: 'delivered',
          responseStatus,
          responseBody,
          attempts: delivery.attempts + 1,
          lastAttemptAt: new Date(),
        },
      });
    } else {
      await handleFailure(delivery, responseStatus, responseBody);
    }
  } catch (err) {
    const errorMessage = (err as Error).message;
    await handleFailure(delivery, null, errorMessage);
  }
}

async function handleFailure(
  delivery: { id: string; attempts: number; maxAttempts: number },
  responseStatus: number | null,
  responseBody: string | null,
): Promise<void> {
  const newAttempts = delivery.attempts + 1;
  const isMaxReached = newAttempts >= delivery.maxAttempts;

  const nextRetryAt = isMaxReached
    ? null
    : new Date(Date.now() + BASE_RETRY_DELAY_MS * Math.pow(2, newAttempts));

  await prisma.webhookDelivery.update({
    where: { id: delivery.id },
    data: {
      status: isMaxReached ? 'failed' : 'pending',
      responseStatus,
      responseBody,
      attempts: newAttempts,
      lastAttemptAt: new Date(),
      nextRetryAt,
    },
  });

  if (!isMaxReached && nextRetryAt) {
    const delayMs = nextRetryAt.getTime() - Date.now();
    await webhookQueue.add('deliver-webhook', { deliveryId: delivery.id }, { delay: delayMs });
  }
}

export async function createDelivery(
  webhookId: string,
  event: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const delivery = await prisma.webhookDelivery.create({
    data: {
      webhookId,
      event,
      payload: JSON.parse(JSON.stringify(payload)),
      status: 'pending',
      attempts: 0,
      maxAttempts: 5,
    },
  });

  await webhookQueue.add('deliver-webhook', { deliveryId: delivery.id });
}
