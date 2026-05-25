import { getScoreColor, getScoreBarColor } from '../../lib/spamChecker';
import type { SpamCheckResult } from '../../lib/spamChecker';

interface SpamScoreIndicatorProps {
  result: SpamCheckResult;
}

export default function SpamScoreIndicator({ result }: SpamScoreIndicatorProps) {
  const { score, label } = result;

  return (
    <div className="p-3 border border-gray-200 rounded-lg bg-white">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-gray-700">Spam Score</span>
        <span className={`text-sm font-bold ${getScoreColor(score)}`}>{score}/100</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
        <div
          className={`h-full rounded-full transition-all duration-300 ${getScoreBarColor(score)}`}
          style={{ width: `${score}%` }}
        />
      </div>
      <p className={`text-xs font-medium ${getScoreColor(score)}`}>{label}</p>
      {result.flaggedWords.length > 0 && (
        <p className="text-xs text-gray-500 mt-1">
          {result.flaggedWords.length} flagged word{result.flaggedWords.length !== 1 ? 's' : ''} detected
        </p>
      )}
    </div>
  );
}
