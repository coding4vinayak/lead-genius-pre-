import { describe, it, expect } from 'vitest';
import { extractLinks, validateLinks } from './link-validator.js';

describe('Link Validator Service', () => {
  describe('extractLinks', () => {
    it('should extract href URLs from HTML', () => {
      const html = '<a href="https://example.com">Link</a><a href="https://other.com/path">Other</a>';
      const links = extractLinks(html);

      expect(links).toHaveLength(2);
      expect(links).toContain('https://example.com');
      expect(links).toContain('https://other.com/path');
    });

    it('should ignore mailto links', () => {
      const html = '<a href="mailto:test@example.com">Email</a><a href="https://example.com">Site</a>';
      const links = extractLinks(html);

      expect(links).toHaveLength(1);
      expect(links[0]).toBe('https://example.com');
    });

    it('should ignore hash-only links', () => {
      const html = '<a href="#section">Section</a><a href="https://example.com">Site</a>';
      const links = extractLinks(html);

      expect(links).toHaveLength(1);
      expect(links[0]).toBe('https://example.com');
    });

    it('should ignore tel links', () => {
      const html = '<a href="tel:+1234567890">Call</a><a href="https://example.com">Site</a>';
      const links = extractLinks(html);

      expect(links).toHaveLength(1);
    });

    it('should handle single-quoted href attributes', () => {
      const html = "<a href='https://example.com'>Link</a>";
      const links = extractLinks(html);

      expect(links).toHaveLength(1);
      expect(links[0]).toBe('https://example.com');
    });

    it('should return empty array for HTML without links', () => {
      const html = '<p>No links here</p>';
      const links = extractLinks(html);

      expect(links).toHaveLength(0);
    });
  });

  describe('validateLinks', () => {
    it('should mark valid URLs as valid', () => {
      const results = validateLinks(['https://example.com', 'http://test.org/path']);

      expect(results).toHaveLength(2);
      expect(results[0]).toEqual({ url: 'https://example.com', status: 'valid' });
      expect(results[1]).toEqual({ url: 'http://test.org/path', status: 'valid' });
    });

    it('should reject URLs without valid protocol', () => {
      const results = validateLinks(['ftp://example.com', 'example.com', '//example.com']);

      expect(results.every((r) => r.status === 'invalid')).toBe(true);
      expect(results[0].reason).toContain('protocol');
    });

    it('should reject URLs with invalid domain structure', () => {
      const results = validateLinks(['https://localhost']);

      expect(results[0].status).toBe('invalid');
      expect(results[0].reason).toContain('TLD');
    });

    it('should reject domains starting with hyphen', () => {
      const results = validateLinks(['https://-example.com']);

      expect(results[0].status).toBe('invalid');
    });

    it('should validate URLs with paths and query parameters', () => {
      const results = validateLinks(['https://example.com/path?key=value&other=123']);

      expect(results[0].status).toBe('valid');
    });

    it('should validate URLs with subdomains', () => {
      const results = validateLinks(['https://sub.domain.example.com']);

      expect(results[0].status).toBe('valid');
    });

    it('should handle empty array', () => {
      const results = validateLinks([]);

      expect(results).toHaveLength(0);
    });
  });
});
