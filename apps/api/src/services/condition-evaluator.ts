export interface Condition {
  field: string;
  operator: string;
  value?: unknown;
}

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = obj;
  for (const part of parts) {
    if (current == null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

export function evaluateCondition(condition: Condition, payload: Record<string, unknown>): boolean {
  const fieldValue = getNestedValue(payload, condition.field);
  const compareValue = condition.value;

  switch (condition.operator) {
    case 'equals':
      return fieldValue === compareValue;

    case 'not_equals':
      return fieldValue !== compareValue;

    case 'contains': {
      if (Array.isArray(fieldValue)) {
        return fieldValue.includes(compareValue);
      }
      if (typeof fieldValue === 'string' && typeof compareValue === 'string') {
        return fieldValue.includes(compareValue);
      }
      return false;
    }

    case 'not_contains': {
      if (Array.isArray(fieldValue)) {
        return !fieldValue.includes(compareValue);
      }
      if (typeof fieldValue === 'string' && typeof compareValue === 'string') {
        return !fieldValue.includes(compareValue);
      }
      return true;
    }

    case 'greater_than': {
      if (typeof fieldValue === 'number' && typeof compareValue === 'number') {
        return fieldValue > compareValue;
      }
      return false;
    }

    case 'less_than': {
      if (typeof fieldValue === 'number' && typeof compareValue === 'number') {
        return fieldValue < compareValue;
      }
      return false;
    }

    case 'is_empty':
      return fieldValue == null || fieldValue === '' || (Array.isArray(fieldValue) && fieldValue.length === 0);

    case 'is_not_empty':
      return fieldValue != null && fieldValue !== '' && !(Array.isArray(fieldValue) && fieldValue.length === 0);

    case 'in_list': {
      if (Array.isArray(compareValue)) {
        return compareValue.includes(fieldValue);
      }
      return false;
    }

    case 'not_in_list': {
      if (Array.isArray(compareValue)) {
        return !compareValue.includes(fieldValue);
      }
      return true;
    }

    default:
      return false;
  }
}
