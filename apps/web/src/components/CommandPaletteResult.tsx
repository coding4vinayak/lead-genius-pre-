import type { CommandPaletteItem } from '../lib/commandPaletteItems';

interface Props {
  item: CommandPaletteItem;
  matchedIndices: number[];
  isSelected: boolean;
  onClick: () => void;
}

function HighlightedLabel({ label, matchedIndices }: { label: string; matchedIndices: number[] }) {
  if (matchedIndices.length === 0) {
    return <span>{label}</span>;
  }

  const indexSet = new Set(matchedIndices);
  return (
    <span>
      {label.split('').map((char, i) =>
        indexSet.has(i) ? (
          <span key={i} className="text-blue-500 font-semibold">
            {char}
          </span>
        ) : (
          <span key={i}>{char}</span>
        ),
      )}
    </span>
  );
}

export default function CommandPaletteResult({ item, matchedIndices, isSelected, onClick }: Props) {
  const Icon = item.icon;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-3 w-full px-4 py-2.5 text-left transition-colors ${
        isSelected ? 'bg-blue-50 text-blue-900' : 'text-gray-700 hover:bg-gray-50'
      }`}
      data-testid="command-palette-result"
    >
      <Icon size={18} className={isSelected ? 'text-blue-500' : 'text-gray-400'} />
      <span className="flex-1 text-sm font-medium">
        <HighlightedLabel label={item.label} matchedIndices={matchedIndices} />
      </span>
      <span className={`text-xs px-2 py-0.5 rounded-full ${
        isSelected ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500'
      }`}>
        {item.category}
      </span>
    </button>
  );
}
