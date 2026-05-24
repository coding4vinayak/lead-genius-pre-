import { describe, it, expect, vi } from 'vitest';
import { checkDeliverability, checkLandingPage } from './deliverability-checker.js';

describe('deliverability-checker', () => {
  describe('checkDeliverability', () => {
    it('should return a report with default scoring for unknown domain', async () => {
      const report = await checkDeliverability('nonexistent-domain-xyz-123.com');
      expect(report.domain).toBe('nonexistent-domain-xyz-123.com');
      expect(typeof report.score).toBe('number');
      expect(report.score).toBeGreaterThanOrEqual(0);
      expect(report.score).toBeLessThanOrEqual(100);
      expect(report.summary).toBeTruthy();
      expect(report.spf).toBeDefined();
      expect(report.dkim).toBeDefined();
      expect(report.dmarc).toBeDefined();
      expect(Array.isArray(report.mxRecords)).toBe(true);
      expect(Array.isArray(report.blacklistChecks)).toBe(true);
    });

    it('should report issues for domains without email setup', async () => {
      const report = await checkDeliverability('invalid.testing.leadgenius.local');
      expect(report.hasMx).toBe(false);
      expect(report.spf.present).toBe(false);
    });
  });

  describe('checkLandingPage', () => {
    it('should reject invalid URLs', async () => {
      const result = await checkLandingPage('not-a-url');
      expect(result.reachable).toBe(false);
      expect(result.issues).toContain('Invalid URL');
    });

    it('should check a known reachable domain', async () => {
      const result = await checkLandingPage('https://example.com');
      expect(result.dnsResolves).toBe(true);
      expect(result.ip).toBeDefined();
      expect(typeof result.responseTime).toBe('number');
    });
  });
});
