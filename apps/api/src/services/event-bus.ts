import { EventEmitter } from 'events';
import { prisma } from '../db.js';
import { eventQueue } from '../queue/index.js';
import { logger } from '../lib/logger.js';

const emitter = new EventEmitter();

export interface EventPayload {
  type: string;
  entityType: string;
  entityId: string;
  payload: Record<string, unknown>;
}

/**
 * Publish an event: stores in DB, enqueues to event-queue, and emits locally.
 * Fire-and-forget - errors are logged but do not propagate.
 */
export async function publishEvent(
  type: string,
  entityType: string,
  entityId: string,
  payload: Record<string, unknown>,
): Promise<void> {
  try {
    const event = await prisma.event.create({
      data: { type, entityType, entityId, payload: JSON.parse(JSON.stringify(payload)) },
    });

    await eventQueue.add('process-event', {
      eventId: event.id,
      type,
      entityType,
      entityId,
      payload,
    });

    emitter.emit(type, { type, entityType, entityId, payload });
  } catch (err) {
    logger.error('Failed to publish event', { type, entityType, entityId, error: (err as Error).message });
  }
}

/**
 * Subscribe to in-process event emissions.
 */
export function subscribeToEvent(eventType: string, handler: (data: EventPayload) => void): void {
  emitter.on(eventType, handler);
}

/**
 * Unsubscribe from in-process event emissions.
 */
export function unsubscribeFromEvent(eventType: string, handler: (data: EventPayload) => void): void {
  emitter.off(eventType, handler);
}
