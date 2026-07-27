import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createMockPrisma } from '../test/mockDb.js';

const mockPrisma = createMockPrisma();
vi.mock('../db.js', () => ({ prisma: mockPrisma }));

const mockEventQueue = { add: vi.fn().mockResolvedValue(undefined) };
vi.mock('../queue/index.js', () => ({
  eventQueue: mockEventQueue,
}));

const { publishEvent, subscribeToEvent, unsubscribeFromEvent } = await import('./event-bus.js');

describe('Event Bus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEventQueue.add.mockResolvedValue(undefined);
  });

  describe('publishEvent', () => {
    it('should create an event record in the database', async () => {
      const createdEvent = { id: 'evt-1', type: 'lead.created', entityType: 'lead', entityId: 'lead-1', payload: { name: 'Test' }, createdAt: new Date() };
      mockPrisma.event.create.mockResolvedValue(createdEvent);

      await publishEvent('lead.created', 'lead', 'lead-1', { name: 'Test' });

      expect(mockPrisma.event.create).toHaveBeenCalledWith({
        data: {
          type: 'lead.created',
          entityType: 'lead',
          entityId: 'lead-1',
          payload: { name: 'Test' },
        },
      });
    });

    it('should add a job to the event queue with correct data', async () => {
      const createdEvent = { id: 'evt-2', type: 'lead.updated', entityType: 'lead', entityId: 'lead-2', payload: { status: 'active' }, createdAt: new Date() };
      mockPrisma.event.create.mockResolvedValue(createdEvent);

      await publishEvent('lead.updated', 'lead', 'lead-2', { status: 'active' });

      expect(mockEventQueue.add).toHaveBeenCalledWith('process-event', {
        eventId: 'evt-2',
        type: 'lead.updated',
        entityType: 'lead',
        entityId: 'lead-2',
        payload: { status: 'active' },
      });
    });

    it('should emit event locally for in-process subscribers', async () => {
      const createdEvent = { id: 'evt-3', type: 'message.received', entityType: 'message', entityId: 'msg-1', payload: { channel: 'email' }, createdAt: new Date() };
      mockPrisma.event.create.mockResolvedValue(createdEvent);

      const handler = vi.fn();
      subscribeToEvent('message.received', handler);

      await publishEvent('message.received', 'message', 'msg-1', { channel: 'email' });

      expect(handler).toHaveBeenCalledWith({
        type: 'message.received',
        entityType: 'message',
        entityId: 'msg-1',
        payload: { channel: 'email' },
      });

      unsubscribeFromEvent('message.received', handler);
    });

    it('should not throw when database create fails', async () => {
      mockPrisma.event.create.mockRejectedValue(new Error('DB error'));

      await expect(publishEvent('lead.created', 'lead', 'lead-1', { name: 'Test' })).resolves.toBeUndefined();
    });

    it('should not throw when queue add fails', async () => {
      const createdEvent = { id: 'evt-4', type: 'lead.created', entityType: 'lead', entityId: 'lead-1', payload: {}, createdAt: new Date() };
      mockPrisma.event.create.mockResolvedValue(createdEvent);
      mockEventQueue.add.mockRejectedValue(new Error('Queue error'));

      await expect(publishEvent('lead.created', 'lead', 'lead-1', {})).resolves.toBeUndefined();
    });
  });

  describe('subscribeToEvent', () => {
    it('should register a handler that receives events of the specified type', async () => {
      const createdEvent = { id: 'evt-5', type: 'campaign.activated', entityType: 'campaign', entityId: 'camp-1', payload: { name: 'Test Campaign' }, createdAt: new Date() };
      mockPrisma.event.create.mockResolvedValue(createdEvent);

      const handler = vi.fn();
      subscribeToEvent('campaign.activated', handler);

      await publishEvent('campaign.activated', 'campaign', 'camp-1', { name: 'Test Campaign' });

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ type: 'campaign.activated' }));

      unsubscribeFromEvent('campaign.activated', handler);
    });

    it('should not trigger handler for different event types', async () => {
      const createdEvent = { id: 'evt-6', type: 'lead.created', entityType: 'lead', entityId: 'lead-1', payload: {}, createdAt: new Date() };
      mockPrisma.event.create.mockResolvedValue(createdEvent);

      const handler = vi.fn();
      subscribeToEvent('campaign.paused', handler);

      await publishEvent('lead.created', 'lead', 'lead-1', {});

      expect(handler).not.toHaveBeenCalled();

      unsubscribeFromEvent('campaign.paused', handler);
    });
  });
});
