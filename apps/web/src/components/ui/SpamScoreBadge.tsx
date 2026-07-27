interface SpamScoreBadgeProps {
  score: number;
  showLabel?: boolean;
}

function getScoreColor(score: number): { bg: string; text: string; label: string } {
  if (score < 30) {
    return { bg: 'bg-green-100', text: 'text-green-800', label: 'Low Risk' };
  }
  if (score < 60) {
    return { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Medium Risk' };
  }
  return { bg: 'bg-red-100', text: 'text-red-800', label: 'High Risk' };
}

export default function SpamScoreBadge({ score, showLabel = true }: SpamScoreBadgeProps) {
  const { bg, text, label } = getScoreColor(score);

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${bg} ${text}`}
      title={`Spam Score: ${score}/100 - ${label}`}
    >
      <span className="font-bold">{score}</span>
      {showLabel && <span>/ 100 - {label}</span>}
    </span>
  );
}
