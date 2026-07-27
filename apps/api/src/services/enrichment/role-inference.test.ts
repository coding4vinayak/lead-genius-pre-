import { describe, it, expect } from 'vitest';
import { inferRole } from './role-inference.js';

describe('Role Inference', () => {
  describe('seniority detection', () => {
    it('should detect C-suite titles', () => {
      expect(inferRole('CEO').seniority).toBe('c_suite');
      expect(inferRole('CTO').seniority).toBe('c_suite');
      expect(inferRole('Chief Marketing Officer').seniority).toBe('c_suite');
    });

    it('should detect VP titles', () => {
      expect(inferRole('VP of Engineering').seniority).toBe('vp');
      expect(inferRole('Vice President, Sales').seniority).toBe('vp');
    });

    it('should detect director titles', () => {
      expect(inferRole('Director of Marketing').seniority).toBe('director');
      expect(inferRole('Engineering Director').seniority).toBe('director');
    });

    it('should detect manager titles', () => {
      expect(inferRole('Engineering Manager').seniority).toBe('manager');
      expect(inferRole('Head of Design').seniority).toBe('manager');
    });

    it('should detect senior titles', () => {
      expect(inferRole('Senior Software Engineer').seniority).toBe('senior');
      expect(inferRole('Sr. Developer').seniority).toBe('senior');
      expect(inferRole('Lead Engineer').seniority).toBe('senior');
    });

    it('should detect junior titles', () => {
      expect(inferRole('Junior Developer').seniority).toBe('junior');
      expect(inferRole('Associate Product Manager').seniority).toBe('junior');
      expect(inferRole('Intern').seniority).toBe('junior');
    });

    it('should default to mid for unrecognized titles', () => {
      expect(inferRole('Software Engineer').seniority).toBe('mid');
      expect(inferRole('Account Executive').seniority).toBe('mid');
    });

    it('should default to mid for null/undefined titles', () => {
      expect(inferRole(null).seniority).toBe('mid');
      expect(inferRole(undefined).seniority).toBe('mid');
    });
  });

  describe('department detection', () => {
    it('should detect engineering department', () => {
      expect(inferRole('Software Engineer').department).toBe('engineering');
      expect(inferRole('DevOps Engineer').department).toBe('engineering');
      expect(inferRole('Backend Developer').department).toBe('engineering');
    });

    it('should detect marketing department', () => {
      expect(inferRole('Marketing Manager').department).toBe('marketing');
      expect(inferRole('Growth Lead').department).toBe('marketing');
      expect(inferRole('Content Strategist').department).toBe('marketing');
    });

    it('should detect sales department', () => {
      expect(inferRole('Account Executive').department).toBe('sales');
      expect(inferRole('Sales Director').department).toBe('sales');
      expect(inferRole('BDR').department).toBe('sales');
    });

    it('should detect hr department', () => {
      expect(inferRole('HR Manager').department).toBe('hr');
      expect(inferRole('Recruiter').department).toBe('hr');
      expect(inferRole('Talent Acquisition').department).toBe('hr');
    });

    it('should detect finance department', () => {
      expect(inferRole('Finance Director').department).toBe('finance');
      expect(inferRole('Controller').department).toBe('finance');
    });

    it('should detect product department', () => {
      expect(inferRole('Product Manager').department).toBe('product');
    });

    it('should detect design department', () => {
      expect(inferRole('UX Designer').department).toBe('design');
      expect(inferRole('Creative Director').department).toBe('design');
    });

    it('should default to other for unrecognized departments', () => {
      expect(inferRole('CEO').department).toBe('other');
    });
  });

  describe('decision maker detection', () => {
    it('should flag c_suite as decision makers', () => {
      expect(inferRole('CEO').decisionMaker).toBe(true);
    });

    it('should flag vp as decision makers', () => {
      expect(inferRole('VP of Engineering').decisionMaker).toBe(true);
    });

    it('should flag directors as decision makers', () => {
      expect(inferRole('Director of Sales').decisionMaker).toBe(true);
    });

    it('should not flag managers as decision makers', () => {
      expect(inferRole('Engineering Manager').decisionMaker).toBe(false);
    });

    it('should not flag individual contributors as decision makers', () => {
      expect(inferRole('Software Engineer').decisionMaker).toBe(false);
    });
  });
});
