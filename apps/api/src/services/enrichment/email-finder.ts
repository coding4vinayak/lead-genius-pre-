export interface EmailPattern {
  email: string;
  pattern: string;
  confidence: number;
  verification: 'unverified';
}

const PATTERNS: Array<{ name: string; generate: (first: string, last: string, domain: string) => string; confidence: number }> = [
  { name: 'first.last', generate: (f, l, d) => `${f}.${l}@${d}`, confidence: 0.95 },
  { name: 'first', generate: (f, _l, d) => `${f}@${d}`, confidence: 0.85 },
  { name: 'firstlast', generate: (f, l, d) => `${f}${l}@${d}`, confidence: 0.80 },
  { name: 'f.last', generate: (f, l, d) => `${f[0]}.${l}@${d}`, confidence: 0.75 },
  { name: 'flast', generate: (f, l, d) => `${f[0]}${l}@${d}`, confidence: 0.70 },
  { name: 'first.l', generate: (f, l, d) => `${f}.${l[0]}@${d}`, confidence: 0.60 },
  { name: 'first_last', generate: (f, l, d) => `${f}_${l}@${d}`, confidence: 0.55 },
  { name: 'last', generate: (_f, l, d) => `${l}@${d}`, confidence: 0.50 },
];

export function findEmail(firstName: string, lastName: string, domain: string): EmailPattern[] {
  const first = firstName.toLowerCase().trim();
  const last = lastName.toLowerCase().trim();
  const d = domain.toLowerCase().trim();

  if (!first || !last || !d) return [];

  return PATTERNS.map(({ name, generate, confidence }) => ({
    email: generate(first, last, d),
    pattern: name,
    confidence,
    verification: 'unverified' as const,
  }));
}
