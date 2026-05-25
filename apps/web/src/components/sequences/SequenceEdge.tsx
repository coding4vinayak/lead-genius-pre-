interface SequenceEdgeProps {
  fromY: number;
  toY: number;
  label?: string;
  isBranch?: boolean;
  branchDirection?: 'left' | 'right';
}

export default function SequenceEdge({ fromY, toY, label, isBranch, branchDirection }: SequenceEdgeProps) {
  const centerX = 160;
  const offsetX = isBranch ? (branchDirection === 'left' ? -40 : 40) : 0;
  const midY = (fromY + toY) / 2;

  const path = isBranch
    ? `M ${centerX} ${fromY} C ${centerX} ${midY}, ${centerX + offsetX} ${midY}, ${centerX + offsetX} ${toY}`
    : `M ${centerX} ${fromY} C ${centerX} ${midY}, ${centerX} ${midY}, ${centerX} ${toY}`;

  return (
    <g>
      <path
        d={path}
        fill="none"
        stroke="#9ca3af"
        strokeWidth={2}
        markerEnd="url(#arrowhead)"
      />
      {label && (
        <text
          x={centerX + offsetX + (branchDirection === 'left' ? -15 : 15)}
          y={midY}
          textAnchor="middle"
          className="text-xs fill-gray-500"
          fontSize={11}
        >
          {label}
        </text>
      )}
    </g>
  );
}
