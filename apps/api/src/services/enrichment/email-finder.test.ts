import { describe, it, expect } from 'vitest';
import { findEmail } from './email-finder.js';

describe('Email Finder', () => {
  it('should generate email patterns for given name and domain', () => {
    const results = findEmail('John', 'Doe', 'acme.com');

    expect(results.length).toBe(8);
    expect(results[0].email).toBe('john.doe@acme.com');
    expect(results[0].pattern).toBe('first.last');
    expect(results[0].confidence).toBe(0.95);
    expect(results[0].verification).toBe('unverified');
  });

  it('should generate all expected patterns', () => {
    const results = findEmail('Jane', 'Smith', 'company.io');
    const emails = results.map((r) => r.email);

    expect(emails).toContain('jane.smith@company.io');
    expect(emails).toContain('jane@company.io');
    expect(emails).toContain('janesmith@company.io');
    expect(emails).toContain('j.smith@company.io');
    expect(emails).toContain('jsmith@company.io');
    expect(emails).toContain('jane.s@company.io');
    expect(emails).toContain('jane_smith@company.io');
    expect(emails).toContain('smith@company.io');
  });

  it('should sort by confidence (highest first)', () => {
    const results = findEmail('John', 'Doe', 'acme.com');
    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1].confidence).toBeGreaterThanOrEqual(results[i].confidence);
    }
  });

  it('should normalize to lowercase', () => {
    const results = findEmail('JOHN', 'DOE', 'ACME.COM');
    expect(results[0].email).toBe('john.doe@acme.com');
  });

  it('should return empty array for empty inputs', () => {
    expect(findEmail('', 'Doe', 'acme.com')).toEqual([]);
    expect(findEmail('John', '', 'acme.com')).toEqual([]);
    expect(findEmail('John', 'Doe', '')).toEqual([]);
  });

  it('should handle whitespace in inputs', () => {
    const results = findEmail(' John ', ' Doe ', ' acme.com ');
    expect(results[0].email).toBe('john.doe@acme.com');
  });
});
