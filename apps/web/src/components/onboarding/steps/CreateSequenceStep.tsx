import { useState } from 'react';
import { Play, Clock, Mail } from 'lucide-react';
import { Button, Input } from '../../ui';
import { useOnboardingStore } from '../../../store/onboarding';

export default function CreateSequenceStep() {
  const completeStep = useOnboardingStore((s) => s.completeStep);
  const [delay, setDelay] = useState('2');
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    completeStep('sequence');
  };

  return (
    <div className="max-w-md mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-[var(--color-primary-50)] rounded-lg flex items-center justify-center">
          <Play className="text-[var(--color-primary)]" size={20} />
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-900">Create Sequence</h2>
          <p className="text-sm text-gray-500">Set up an automated email sequence</p>
        </div>
      </div>

      {/* Sequence visualization */}
      <div className="space-y-0 mb-6">
        {/* Step 1 */}
        <div className="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-lg">
          <div className="w-8 h-8 rounded-full bg-[var(--color-primary-50)] flex items-center justify-center shrink-0">
            <Mail size={14} className="text-[var(--color-primary)]" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-900">Send Welcome Email</p>
            <p className="text-xs text-gray-500">Your template from the previous step</p>
          </div>
        </div>

        {/* Connector */}
        <div className="flex items-center gap-3 pl-6 py-1">
          <div className="w-0.5 h-6 bg-gray-300" />
        </div>

        {/* Wait */}
        <div className="flex items-center gap-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="w-8 h-8 rounded-full bg-yellow-100 flex items-center justify-center shrink-0">
            <Clock size={14} className="text-yellow-600" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-900">Wait</p>
            <div className="flex items-center gap-2 mt-1">
              <input
                type="number"
                min="1"
                max="30"
                value={delay}
                onChange={(e) => setDelay(e.target.value)}
                className="w-16 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              />
              <span className="text-xs text-gray-500">days</span>
            </div>
          </div>
        </div>

        {/* Connector */}
        <div className="flex items-center gap-3 pl-6 py-1">
          <div className="w-0.5 h-6 bg-gray-300" />
        </div>

        {/* Step 2 */}
        <div className="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-lg">
          <div className="w-8 h-8 rounded-full bg-[var(--color-primary-50)] flex items-center justify-center shrink-0">
            <Mail size={14} className="text-[var(--color-primary)]" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-900">Send Follow-up</p>
            <p className="text-xs text-gray-500">Automated follow-up message</p>
          </div>
        </div>
      </div>

      <Button onClick={handleSave} className="w-full">
        {saved ? 'Sequence Saved!' : 'Save Sequence'}
      </Button>
    </div>
  );
}
