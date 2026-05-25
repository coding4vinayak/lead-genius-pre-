import { useState, useRef, useEffect } from 'react';
import { Plus, Mail, MessageSquare, Linkedin, Clock, Filter, Users, GitBranch } from 'lucide-react';
import type { StepType } from '../../hooks/useSequenceBuilder';

const STEP_OPTIONS: { type: StepType; label: string; icon: React.ReactNode }[] = [
  { type: 'send_email', label: 'Send Email', icon: <Mail size={14} /> },
  { type: 'send_whatsapp', label: 'Send WhatsApp', icon: <MessageSquare size={14} /> },
  { type: 'send_linkedin', label: 'Send LinkedIn', icon: <Linkedin size={14} /> },
  { type: 'delay', label: 'Delay', icon: <Clock size={14} /> },
  { type: 'condition', label: 'Condition', icon: <Filter size={14} /> },
  { type: 'update_lead_stage', label: 'Update Lead Stage', icon: <Users size={14} /> },
  { type: 'update_lead_score', label: 'Update Lead Score', icon: <GitBranch size={14} /> },
];

interface AddStepButtonProps {
  afterIndex: number;
  onAdd: (afterIndex: number, type: StepType) => void;
}

export default function AddStepButton({ afterIndex, onAdd }: AddStepButtonProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div className="relative flex justify-center my-2" ref={ref}>
      <button
        data-testid="add-step-button"
        onClick={() => setOpen(!open)}
        className="w-7 h-7 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center transition-colors"
      >
        <Plus size={14} className="text-gray-600" />
      </button>
      {open && (
        <div
          data-testid="step-type-dropdown"
          className="absolute top-8 z-50 w-52 bg-white rounded-lg shadow-lg border border-gray-200 py-1"
        >
          {STEP_OPTIONS.map((opt) => (
            <button
              key={opt.type}
              onClick={() => { onAdd(afterIndex, opt.type); setOpen(false); }}
              className="w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-gray-50 text-gray-700 transition-colors"
            >
              {opt.icon}
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
