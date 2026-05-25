import { X } from 'lucide-react';
import { Button, Input, Select } from '../ui';
import type { SequenceStep, StepConfig } from '../../hooks/useSequenceBuilder';

interface StepConfigPanelProps {
  step: SequenceStep;
  onUpdate: (id: string, updates: Partial<SequenceStep>) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

export default function StepConfigPanel({ step, onUpdate, onDelete, onClose }: StepConfigPanelProps) {
  const handleConfigChange = (key: keyof StepConfig, value: string | number) => {
    onUpdate(step.id, { config: { ...step.config, [key]: value } });
  };

  const renderFields = () => {
    switch (step.type) {
      case 'send_email':
        return (
          <>
            <Input
              label="Subject"
              value={step.config.subject || ''}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleConfigChange('subject', e.target.value)}
              placeholder="Email subject line"
            />
            <Input
              label="Template ID"
              value={step.config.templateId || ''}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleConfigChange('templateId', e.target.value)}
              placeholder="Select template"
            />
          </>
        );
      case 'send_whatsapp':
      case 'send_linkedin':
        return (
          <Input
            label="Message"
            value={step.config.message || ''}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleConfigChange('message', e.target.value)}
            placeholder="Message content"
          />
        );
      case 'delay':
        return (
          <>
            <Input
              label="Duration"
              type="number"
              value={step.config.delay || ''}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleConfigChange('delay', Number(e.target.value))}
              placeholder="Enter duration"
            />
            <Select
              label="Unit"
              options={[
                { value: 'minutes', label: 'Minutes' },
                { value: 'hours', label: 'Hours' },
                { value: 'days', label: 'Days' },
              ]}
              value={step.config.delayUnit || 'hours'}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => handleConfigChange('delayUnit', e.target.value)}
            />
          </>
        );
      case 'condition':
        return (
          <>
            <Input
              label="Field"
              value={step.config.field || ''}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleConfigChange('field', e.target.value)}
              placeholder="e.g., lead.opened_email"
            />
            <Select
              label="Operator"
              options={[
                { value: 'equals', label: 'Equals' },
                { value: 'not_equals', label: 'Not Equals' },
                { value: 'greater_than', label: 'Greater Than' },
                { value: 'less_than', label: 'Less Than' },
                { value: 'contains', label: 'Contains' },
              ]}
              value={step.config.operator || 'equals'}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => handleConfigChange('operator', e.target.value)}
            />
            <Input
              label="Value"
              value={step.config.value || ''}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleConfigChange('value', e.target.value)}
              placeholder="Comparison value"
            />
          </>
        );
      case 'update_lead_stage':
        return (
          <Select
            label="Stage"
            options={[
              { value: 'new', label: 'New' },
              { value: 'contacted', label: 'Contacted' },
              { value: 'qualified', label: 'Qualified' },
              { value: 'proposal', label: 'Proposal' },
              { value: 'won', label: 'Won' },
              { value: 'lost', label: 'Lost' },
            ]}
            value={step.config.stage || 'new'}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => handleConfigChange('stage', e.target.value)}
          />
        );
      case 'update_lead_score':
        return (
          <Input
            label="Score Change"
            type="number"
            value={step.config.scoreChange || ''}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleConfigChange('scoreChange', Number(e.target.value))}
            placeholder="e.g., +10 or -5"
          />
        );
      default:
        return null;
    }
  };

  return (
    <div
      data-testid="step-config-panel"
      className="fixed top-0 right-0 h-full w-80 bg-white border-l border-gray-200 shadow-xl z-40 flex flex-col"
    >
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <h3 className="font-semibold text-gray-900">Configure Step</h3>
        <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg transition-colors">
          <X size={18} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <Input
          label="Step Title"
          value={step.title}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => onUpdate(step.id, { title: e.target.value })}
        />
        {renderFields()}
      </div>
      <div className="p-4 border-t border-gray-200 flex gap-2">
        <Button variant="secondary" size="sm" onClick={onClose} className="flex-1">Cancel</Button>
        <Button variant="danger" size="sm" onClick={() => onDelete(step.id)} className="flex-1">Delete</Button>
        <Button variant="primary" size="sm" onClick={onClose} className="flex-1">Save</Button>
      </div>
    </div>
  );
}
