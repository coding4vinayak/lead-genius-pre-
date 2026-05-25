import type { SeniorityLevel, Department } from '@leadgenius/shared';

export interface RoleInferenceResult {
  seniority: SeniorityLevel;
  department: Department;
  decisionMaker: boolean;
}

const SENIORITY_PATTERNS: Array<{ pattern: RegExp; level: SeniorityLevel }> = [
  { pattern: /\b(ceo|cto|cfo|coo|cmo|cio|cpo|chief)\b/i, level: 'c_suite' },
  { pattern: /\b(vp|vice\s*president)\b/i, level: 'vp' },
  { pattern: /\b(director)\b/i, level: 'director' },
  { pattern: /\b(junior|jr\.?|associate|intern|entry)\b/i, level: 'junior' },
  { pattern: /\b(manager|head\s+of|team\s+lead)\b/i, level: 'manager' },
  { pattern: /\b(senior|sr\.?|lead|principal|staff)\b/i, level: 'senior' },
];

const DEPARTMENT_PATTERNS: Array<{ pattern: RegExp; department: Department }> = [
  { pattern: /\b(engineer|developer|software|devops|sre|backend|frontend|full[\s-]?stack|architect|programming|tech)\b/i, department: 'engineering' },
  { pattern: /\b(marketing|growth|brand|content|seo|sem|social\s+media|demand\s+gen)\b/i, department: 'marketing' },
  { pattern: /\b(sales|account\s+executive|business\s+development|bdr|sdr|revenue)\b/i, department: 'sales' },
  { pattern: /\b(hr|human\s+resources|people|talent|recruiting|recruiter)\b/i, department: 'hr' },
  { pattern: /\b(finance|accounting|controller|treasurer|financial)\b/i, department: 'finance' },
  { pattern: /\b(operations|ops|logistics|supply\s+chain|procurement)\b/i, department: 'operations' },
  { pattern: /\b(product|pm|product\s+manager|product\s+owner)\b/i, department: 'product' },
  { pattern: /\b(design|ux|ui|creative|graphic)\b/i, department: 'design' },
];

export function inferRole(title: string | null | undefined): RoleInferenceResult {
  if (!title) {
    return { seniority: 'mid', department: 'other', decisionMaker: false };
  }

  let seniority: SeniorityLevel = 'mid';
  for (const { pattern, level } of SENIORITY_PATTERNS) {
    if (pattern.test(title)) {
      seniority = level;
      break;
    }
  }

  let department: Department = 'other';
  for (const { pattern, department: dept } of DEPARTMENT_PATTERNS) {
    if (pattern.test(title)) {
      department = dept;
      break;
    }
  }

  const decisionMaker = seniority === 'c_suite' || seniority === 'vp' || seniority === 'director';

  return { seniority, department, decisionMaker };
}
