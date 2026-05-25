import { useState } from 'react';
import { Monitor, Smartphone } from 'lucide-react';
import { Button } from '../ui';

const SAMPLE_LEADS = [
  { name: 'John Smith', company: 'Acme Corp', title: 'VP Sales', email: 'john@acme.com', phone: '+1-555-0123', booking_link: 'https://cal.com/john' },
  { name: 'Sarah Johnson', company: 'TechStart', title: 'CEO', email: 'sarah@techstart.io', phone: '+1-555-0456', booking_link: 'https://cal.com/sarah' },
  { name: 'Mike Williams', company: 'Global Inc', title: 'Director of Marketing', email: 'mike@global.com', phone: '+1-555-0789', booking_link: 'https://cal.com/mike' },
];

interface TemplatePreviewProps {
  content: string;
  subject?: string;
}

export default function TemplatePreview({ content, subject }: TemplatePreviewProps) {
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [sampleIndex, setSampleIndex] = useState(0);

  const currentLead = SAMPLE_LEADS[sampleIndex];

  function renderContent(text: string): string {
    return text
      .replace(/\{\{name\}\}/g, currentLead.name)
      .replace(/\{\{company\}\}/g, currentLead.company)
      .replace(/\{\{title\}\}/g, currentLead.title)
      .replace(/\{\{email\}\}/g, currentLead.email)
      .replace(/\{\{phone\}\}/g, currentLead.phone)
      .replace(/\{\{booking_link\}\}/g, currentLead.booking_link);
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-3 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center gap-2">
          <Button
            variant={device === 'desktop' ? 'primary' : 'ghost'}
            size="sm"
            onClick={() => setDevice('desktop')}
            type="button"
            title="Desktop view"
          >
            <Monitor size={14} />
          </Button>
          <Button
            variant={device === 'mobile' ? 'primary' : 'ghost'}
            size="sm"
            onClick={() => setDevice('mobile')}
            type="button"
            title="Mobile view"
          >
            <Smartphone size={14} />
          </Button>
        </div>
        <select
          className="text-xs border border-gray-300 rounded px-2 py-1"
          value={sampleIndex}
          onChange={(e) => setSampleIndex(Number(e.target.value))}
        >
          {SAMPLE_LEADS.map((lead, i) => (
            <option key={i} value={i}>{lead.name} - {lead.company}</option>
          ))}
        </select>
      </div>

      <div className="flex-1 overflow-auto p-4 bg-gray-100 flex justify-center">
        <div
          className={`bg-white rounded-lg shadow-sm border border-gray-200 p-6 h-fit transition-all duration-300 ${
            device === 'mobile' ? 'w-[375px]' : 'w-full'
          }`}
          data-testid="preview-container"
        >
          {subject && (
            <div className="mb-4 pb-3 border-b border-gray-200">
              <p className="text-xs text-gray-500 mb-1">Subject</p>
              <p className="text-sm font-medium text-gray-900">{renderContent(subject)}</p>
            </div>
          )}
          <div className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
            {renderContent(content)}
          </div>
        </div>
      </div>
    </div>
  );
}
