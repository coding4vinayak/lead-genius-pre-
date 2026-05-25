const SPAM_WORDS: { word: string; weight: number; reason: string }[] = [
  { word: 'free', weight: 8, reason: 'Common spam trigger word' },
  { word: 'urgent', weight: 10, reason: 'Creates artificial urgency' },
  { word: 'act now', weight: 12, reason: 'High-pressure language' },
  { word: 'limited time', weight: 10, reason: 'Creates artificial scarcity' },
  { word: 'click here', weight: 9, reason: 'Generic call-to-action often flagged' },
  { word: 'buy now', weight: 10, reason: 'Direct sales language' },
  { word: 'order now', weight: 9, reason: 'Direct sales language' },
  { word: 'no obligation', weight: 7, reason: 'Common in spam emails' },
  { word: 'risk-free', weight: 8, reason: 'Often used in spam' },
  { word: 'guarantee', weight: 6, reason: 'Can trigger spam filters' },
  { word: 'winner', weight: 9, reason: 'Prize/lottery spam indicator' },
  { word: 'congratulations', weight: 8, reason: 'Prize/lottery spam indicator' },
  { word: 'cash', weight: 7, reason: 'Financial spam indicator' },
  { word: 'earn money', weight: 10, reason: 'Get-rich-quick spam indicator' },
  { word: 'make money', weight: 10, reason: 'Get-rich-quick spam indicator' },
  { word: 'no cost', weight: 8, reason: 'Similar to "free" - spam trigger' },
  { word: 'discount', weight: 5, reason: 'Moderate spam risk' },
  { word: 'exclusive deal', weight: 7, reason: 'Promotional spam language' },
  { word: 'amazing', weight: 4, reason: 'Hyperbolic language' },
  { word: 'incredible', weight: 4, reason: 'Hyperbolic language' },
  { word: 'unsubscribe', weight: 3, reason: 'Low risk but tracked by filters' },
  { word: 'credit card', weight: 7, reason: 'Financial spam indicator' },
  { word: 'double your', weight: 9, reason: 'Get-rich-quick spam indicator' },
  { word: 'lowest price', weight: 7, reason: 'Sales pressure language' },
  { word: 'as seen on', weight: 6, reason: 'Infomercial spam language' },
  { word: 'apply now', weight: 6, reason: 'Can trigger spam filters' },
  { word: '100%', weight: 5, reason: 'Absolute claims trigger filters' },
  { word: 'no strings attached', weight: 8, reason: 'Common spam phrase' },
  { word: 'limited offer', weight: 9, reason: 'Artificial scarcity' },
  { word: 'act immediately', weight: 11, reason: 'High-pressure language' },
];

export interface FlaggedWord {
  word: string;
  index: number;
  length: number;
  reason: string;
  weight: number;
}

export interface SpamCheckResult {
  score: number;
  flaggedWords: FlaggedWord[];
  label: 'Low Risk' | 'Medium Risk' | 'High Risk';
}

export function checkSpam(text: string): SpamCheckResult {
  const lowerText = text.toLowerCase();
  const flaggedWords: FlaggedWord[] = [];
  let totalWeight = 0;

  for (const entry of SPAM_WORDS) {
    let searchFrom = 0;
    const lowerWord = entry.word.toLowerCase();

    while (searchFrom < lowerText.length) {
      const idx = lowerText.indexOf(lowerWord, searchFrom);
      if (idx === -1) break;

      flaggedWords.push({
        word: text.slice(idx, idx + entry.word.length),
        index: idx,
        length: entry.word.length,
        reason: entry.reason,
        weight: entry.weight,
      });
      totalWeight += entry.weight;
      searchFrom = idx + entry.word.length;
    }
  }

  // Normalize score to 0-100 range
  const score = Math.min(100, Math.round(totalWeight * 2.5));

  let label: SpamCheckResult['label'] = 'Low Risk';
  if (score > 60) label = 'High Risk';
  else if (score > 30) label = 'Medium Risk';

  return { score, flaggedWords, label };
}

export function getScoreColor(score: number): string {
  if (score <= 30) return 'text-green-600';
  if (score <= 60) return 'text-yellow-600';
  return 'text-red-600';
}

export function getScoreBarColor(score: number): string {
  if (score <= 30) return 'bg-green-500';
  if (score <= 60) return 'bg-yellow-500';
  return 'bg-red-500';
}
