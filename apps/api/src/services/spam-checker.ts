export interface SpamIssue {
  word: string;
  severity: 'high' | 'medium' | 'low';
  context: string;
}

export interface SpamCheckResult {
  score: number;
  issues: SpamIssue[];
  suggestions: string[];
}

const HIGH_SEVERITY_WORDS = [
  'act now', 'buy direct', 'no obligation', 'winner', 'congratulations',
  'you have been selected', 'urgent action', 'immediate action required',
  'cash bonus', 'risk free', 'no risk', 'double your money', 'earn extra cash',
  'fast cash', 'make money', 'million dollars', 'pure profit', 'work from home',
  'be your own boss', 'financial freedom', 'get rich quick', 'incredible deal',
  'money back guarantee', 'no catch', 'no fees', 'no gimmick', 'no hidden costs',
  'no purchase necessary', 'no strings attached', 'prize', 'you are a winner',
  'winning', 'claim your prize', 'apply now', 'call now', 'click below',
  'do it today', 'dont delete', 'for instant access', 'get it now',
  'get started now', 'great offer', 'info you requested', 'instant access',
  'limited time only', 'new customers only', 'now only', 'offer expires',
  'once in a lifetime', 'order now', 'please read', 'take action now',
  'this wont last', 'while supplies last', 'you cant miss this',
  'act immediately', 'call free', 'click here now', 'exclusive deal',
  'final notice', 'for free', 'free gift', 'free membership',
  'free money', 'free trial', 'guaranteed winner', 'last chance',
  'no cost', 'no credit card required', 'obligation free',
  'once in lifetime', 'open immediately', 'supplies limited',
  'time limited', 'unlimited income', 'what are you waiting for',
  'you have won', 'zero cost', 'zero risk',
];

const MEDIUM_SEVERITY_WORDS = [
  'free', 'limited time', 'special promotion', 'bonus', 'discount',
  'save big', 'lowest price', 'bargain', 'cheap', 'compare rates',
  'deal', 'give it away', 'giveaway', 'profit', 'reduced',
  'sale', 'save money', 'special offer', 'amazing stuff',
  'cancel anytime', 'check this out', 'congratulation', 'dear friend',
  'direct email', 'direct marketing', 'exclusive offer', 'fantastic deal',
  'for only', 'here is your chance', 'hidden charges', 'incredible offer',
  'marketing solution', 'opt in', 'opt out', 'pennies a day',
  'potential earnings', 'remove me', 'satisfaction guaranteed',
  'sent in compliance', 'special deal', 'this is not spam',
  'unbeatable offer', 'unsolicited', 'urgent', 'we hate spam',
  'web traffic', 'will not believe your eyes', 'act fast',
  'best price', 'big savings', 'bulk mail', 'cash', 'clearance',
  'collect now', 'confidential', 'earn money', 'extra income',
  'extra cash', 'fast money', 'free access', 'free consultation',
  'free info', 'free investment', 'free offer', 'free preview',
  'free quote', 'free sample', 'full refund', 'income from home',
  'investment opportunity', 'join millions', 'low cost', 'mass email',
  'money making', 'month free', 'no deposit', 'no experience',
  'no investment', 'no questions asked', 'offer limited', 'only today',
  'opportunity knocks', 'outstanding values', 'promise you',
  'real thing', 'risk-free', 'save now', 'serious offer',
  'sign up free', 'substantial income', 'trial offer', 'undeniable',
];

const LOW_SEVERITY_WORDS = [
  'click here', 'subscribe', 'offer', 'buy', 'order',
  'purchase', 'selling', 'sold', 'shopper', 'shopping',
  'unsubscribe', 'opt-out', 'remove', 'notification', 'alert',
  'attention', 'important', 'information', 'regarding', 'solution',
  'opportunity', 'improve', 'increase', 'performance', 'success',
  'results', 'guarantee', 'proven', 'tested', 'certified',
  'amazing', 'incredible', 'revolutionary', 'breakthrough', 'miracle',
  'sensational', 'outstanding', 'remarkable', 'fantastic', 'wonderful',
  'now', 'today', 'instant', 'quick', 'fast',
  'limited', 'exclusive', 'selected', 'special', 'personal',
  'customize', 'tailored', 'unique', 'new', 'introducing',
  'announcing', 'launch', 'presenting', 'revealed',
];

