import { describe, it, expect } from 'vitest';
import { calculateSpamScore } from './spam-checker.js';

describe('Spam Checker Service', () => {
  describe('calculateSpamScore', () => {
    it('should return a low score for clean email content', () => {
      const result = calculateSpamScore(
        'Project Update - Q1 Progress',
        '<p>Hi team, here is the quarterly update on our project milestones.</p>',
      );

      expect(result.score).toBeLessThan(30);
      expect(result.issues.length).toBeLessThan(5);
    });

    it('should return a high score for spammy email content', () => {
      const result = calculateSpamScore(
        'ACT NOW - FREE MONEY!!!',
        '<p>WINNER! You have been selected to earn extra cash! Buy direct with no obligation! Click here now for instant access to your prize! Limited time only - get rich quick!</p>',
      );

      expect(result.score).toBeGreaterThan(50);
      expect(result.issues.length).toBeGreaterThan(5);
      expect(result.issues.some((i) => i.severity === 'high')).toBe(true);
    });

    it('should detect ALL CAPS content', () => {
      const result = calculateSpamScore(
        'IMPORTANT UPDATE',
        '<p>THIS IS AN IMPORTANT MESSAGE THAT IS WRITTEN ENTIRELY IN CAPS FOR SOME REASON</p>',
      );

      expect(result.suggestions.some((s) => s.includes('ALL CAPS'))).toBe(true);
    });

    it('should detect excessive exclamation marks', () => {
      const result = calculateSpamScore(
        'Hello!!!!',
        '<p>This is great!!!! You will love it!!!! Amazing!!!!</p>',
      );

      expect(result.suggestions.some((s) => s.includes('exclamation'))).toBe(true);
    });

    it('should detect high link-to-text ratio', () => {
      const result = calculateSpamScore(
        'Links',
        'Go https://example.com/very-long-url-path/page1 and https://example.com/very-long-url-path/page2 and https://example.com/very-long-url-path/page3',
      );

      expect(result.suggestions.some((s) => s.includes('link-to-text'))).toBe(true);
    });

    it('should detect image-only emails', () => {
      const result = calculateSpamScore(
        'Newsletter',
        '<img src="https://example.com/banner.jpg" alt="banner">',
      );

      expect(result.suggestions.some((s) => s.includes('image-only'))).toBe(true);
    });

    it('should cap score at 100', () => {
      const result = calculateSpamScore(
        'ACT NOW FREE MONEY WIN PRIZE BUY DIRECT!!!!!!',
        '<p>ACT NOW! BUY DIRECT! NO OBLIGATION! WINNER! YOU HAVE BEEN SELECTED! EARN EXTRA CASH! CLICK HERE NOW! INSTANT ACCESS! GET RICH QUICK! DOUBLE YOUR MONEY! RISK FREE! CASH BONUS! FAST CASH! MAKE MONEY! MILLION DOLLARS! PURE PROFIT! WORK FROM HOME! BE YOUR OWN BOSS! FINANCIAL FREEDOM!</p>',
      );

      expect(result.score).toBeLessThanOrEqual(100);
    });

    it('should return context for identified issues', () => {
      const result = calculateSpamScore(
        'Hello',
        '<p>Please act now to get your free gift.</p>',
      );

      const highIssue = result.issues.find((i) => i.severity === 'high');
      expect(highIssue).toBeDefined();
      expect(highIssue!.context.length).toBeGreaterThan(0);
    });

    it('should provide suggestions for high severity words', () => {
      const result = calculateSpamScore(
        'Act now',
        '<p>Buy direct with no obligation</p>',
      );

      expect(result.suggestions.some((s) => s.includes('high-severity'))).toBe(true);
    });

    it('should handle empty inputs', () => {
      const result = calculateSpamScore('', '');

      expect(result.score).toBe(0);
      expect(result.issues).toHaveLength(0);
    });
  });
});
