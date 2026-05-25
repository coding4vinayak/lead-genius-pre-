import { useState } from 'react';
import { FileText } from 'lucide-react';
import { Button, Input } from '../../ui';
import { useOnboardingStore } from '../../../store/onboarding';

const STARTER_TEMPLATES = [
  {
    id: 'welcome',
    name: 'Welcome Email',
    subject: 'Welcome to {{company}}!',
    body: 'Hi {{name}},\n\nThank you for your interest in our product. We would love to help you get started.\n\nBest regards',
  },
  {
    id: 'followup',
    name: 'Follow-up',
    subject: 'Following up on our conversation',
    body: 'Hi {{name}},\n\nJust wanted to follow up on our previous conversation. Do you have any questions I can help with?\n\nBest regards',
  },
  {
    id: 'meeting',
    name: 'Meeting Request',
    subject: 'Quick call this week?',
    body: 'Hi {{name}},\n\nI would love to schedule a quick 15-minute call to discuss how we can help {{company}} achieve its goals.\n\nWould any of these times work for you?\n\nBest regards',
  },
];

export default function CreateTemplateStep() {
  const completeStep = useOnboardingStore((s) => s.completeStep);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [saved, setSaved] = useState(false);

  const handleSelect = (id: string) => {
    const template = STARTER_TEMPLATES.find((t) => t.id === id);
    if (template) {
      setSelectedId(id);
      setSubject(template.subject);
      setBody(template.body);
      setSaved(false);
    }
  };

  const handleSave = () => {
    setSaved(true);
    completeStep('template');
  };

  return (
    <div className="max-w-md mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-[var(--color-primary-50)] rounded-lg flex items-center justify-center">
          <FileText className="text-[var(--color-primary)]" size={20} />
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-900">Create Template</h2>
          <p className="text-sm text-gray-500">Pick a starter template to customize</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2 mb-6">
        {STARTER_TEMPLATES.map((t) => (
          <button
            key={t.id}
            onClick={() => handleSelect(t.id)}
            className={`p-3 rounded-lg border-2 text-left transition-all ${
              selectedId === t.id ? 'border-[var(--color-primary)] bg-[var(--color-primary-50)]' : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <p className="font-medium text-gray-900 text-sm">{t.name}</p>
            <p className="text-xs text-gray-500 mt-0.5">{t.subject}</p>
          </button>
        ))}
      </div>

      {selectedId && (
        <div className="space-y-3">
          <Input
            label="Subject"
            value={subject}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSubject(e.target.value)}
          />
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">Body</label>
            <textarea
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent transition-all duration-200 min-h-[120px] resize-y"
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
          </div>
          <Button onClick={handleSave} className="w-full">
            {saved ? 'Saved!' : 'Save Template'}
          </Button>
        </div>
      )}
    </div>
  );
}
