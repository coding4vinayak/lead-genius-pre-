import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createMockPrisma } from '../test/mockDb.js';
import { buildIntegration, buildCrmSync, buildLead } from '../test/factories.js';

const mockPrisma = createMockPrisma();
vi.mock('../db.js', () => ({ prisma: mockPrisma }));

const {
  getOAuthUrl,
  handleOAuthCallback,
  connectCrm,
  syncContacts,
  pushLeadStage,
  pullNewContacts,
  mapFields,
  getSyncStatus,
  getFieldMapping,
  updateFieldMapping,
} = await import('./crm-sync.js');

describe('CRM Sync Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getOAuthUrl', () => {
    it('should return HubSpot OAuth URL', () => {
      const url = getOAuthUrl('hubspot');
      expect(url).toContain('https://app.hubspot.com/oauth/authorize');
      expect(url).toContain('client_id=');
      expect(url).toContain('response_type=code');
    });

    it('should return Salesforce OAuth URL', () => {
      const url = getOAuthUrl('salesforce');
      expect(url).toContain('https://login.salesforce.com/services/oauth2/authorize');
    });

    it('should throw for unsupported provider', () => {
      expect(() => getOAuthUrl('unknown')).toThrow('Unsupported CRM provider');
    });
  });

  describe('handleOAuthCallback', () => {
    it('should create integration with credentials', async () => {
      const integration = buildIntegration({ type: 'hubspot' });
      mockPrisma.integration.create.mockResolvedValue(integration);

      const result = await handleOAuthCallback('hubspot', 'test_code');

      expect(mockPrisma.integration.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: 'hubspot',
          name: 'Hubspot CRM',
          isActive: true,
        }),
      });
      expect(result).toEqual(integration);
    });

    it('should throw for unsupported provider', async () => {
      await expect(handleOAuthCallback('unknown', 'code')).rejects.toThrow('Unsupported CRM provider');
    });
  });

  describe('connectCrm', () => {
    it('should connect CRM and create sync record', async () => {
      const integration = buildIntegration({ type: 'hubspot', config: { provider: 'hubspot' } });
      const crmSync = buildCrmSync({ integrationId: integration.id });

      mockPrisma.integration.findUnique.mockResolvedValue(integration);
      mockPrisma.integration.update.mockResolvedValue({ ...integration, isActive: true });
      mockPrisma.crmSync.create.mockResolvedValue(crmSync);

      const result = await connectCrm(integration.id, 'auth_code');

      expect(result.integration).toBeDefined();
      expect(result.crmSync).toBeDefined();
      expect(mockPrisma.crmSync.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          integrationId: integration.id,
          provider: 'hubspot',
          direction: 'bidirectional',
          syncStatus: 'idle',
        }),
      });
    });

    it('should throw not found if integration does not exist', async () => {
      mockPrisma.integration.findUnique.mockResolvedValue(null);

      await expect(connectCrm('nonexistent', 'code')).rejects.toThrow('not found');
    });
  });

  describe('syncContacts', () => {
    it('should sync contacts and update status', async () => {
      const integration = buildIntegration({ type: 'hubspot' });
      const crmSync = buildCrmSync({ integrationId: integration.id });

      mockPrisma.integration.findUnique.mockResolvedValue(integration);
      mockPrisma.crmSync.findFirst.mockResolvedValue(crmSync);
      mockPrisma.crmSync.update.mockResolvedValue({ ...crmSync, syncStatus: 'completed' });

      const result = await syncContacts(integration.id, 'outbound');

      expect(result.status).toBe('completed');
      expect(result.direction).toBe('outbound');
    });

    it('should throw not found if integration does not exist', async () => {
      mockPrisma.integration.findUnique.mockResolvedValue(null);

      await expect(syncContacts('nonexistent', 'outbound')).rejects.toThrow('not found');
    });

    it('should throw not found if crm sync not configured', async () => {
      const integration = buildIntegration();
      mockPrisma.integration.findUnique.mockResolvedValue(integration);
      mockPrisma.crmSync.findFirst.mockResolvedValue(null);

      await expect(syncContacts(integration.id, 'outbound')).rejects.toThrow('not found');
    });
  });

  describe('pushLeadStage', () => {
    it('should push lead stage to CRM', async () => {
      const lead = buildLead();
      const crmSync = buildCrmSync();

      mockPrisma.lead.findUnique.mockResolvedValue(lead);
      mockPrisma.crmSync.findMany.mockResolvedValue([crmSync]);

      const result = await pushLeadStage(lead.id, 'warm');

      expect(result.leadId).toBe(lead.id);
      expect(result.stage).toBe('warm');
      expect(result.pushed).toBe(true);
    });

    it('should throw not found if lead does not exist', async () => {
      mockPrisma.lead.findUnique.mockResolvedValue(null);

      await expect(pushLeadStage('nonexistent', 'warm')).rejects.toThrow('not found');
    });

    it('should throw validation if no CRM sync configured', async () => {
      const lead = buildLead();
      mockPrisma.lead.findUnique.mockResolvedValue(lead);
      mockPrisma.crmSync.findMany.mockResolvedValue([]);

      await expect(pushLeadStage(lead.id, 'warm')).rejects.toThrow('No active CRM sync');
    });
  });

  describe('pullNewContacts', () => {
    it('should pull contacts from CRM', async () => {
      const integration = buildIntegration();
      const crmSync = buildCrmSync({ integrationId: integration.id });

      mockPrisma.integration.findUnique.mockResolvedValue(integration);
      mockPrisma.crmSync.findFirst.mockResolvedValue(crmSync);
      mockPrisma.crmSync.update.mockResolvedValue(crmSync);

      const result = await pullNewContacts(integration.id);

      expect(result.integrationId).toBe(integration.id);
      expect(result.contactsPulled).toBe(0);
    });

    it('should throw not found if integration does not exist', async () => {
      mockPrisma.integration.findUnique.mockResolvedValue(null);

      await expect(pullNewContacts('nonexistent')).rejects.toThrow('not found');
    });
  });

  describe('mapFields', () => {
    it('should map lead fields to CRM fields', () => {
      const lead = { name: 'John', email: 'john@test.com', company: 'Acme' };
      const mapping = { firstname: 'name', email_address: 'email', company_name: 'company' };

      const result = mapFields(lead, mapping);

      expect(result).toEqual({
        firstname: 'John',
        email_address: 'john@test.com',
        company_name: 'Acme',
      });
    });

    it('should return undefined for missing fields', () => {
      const lead = { name: 'John' };
      const mapping = { firstname: 'name', email_address: 'email' };

      const result = mapFields(lead, mapping);

      expect(result.firstname).toBe('John');
      expect(result.email_address).toBeUndefined();
    });
  });

  describe('getSyncStatus', () => {
    it('should return sync status', async () => {
      const crmSync = buildCrmSync({ syncStatus: 'completed' });
      mockPrisma.crmSync.findFirst.mockResolvedValue(crmSync);

      const result = await getSyncStatus('int_1');

      expect(result.syncStatus).toBe('completed');
    });

    it('should throw not found if sync not found', async () => {
      mockPrisma.crmSync.findFirst.mockResolvedValue(null);

      await expect(getSyncStatus('nonexistent')).rejects.toThrow('not found');
    });
  });

  describe('getFieldMapping', () => {
    it('should return field mapping', async () => {
      const mapping = { firstname: 'name', email_address: 'email' };
      const crmSync = buildCrmSync({ fieldMapping: mapping });
      mockPrisma.crmSync.findFirst.mockResolvedValue(crmSync);

      const result = await getFieldMapping('int_1');

      expect(result).toEqual(mapping);
    });
  });

  describe('updateFieldMapping', () => {
    it('should update field mapping', async () => {
      const crmSync = buildCrmSync();
      const newMapping = { firstname: 'name', email_address: 'email' };
      mockPrisma.crmSync.findFirst.mockResolvedValue(crmSync);
      mockPrisma.crmSync.update.mockResolvedValue({ ...crmSync, fieldMapping: newMapping });

      const result = await updateFieldMapping('int_1', newMapping);

      expect(result.fieldMapping).toEqual(newMapping);
      expect(mockPrisma.crmSync.update).toHaveBeenCalledWith({
        where: { id: crmSync.id },
        data: { fieldMapping: newMapping },
      });
    });
  });
});
