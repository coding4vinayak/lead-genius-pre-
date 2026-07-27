import { motion } from 'framer-motion';
import { Mail, MessageSquare, Clock, Filter, Users, GitBranch, Linkedin, Send } from 'lucide-react';
import type { SequenceStep } from '../../hooks/useSequenceBuilder';

const STATUS_COLORS: Record<string, { border: string; bg: string }> = {
  completed: { border: 'border-green-400', bg: 'bg-green-50' },
  active: { border: 'border-blue-400', bg: 'bg-blue-50' },
  pending: { border: 'border-gray-300', bg: 'bg-gray-50' },
  failed: { border: 'border-red-400', bg: 'bg-red-50' },
};

const STEP_ICONS: Record<string, React.ReactNode> = {
  send_email: <Mail size={18} />,
  send_whatsapp: <MessageSquare size={18} />,
  send_linkedin: <Linkedin size={18} />,
  delay: <Clock size={18} />,
  condition: <Filter size={18} />,
  update_lead_stage: <Users size={18} />,
  update_lead_score: <GitBranch size={18} />,
};

interface SequenceNodeProps {
  step: SequenceStep;
  isSelected: boolean;
  onClick: () => void;
  onDragStart: (e: React.PointerEvent) => void;
}

export default function SequenceNode({ step, isSelected, onClick, onDragStart }: SequenceNodeProps) {
  const colors = STATUS_COLORS[step.status] || STATUS_COLORS.pending;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.2 }}
      data-testid={`sequence-node-${step.id}`}
      className={`relative w-64 rounded-lg border-2 ${colors.border} ${colors.bg} p-3 cursor-pointer select-none transition-shadow ${
        isSelected ? 'ring-2 ring-blue-500 shadow-lg' : 'hover:shadow-md'
      }`}
      onClick={onClick}
      onPointerDown={onDragStart}
    >
      <div className="flex items-center gap-2 mb-1">
        <span className="text-gray-600">{STEP_ICONS[step.type] || <Send size={18} />}</span>
        <span className="font-medium text-sm text-gray-900 truncate">{step.title}</span>
      </div>
      {step.stats && (
        <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
          {step.stats.sent !== undefined && <span>Sent: {step.stats.sent}</span>}
          {step.stats.openRate !== undefined && <span>Open: {step.stats.openRate}%</span>}
        </div>
      )}
    </motion.div>
  );
}
