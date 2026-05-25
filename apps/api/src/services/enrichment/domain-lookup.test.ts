import { describe, it, expect } from 'vitest';
import { extractDomain, inferCompanyFromDomain, isPersonalEmail, domainLookup } from './domain-lookup.js';

describe('Domain Lookup', () => {
  describe('extractDomain', () => {
    it('should extract domain from email', () => {
      expect(extractDomain('john@acme.com')).toBe('acme.com');
    });

    it('should handle uppercase emails', () => {
      expect(extractDomain('John@ACME.COM')).toBe('acme.com');
    });

    it('should return null for invalid email', () => {
      expect(extractDomain('invalid-email')).toBeNull();
    });
  });

  describe('inferCompanyFromDomain', () => {
    it('should capitalize domain name', () => {
      expect(inferCompanyFromDomain('acme.com')).toBe('Acme');
    });

    it('should return known company name for known domains', () => {
      expect(inferCompanyFromDomain('google.com')).toBe('Google');
      expect(inferCompanyFromDomain('microsoft.com')).toBe('Microsoft');
    });

    it('should handle multi-part domain names', () => {
      expect(inferCompanyFromDomain('my-startup.io')).toBe('My-startup');
    });
  });

  describe('isPersonalEmail', () => {
    it('should detect personal email domains', () => {
      expect(isPersonalEmail('gmail.com')).toBe(true);
      expect(isPersonalEmail('yahoo.com')).toBe(true);
      expect(isPersonalEmail('hotmail.com')).toBe(true);
    });

    it('should return false for business domains', () => {
      expect(isPersonalEmail('acme.com')).toBe(false);
      expect(isPersonalEmail('company.io')).toBe(false);
    });
  });

  describe('domainLookup', () => {
    it('should return full lookup result for business email', () => {
      const result = domainLookup('john@acme.com');
      expect(result).toEqual({
        company: 'Acme',
        domain: 'acme.com',
        isPersonalEmail: false,
        industry: undefined,
      });
    });

    it('should flag personal emails', () => {
      const result = domainLookup('john@gmail.com');
      expect(result).toEqual({
        company: '',
        domain: 'gmail.com',
        isPersonalEmail: true,
        industry: undefined,
      });
    });

    it('should include industry for known domains', () => {
      const result = domainLookup('employee@google.com');
      expect(result).toEqual({
        company: 'Google',
        domain: 'google.com',
        isPersonalEmail: false,
        industry: 'technology',
      });
    });

    it('should return null for invalid email', () => {
      expect(domainLookup('not-an-email')).toBeNull();
    });
  });
});
