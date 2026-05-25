import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createMockPrisma } from '../test/mockDb.js';
import { buildTrackingDomain } from '../test/factories.js';

const mockPrisma = createMockPrisma();
vi.mock('../db.js', () => ({ prisma: mockPrisma }));

const {
  addDomain,
  verifyDomain,
  removeDomain,
  getActiveDomain,
  listDomains,
  getDomain,
} = await import('./tracking-domains.js');

describe('Tracking Domains Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('addDomain', () => {
    it('should create a tracking domain', async () => {
      const domain = buildTrackingDomain();
      mockPrisma.trackingDomain.findUnique.mockResolvedValue(null);
      mockPrisma.trackingDomain.create.mockResolvedValue(domain);

      const result = await addDomain('track.example.com', 'tracking.leadgenius.io');

      expect(mockPrisma.trackingDomain.create).toHaveBeenCalledWith({
        data: {
          domain: 'track.example.com',
          cnameTarget: 'tracking.leadgenius.io',
          isDefault: false,
        },
      });
      expect(result).toEqual(domain);
    });

    it('should throw conflict if domain already exists', async () => {
      const existing = buildTrackingDomain();
      mockPrisma.trackingDomain.findUnique.mockResolvedValue(existing);

      await expect(addDomain('track.example.com', 'tracking.leadgenius.io')).rejects.toThrow('already exists');
    });

    it('should unset other defaults when setting as default', async () => {
      const domain = buildTrackingDomain({ isDefault: true });
      mockPrisma.trackingDomain.findUnique.mockResolvedValue(null);
      mockPrisma.trackingDomain.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.trackingDomain.create.mockResolvedValue(domain);

      await addDomain('track.example.com', 'tracking.leadgenius.io', true);

      expect(mockPrisma.trackingDomain.updateMany).toHaveBeenCalledWith({
        where: { isDefault: true },
        data: { isDefault: false },
      });
    });
  });

  describe('verifyDomain', () => {
    it('should attempt DNS verification', async () => {
      const domain = buildTrackingDomain();
      mockPrisma.trackingDomain.findUnique.mockResolvedValue(domain);
      mockPrisma.trackingDomain.update.mockResolvedValue({ ...domain, status: 'failed' });

      const result = await verifyDomain(domain.id);

      // Default behavior returns unverified since we cannot do real DNS lookups
      expect(result.verified).toBe(false);
      expect(result.message).toContain('CNAME');
    });

    it('should throw not found if domain does not exist', async () => {
      mockPrisma.trackingDomain.findUnique.mockResolvedValue(null);

      await expect(verifyDomain('nonexistent')).rejects.toThrow('not found');
    });
  });

  describe('removeDomain', () => {
    it('should delete a tracking domain', async () => {
      const domain = buildTrackingDomain();
      mockPrisma.trackingDomain.findUnique.mockResolvedValue(domain);
      mockPrisma.trackingDomain.delete.mockResolvedValue(domain);

      const result = await removeDomain(domain.id);

      expect(result).toEqual(domain);
    });

    it('should throw not found if domain does not exist', async () => {
      mockPrisma.trackingDomain.findUnique.mockResolvedValue(null);

      await expect(removeDomain('nonexistent')).rejects.toThrow('not found');
    });
  });

  describe('getActiveDomain', () => {
    it('should return the default verified domain', async () => {
      const domain = buildTrackingDomain({ isDefault: true, cnameVerified: true });
      mockPrisma.trackingDomain.findFirst.mockResolvedValue(domain);

      const result = await getActiveDomain();

      expect(result).toEqual(domain);
      expect(mockPrisma.trackingDomain.findFirst).toHaveBeenCalledWith({
        where: { isDefault: true, cnameVerified: true },
      });
    });

    it('should return null if no default verified domain', async () => {
      mockPrisma.trackingDomain.findFirst.mockResolvedValue(null);

      const result = await getActiveDomain();

      expect(result).toBeNull();
    });
  });

  describe('listDomains', () => {
    it('should return all tracking domains', async () => {
      const domains = [buildTrackingDomain(), buildTrackingDomain()];
      mockPrisma.trackingDomain.findMany.mockResolvedValue(domains);

      const result = await listDomains();

      expect(result).toHaveLength(2);
    });
  });

  describe('getDomain', () => {
    it('should return a domain by id', async () => {
      const domain = buildTrackingDomain();
      mockPrisma.trackingDomain.findUnique.mockResolvedValue(domain);

      const result = await getDomain(domain.id);

      expect(result).toEqual(domain);
    });

    it('should throw not found if domain does not exist', async () => {
      mockPrisma.trackingDomain.findUnique.mockResolvedValue(null);

      await expect(getDomain('nonexistent')).rejects.toThrow('not found');
    });
  });
});
