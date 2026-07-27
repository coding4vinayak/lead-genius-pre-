import { describe, it, expect } from 'vitest';
import { generatePreview } from './email-preview.js';

describe('Email Preview Service', () => {
  describe('generatePreview', () => {
    it('should generate HTML preview with email wrapper', () => {
      const result = generatePreview('<p>Hello World</p>', {}, 'desktop');

      expect(result.html).toContain('<!DOCTYPE html>');
      expect(result.html).toContain('<p>Hello World</p>');
      expect(result.html).toContain('email-wrapper');
      expect(result.html).toContain('email-container');
    });

    it('should extract plain text from HTML', () => {
      const result = generatePreview('<p>Hello <strong>World</strong></p><p>Second paragraph</p>', {});

      expect(result.plainText).toContain('Hello World');
      expect(result.plainText).toContain('Second paragraph');
      expect(result.plainText).not.toContain('<p>');
      expect(result.plainText).not.toContain('<strong>');
    });

    it('should calculate estimated size in bytes', () => {
      const result = generatePreview('<p>Hello</p>', {});

      expect(result.estimatedSize).toBeGreaterThan(0);
      expect(result.estimatedSize).toBe(Buffer.byteLength(result.html, 'utf-8'));
    });

    it('should use desktop styles by default', () => {
      const result = generatePreview('<p>Test</p>', {}, 'desktop');

      expect(result.html).toContain('max-width: 600px');
      expect(result.html).toContain('padding: 20px');
    });

    it('should use mobile styles for mobile device', () => {
      const result = generatePreview('<p>Test</p>', {}, 'mobile');

      expect(result.html).toContain('max-width: 100%');
      expect(result.html).toContain('padding: 10px');
      expect(result.html).toContain('font-size: 14px');
    });

    it('should replace Handlebars-style variables', () => {
      const result = generatePreview(
        '<p>Hello {{name}}, welcome to {{company}}!</p>',
        { name: 'Alice', company: 'Acme Inc' },
      );

      expect(result.plainText).toContain('Hello Alice');
      expect(result.plainText).toContain('welcome to Acme Inc');
      expect(result.html).toContain('Hello Alice');
    });

    it('should handle variables with spaces around braces', () => {
      const result = generatePreview(
        '<p>Hello {{ name }}!</p>',
        { name: 'Bob' },
      );

      expect(result.plainText).toContain('Hello Bob');
    });

    it('should include viewport meta tag', () => {
      const result = generatePreview('<p>Test</p>', {});

      expect(result.html).toContain('viewport');
      expect(result.html).toContain('width=device-width');
    });

    it('should handle HTML entities in plain text extraction', () => {
      const result = generatePreview('<p>A &amp; B &lt; C &gt; D</p>', {});

      expect(result.plainText).toContain('A & B < C > D');
    });
  });
});
