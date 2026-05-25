import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createMockPrisma } from '../test/mockDb.js';
import { buildIntegration, buildSlackNotification } from '../test/factories.js';

const mockPrisma = createMockPrisma();
vi.mock('../db.js', () => ({ prisma: mockPrisma }));

const {
  connectSlack,
  sendNotification,
  configureNotifications,
  sendDailyDigest,
  listChannels,
  testNotification,
} = await import('./slack-notifications.js');

describe('Slack Notifications Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('connectSlack', () => {
    it('should create a Slack integration', async () => {
      const integration = buildIntegration({ type: 'slack' });
      mockPrisma.integration.create.mockResolvedValue(integration);

      const result = await connectSlack('oauth_code_123');

      expect(mockPrisma.integration.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: 'slack',
          name: 'Slack Integration',
          isActive: true,
        }),
      });
      expect(result).toEqual(integration);
    });
  });

  describe('sendNotification', () => {
    it('should send notification to matching channels', async () => {
      const integration = buildIntegration({ type: 'slack' });
      const notification = buildSlackNotification({
        integrationId: integration.id,
        eventTypes: ['lead.created', 'lead.converted'],
      });

      mockPrisma.integration.findUnique.mockResolvedValue(integration);
      mockPrisma.slackNotification.findMany.mockResolvedValue([notification]);

      const result = await sendNotification(integration.id, 'lead.created', { leadId: 'lead_1' });

      expect(result.sent).toBe(true);
      expect(result.notifications).toHaveLength(1);
    });

    it('should not send if no matching event types', async () => {
      const integration = buildIntegration({ type: 'slack' });
      const notification = buildSlackNotification({
        integrationId: integration.id,
        eventTypes: ['campaign.completed'],
      });

      mockPrisma.integration.findUnique.mockResolvedValue(integration);
      mockPrisma.slackNotification.findMany.mockResolvedValue([notification]);

      const result = await sendNotification(integration.id, 'lead.created', {});

      expect(result.sent).toBe(false);
    });

    it('should throw not found if integration does not exist', async () => {
      mockPrisma.integration.findUnique.mockResolvedValue(null);

      await expect(sendNotification('nonexistent', 'lead.created', {})).rejects.toThrow('not found');
    });

    it('should throw validation if not a Slack integration', async () => {
      const integration = buildIntegration({ type: 'hubspot' });
      mockPrisma.integration.findUnique.mockResolvedValue(integration);

      await expect(sendNotification(integration.id, 'lead.created', {})).rejects.toThrow('not a Slack');
    });
  });

  describe('configureNotifications', () => {
    it('should create new notification config', async () => {
      const integration = buildIntegration({ type: 'slack' });
      const notification = buildSlackNotification({ integrationId: integration.id });

      mockPrisma.integration.findUnique.mockResolvedValue(integration);
      mockPrisma.slackNotification.findFirst.mockResolvedValue(null);
      mockPrisma.slackNotification.create.mockResolvedValue(notification);

      const result = await configureNotifications(integration.id, {
        channel: '#sales',
        eventTypes: ['lead.created'],
      });

      expect(result).toEqual(notification);
      expect(mockPrisma.slackNotification.create).toHaveBeenCalled();
    });

    it('should update existing notification config', async () => {
      const integration = buildIntegration({ type: 'slack' });
      const notification = buildSlackNotification({ integrationId: integration.id, channel: '#sales' });

      mockPrisma.integration.findUnique.mockResolvedValue(integration);
      mockPrisma.slackNotification.findFirst.mockResolvedValue(notification);
      mockPrisma.slackNotification.update.mockResolvedValue({
        ...notification,
        eventTypes: ['lead.created', 'lead.converted'],
      });

      const result = await configureNotifications(integration.id, {
        channel: '#sales',
        eventTypes: ['lead.created', 'lead.converted'],
      });

      expect(mockPrisma.slackNotification.update).toHaveBeenCalled();
      expect(result.eventTypes).toContain('lead.converted');
    });

    it('should throw not found if integration does not exist', async () => {
      mockPrisma.integration.findUnique.mockResolvedValue(null);

      await expect(configureNotifications('nonexistent', {
        channel: '#sales',
        eventTypes: ['lead.created'],
      })).rejects.toThrow('not found');
    });
  });

  describe('sendDailyDigest', () => {
    it('should send daily digest to configured channels', async () => {
      const integration = buildIntegration({ type: 'slack' });
      const notification = buildSlackNotification({
        integrationId: integration.id,
        eventTypes: ['daily_digest'],
      });

      mockPrisma.integration.findUnique.mockResolvedValue(integration);
      mockPrisma.slackNotification.findMany.mockResolvedValue([notification]);

      const result = await sendDailyDigest(integration.id);

      expect(result.sent).toBe(true);
      expect(result.channels).toHaveLength(1);
    });

    it('should return not sent if no digest configured', async () => {
      const integration = buildIntegration({ type: 'slack' });
      const notification = buildSlackNotification({
        integrationId: integration.id,
        eventTypes: ['lead.created'],
      });

      mockPrisma.integration.findUnique.mockResolvedValue(integration);
      mockPrisma.slackNotification.findMany.mockResolvedValue([notification]);

      const result = await sendDailyDigest(integration.id);

      expect(result.sent).toBe(false);
    });

    it('should throw not found if integration does not exist', async () => {
      mockPrisma.integration.findUnique.mockResolvedValue(null);

      await expect(sendDailyDigest('nonexistent')).rejects.toThrow('not found');
    });
  });

  describe('listChannels', () => {
    it('should return available channels', async () => {
      const integration = buildIntegration({ type: 'slack' });
      mockPrisma.integration.findUnique.mockResolvedValue(integration);

      const result = await listChannels(integration.id);

      expect(result).toBeInstanceOf(Array);
      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toHaveProperty('id');
      expect(result[0]).toHaveProperty('name');
    });

    it('should throw not found if integration does not exist', async () => {
      mockPrisma.integration.findUnique.mockResolvedValue(null);

      await expect(listChannels('nonexistent')).rejects.toThrow('not found');
    });

    it('should throw validation if not a Slack integration', async () => {
      const integration = buildIntegration({ type: 'hubspot' });
      mockPrisma.integration.findUnique.mockResolvedValue(integration);

      await expect(listChannels(integration.id)).rejects.toThrow('not a Slack');
    });
  });

  describe('testNotification', () => {
    it('should send a test notification', async () => {
      const integration = buildIntegration({ type: 'slack' });
      mockPrisma.integration.findUnique.mockResolvedValue(integration);

      const result = await testNotification(integration.id);

      expect(result.success).toBe(true);
    });

    it('should throw not found if integration does not exist', async () => {
      mockPrisma.integration.findUnique.mockResolvedValue(null);

      await expect(testNotification('nonexistent')).rejects.toThrow('not found');
    });
  });
});
