import { describe, it, expect } from 'vitest';
import { evaluateCondition } from './condition-evaluator.js';

describe('Condition Evaluator', () => {
  describe('equals operator', () => {
    it('should return true when values are equal', () => {
      expect(evaluateCondition({ field: 'lead.status', operator: 'equals', value: 'active' }, { lead: { status: 'active' } })).toBe(true);
    });

    it('should return false when values are not equal', () => {
      expect(evaluateCondition({ field: 'lead.status', operator: 'equals', value: 'active' }, { lead: { status: 'inactive' } })).toBe(false);
    });

    it('should handle numeric equality', () => {
      expect(evaluateCondition({ field: 'lead.score', operator: 'equals', value: 100 }, { lead: { score: 100 } })).toBe(true);
    });

    it('should handle null equality', () => {
      expect(evaluateCondition({ field: 'lead.score', operator: 'equals', value: null }, { lead: { score: null } })).toBe(true);
    });
  });

  describe('not_equals operator', () => {
    it('should return true when values are not equal', () => {
      expect(evaluateCondition({ field: 'lead.status', operator: 'not_equals', value: 'active' }, { lead: { status: 'inactive' } })).toBe(true);
    });

    it('should return false when values are equal', () => {
      expect(evaluateCondition({ field: 'lead.status', operator: 'not_equals', value: 'active' }, { lead: { status: 'active' } })).toBe(false);
    });
  });

  describe('contains operator', () => {
    it('should return true when string contains substring', () => {
      expect(evaluateCondition({ field: 'lead.name', operator: 'contains', value: 'John' }, { lead: { name: 'John Doe' } })).toBe(true);
    });

    it('should return false when string does not contain substring', () => {
      expect(evaluateCondition({ field: 'lead.name', operator: 'contains', value: 'Jane' }, { lead: { name: 'John Doe' } })).toBe(false);
    });

    it('should return true when array contains value', () => {
      expect(evaluateCondition({ field: 'lead.tags', operator: 'contains', value: 'vip' }, { lead: { tags: ['vip', 'customer'] } })).toBe(true);
    });

    it('should return false when array does not contain value', () => {
      expect(evaluateCondition({ field: 'lead.tags', operator: 'contains', value: 'vip' }, { lead: { tags: ['customer'] } })).toBe(false);
    });

    it('should return false for non-string non-array fields', () => {
      expect(evaluateCondition({ field: 'lead.score', operator: 'contains', value: 5 }, { lead: { score: 50 } })).toBe(false);
    });
  });

  describe('not_contains operator', () => {
    it('should return true when string does not contain substring', () => {
      expect(evaluateCondition({ field: 'lead.name', operator: 'not_contains', value: 'Jane' }, { lead: { name: 'John Doe' } })).toBe(true);
    });

    it('should return false when string contains substring', () => {
      expect(evaluateCondition({ field: 'lead.name', operator: 'not_contains', value: 'John' }, { lead: { name: 'John Doe' } })).toBe(false);
    });

    it('should return true when array does not contain value', () => {
      expect(evaluateCondition({ field: 'lead.tags', operator: 'not_contains', value: 'vip' }, { lead: { tags: ['customer'] } })).toBe(true);
    });

    it('should return false when array contains value', () => {
      expect(evaluateCondition({ field: 'lead.tags', operator: 'not_contains', value: 'vip' }, { lead: { tags: ['vip', 'customer'] } })).toBe(false);
    });
  });

  describe('greater_than operator', () => {
    it('should return true when field value is greater', () => {
      expect(evaluateCondition({ field: 'lead.score', operator: 'greater_than', value: 50 }, { lead: { score: 75 } })).toBe(true);
    });

    it('should return false when field value is equal', () => {
      expect(evaluateCondition({ field: 'lead.score', operator: 'greater_than', value: 50 }, { lead: { score: 50 } })).toBe(false);
    });

    it('should return false when field value is less', () => {
      expect(evaluateCondition({ field: 'lead.score', operator: 'greater_than', value: 50 }, { lead: { score: 25 } })).toBe(false);
    });

    it('should return false for non-numeric values', () => {
      expect(evaluateCondition({ field: 'lead.name', operator: 'greater_than', value: 50 }, { lead: { name: 'John' } })).toBe(false);
    });
  });

  describe('less_than operator', () => {
    it('should return true when field value is less', () => {
      expect(evaluateCondition({ field: 'lead.score', operator: 'less_than', value: 50 }, { lead: { score: 25 } })).toBe(true);
    });

    it('should return false when field value is equal', () => {
      expect(evaluateCondition({ field: 'lead.score', operator: 'less_than', value: 50 }, { lead: { score: 50 } })).toBe(false);
    });

    it('should return false when field value is greater', () => {
      expect(evaluateCondition({ field: 'lead.score', operator: 'less_than', value: 50 }, { lead: { score: 75 } })).toBe(false);
    });

    it('should return false for non-numeric values', () => {
      expect(evaluateCondition({ field: 'lead.name', operator: 'less_than', value: 50 }, { lead: { name: 'John' } })).toBe(false);
    });
  });

  describe('is_empty operator', () => {
    it('should return true for null', () => {
      expect(evaluateCondition({ field: 'lead.score', operator: 'is_empty' }, { lead: { score: null } })).toBe(true);
    });

    it('should return true for undefined', () => {
      expect(evaluateCondition({ field: 'lead.missing', operator: 'is_empty' }, { lead: {} })).toBe(true);
    });

    it('should return true for empty string', () => {
      expect(evaluateCondition({ field: 'lead.name', operator: 'is_empty' }, { lead: { name: '' } })).toBe(true);
    });

    it('should return true for empty array', () => {
      expect(evaluateCondition({ field: 'lead.tags', operator: 'is_empty' }, { lead: { tags: [] } })).toBe(true);
    });

    it('should return false for non-empty value', () => {
      expect(evaluateCondition({ field: 'lead.name', operator: 'is_empty' }, { lead: { name: 'John' } })).toBe(false);
    });

    it('should return false for non-empty array', () => {
      expect(evaluateCondition({ field: 'lead.tags', operator: 'is_empty' }, { lead: { tags: ['vip'] } })).toBe(false);
    });
  });

  describe('is_not_empty operator', () => {
    it('should return false for null', () => {
      expect(evaluateCondition({ field: 'lead.score', operator: 'is_not_empty' }, { lead: { score: null } })).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(evaluateCondition({ field: 'lead.missing', operator: 'is_not_empty' }, { lead: {} })).toBe(false);
    });

    it('should return true for non-empty value', () => {
      expect(evaluateCondition({ field: 'lead.name', operator: 'is_not_empty' }, { lead: { name: 'John' } })).toBe(true);
    });

    it('should return true for non-empty array', () => {
      expect(evaluateCondition({ field: 'lead.tags', operator: 'is_not_empty' }, { lead: { tags: ['vip'] } })).toBe(true);
    });
  });

  describe('in_list operator', () => {
    it('should return true when value is in list', () => {
      expect(evaluateCondition({ field: 'lead.status', operator: 'in_list', value: ['active', 'new'] }, { lead: { status: 'active' } })).toBe(true);
    });

    it('should return false when value is not in list', () => {
      expect(evaluateCondition({ field: 'lead.status', operator: 'in_list', value: ['active', 'new'] }, { lead: { status: 'inactive' } })).toBe(false);
    });

    it('should return false when value is not an array', () => {
      expect(evaluateCondition({ field: 'lead.status', operator: 'in_list', value: 'active' }, { lead: { status: 'active' } })).toBe(false);
    });
  });

  describe('not_in_list operator', () => {
    it('should return true when value is not in list', () => {
      expect(evaluateCondition({ field: 'lead.status', operator: 'not_in_list', value: ['active', 'new'] }, { lead: { status: 'inactive' } })).toBe(true);
    });

    it('should return false when value is in list', () => {
      expect(evaluateCondition({ field: 'lead.status', operator: 'not_in_list', value: ['active', 'new'] }, { lead: { status: 'active' } })).toBe(false);
    });

    it('should return true when value is not an array', () => {
      expect(evaluateCondition({ field: 'lead.status', operator: 'not_in_list', value: 'active' }, { lead: { status: 'active' } })).toBe(true);
    });
  });

  describe('nested field access', () => {
    it('should access deeply nested fields', () => {
      const payload = { lead: { address: { city: 'New York' } } };
      expect(evaluateCondition({ field: 'lead.address.city', operator: 'equals', value: 'New York' }, payload)).toBe(true);
    });

    it('should return undefined for missing nested paths', () => {
      const payload = { lead: { name: 'John' } };
      expect(evaluateCondition({ field: 'lead.address.city', operator: 'is_empty' }, payload)).toBe(true);
    });
  });

  describe('unknown operator', () => {
    it('should return false for unknown operators', () => {
      expect(evaluateCondition({ field: 'lead.name', operator: 'unknown_op', value: 'test' }, { lead: { name: 'test' } })).toBe(false);
    });
  });
});
