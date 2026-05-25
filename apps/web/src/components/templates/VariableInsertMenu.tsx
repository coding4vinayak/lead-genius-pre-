import { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { Button } from '../ui';

const VARIABLES = [
  { key: 'name', label: 'Name' },
  { key: 'company', label: 'Company' },
  { key: 'title', label: 'Title' },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Phone' },
  { key: 'booking_link', label: 'Booking Link' },
];

interface VariableInsertMenuProps {
  onInsert: (variable: string) => void;
}

export default function VariableInsertMenu({ onInsert }: VariableInsertMenuProps) {
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
    <div className="relative" ref={ref}>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => setOpen(!open)}
        type="button"
      >
        Insert Variable
        <ChevronDown size={14} className="ml-1" />
      </Button>
      {open && (
        <div className="absolute left-0 mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
          {VARIABLES.map((v) => (
            <button
              key={v.key}
              onClick={() => { onInsert(`{{${v.key}}}`); setOpen(false); }}
              className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors font-mono"
            >
              {'{{' + v.key + '}}'}
              <span className="text-gray-400 ml-2 font-sans text-xs">{v.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