const SEVERITY_WEIGHTS: Record<string, number> = {
  high: 5,
  medium: 3,
  low: 1,
};

function getContext(text: string, word: string): string {
  const lowerText = text.toLowerCase();
  const idx = lowerText.indexOf(word.toLowerCase());
  if (idx === -1) return '';
  const start = Math.max(0, idx - 20);
  const end = Math.min(text.length, idx + word.length + 20);
  return text.slice(start, end).trim();
}

function findSpamWords(text: string): SpamIssue[] {
  const issues: SpamIssue[] = [];
  const lowerText = text.toLowerCase();

  for (const word of HIGH_SEVERITY_WORDS) {
    if (lowerText.includes(word)) {
      issues.push({ word, severity: 'high', context: getContext(text, word) });
    }
  }

  for (const word of MEDIUM_SEVERITY_WORDS) {
    if (lowerText.includes(word)) {
      issues.push({ word, severity: 'medium', context: getContext(text, word) });
    }
  }

  for (const word of LOW_SEVERITY_WORDS) {
    if (lowerText.includes(word)) {
      issues.push({ word, severity: 'low', context: getContext(text, word) });
    }
  }

  return issues;
}

function calculateCapsPercentage(text: string): number {
  const letters = text.replace(/[^a-zA-Z]/g, '');
  if (letters.length === 0) return 0;
  const upperCount = (text.match(/[A-Z]/g) || []).length;
  return (upperCount / letters.length) * 100;
}

function countExclamationMarks(text: string): number {
  return (text.match(/!/g) || []).length;
}

function calculateLinkToTextRatio(text: string): number {
  const linkPattern = /https?:\/\/[^\s<>"{}|\\^`[\]]+/gi;
  const links = text.match(linkPattern) || [];
  const plainText = text.replace(/<[^>]*>/g, '').trim();
  if (plainText.length === 0) return 0;
  const linkTextLength = links.reduce((sum, l) => sum + l.length, 0);
  return linkTextLength / plainText.length;
}

function isImageOnly(body: string): boolean {
  const stripped = body.replace(/<img[^>]*>/gi, '').replace(/<[^>]*>/g, '').trim();
  const hasImages = /<img[^>]*>/i.test(body);
  return hasImages && stripped.length < 20;
}

export function calculateSpamScore(subject: string, body: string): SpamCheckResult {
  const combinedText = `${subject} ${body}`;
  const issues = findSpamWords(combinedText);
  const suggestions: string[] = [];

  // Base score from spam words
  let score = 0;
  for (const issue of issues) {
    score += SEVERITY_WEIGHTS[issue.severity];
  }

  // ALL CAPS percentage
  const capsPercent = calculateCapsPercentage(combinedText);
  if (capsPercent > 30) {
    score += 15;
    suggestions.push('Reduce the use of ALL CAPS. Over 30% of your text is uppercase.');
  }

  // Excessive exclamation marks
  const exclamationCount = countExclamationMarks(combinedText);
  if (exclamationCount > 3) {
    score += 10;
    suggestions.push('Reduce exclamation marks. Using more than 3 can trigger spam filters.');
  }

  // Link-to-text ratio
  const linkRatio = calculateLinkToTextRatio(body);
  if (linkRatio > 0.3) {
    score += 10;
    suggestions.push('Your content has a high link-to-text ratio. Add more text content.');
  }

  // Image-only detection
  if (isImageOnly(body)) {
    score += 20;
    suggestions.push('Avoid image-only emails. Include text content alongside images.');
  }

  // Add general suggestions based on issues
  if (issues.some((i) => i.severity === 'high')) {
    suggestions.push('Remove high-severity spam trigger words to improve deliverability.');
  }
  if (issues.some((i) => i.severity === 'medium')) {
    suggestions.push('Consider rephrasing medium-severity trigger words.');
  }

  // Cap score at 100
  score = Math.min(100, score);

  return { score, issues, suggestions };
}
