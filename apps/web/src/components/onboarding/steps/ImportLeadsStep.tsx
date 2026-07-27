import { useState } from 'react';
import { Upload, Plus, Users } from 'lucide-react';
import { Button, Input } from '../../ui';
import { useOnboardingStore } from '../../../store/onboarding';

interface Lead {
  name: string;
  email: string;
  company: string;
}

export default function ImportLeadsStep() {
  const completeStep = useOnboardingStore((s) => s.completeStep);
  const [mode, setMode] = useState<'csv' | 'manual' | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [csvFile, setCsvFile] = useState<string | null>(null);

  const addLead = () => {
    if (name && email) {
      setLeads([...leads, { name, email, company }]);
      setName('');
      setEmail('');
      setCompany('');
      completeStep('leads');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCsvFile(file.name);
      completeStep('leads');
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) {
      setCsvFile(file.name);
      completeStep('leads');
    }
  };

  return (
    <div className="max-w-md mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-[var(--color-primary-50)] rounded-lg flex items-center justify-center">
          <Users className="text-[var(--color-primary)]" size={20} />
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-900">Import Leads</h2>
          <p className="text-sm text-gray-500">Add contacts to reach out to</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-6">
        <button
          onClick={() => setMode('csv')}
          className={`p-4 rounded-lg border-2 text-left transition-all ${
            mode === 'csv' ? 'border-[var(--color-primary)] bg-[var(--color-primary-50)]' : 'border-gray-200 hover:border-gray-300'
          }`}
        >
          <Upload size={20} className="text-gray-600 mb-2" />
          <p className="font-medium text-gray-900">Upload CSV</p>
          <p className="text-xs text-gray-500 mt-1">Bulk import</p>
        </button>
        <button
          onClick={() => setMode('manual')}
          className={`p-4 rounded-lg border-2 text-left transition-all ${
            mode === 'manual' ? 'border-[var(--color-primary)] bg-[var(--color-primary-50)]' : 'border-gray-200 hover:border-gray-300'
          }`}
        >
          <Plus size={20} className="text-gray-600 mb-2" />
          <p className="font-medium text-gray-900">Manual Entry</p>
          <p className="text-xs text-gray-500 mt-1">Add one by one</p>
        </button>
      </div>

      {mode === 'csv' && (
        <div
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-[var(--color-primary)] transition-colors"
        >
          {csvFile ? (
            <p className="text-sm text-green-600 font-medium">{csvFile} uploaded</p>
          ) : (
            <>
              <Upload size={32} className="text-gray-400 mx-auto mb-3" />
              <p className="text-sm text-gray-600 mb-2">Drag & drop a CSV file here</p>
              <label className="cursor-pointer text-sm text-[var(--color-primary)] font-medium hover:underline">
                or browse files
                <input type="file" accept=".csv" className="hidden" onChange={handleFileChange} />
              </label>
            </>
          )}
        </div>
      )}

      {mode === 'manual' && (
        <div className="space-y-3">
          <Input label="Name" placeholder="John Doe" value={name} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)} />
          <Input label="Email" placeholder="john@example.com" value={email} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)} />
          <Input label="Company" placeholder="Acme Corp" value={company} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCompany(e.target.value)} />
          <Button onClick={addLead} className="w-full">
            <Plus size={16} className="mr-1" /> Add Lead
          </Button>
        </div>
      )}

      {leads.length > 0 && (
        <div className="mt-4 p-3 bg-gray-50 rounded-lg">
          <p className="text-sm font-medium text-gray-700">{leads.length} lead{leads.length !== 1 ? 's' : ''} added</p>
        </div>
      )}
    </div>
  );
}
