import { prisma } from '../db.js';
import { config } from '../config.js';
import crypto from 'crypto';

const WEBHOOK_EVENTS = [
  'lead.created',
  'lead.updated',
  'lead.stage_changed',
  'lead.deleted',
  'campaign.started',
  'campaign.completed',
  'campaign.paused',
  'message.sent',
  'message.bounced',
  'message.replied',
] as const;

export type WebhookEvent = typeof WEBHOOK_EVENTS[number];

export async function dispatchWebhookEvent(event: WebhookEvent, payload: Record<string, unknown>) {
  try {
    const endpoints = await prisma.webhookEndpoint.findMany({
      where: { active: true, events: { has: event } },
    });

    for (const endpoint of endpoints) {
      const body = JSON.stringify({ event, ...payload, timestamp: new Date().toISOString() });
      const signature = endpoint.secret
        ? crypto.createHmac('sha256', endpoint.secret).update(body).digest('hex')
        : '';

      const delivery = await prisma.webhookDelivery.create({
        data: { endpointId: endpoint.id, event, payload: { event, ...payload } },
      });

      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);

        const response = await fetch(endpoint.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Webhook-Signature': signature,
            'X-Webhook-Event': event,
            'User-Agent': 'LeadGenius-Webhook/1.0',
          },
          body,
          signal: controller.signal,
        });

        clearTimeout(timeout);

        const responseBody = await response.text().catch(() => '');
        await prisma.webhookDelivery.update({
          where: { id: delivery.id },
          data: {
            status: response.ok ? 'delivered' : 'failed',
            responseCode: response.status,
            responseBody: responseBody.slice(0, 1000),
            deliveredAt: new Date(),
          },
        });
      } catch (err: any) {
        await prisma.webhookDelivery.update({
          where: { id: delivery.id },
          data: {
            status: 'failed',
            errorMessage: err.message?.slice(0, 500) || 'Request failed',
            deliveredAt: new Date(),
          },
        });
      }
    }
  } catch (err) {
    console.error('Webhook dispatch error:', err);
  }
}
