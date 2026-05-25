import { useState } from 'react';
import { Mail, CheckCircle, XCircle } from 'lucide-react';
import { Button, Input } from '../../ui';
import { useOnboardingStore } from '../../../store/onboarding';

export default function ConnectEmailStep() {
  const completeStep = useOnboardingStore((s) => s.completeStep);
  const [provider, setProvider] = useState<'smtp' | 'sendgrid' | null>(null);
  const [smtpHost, setSmtpHost] = useState('');
  const [smtpPort, setSmtpPort] = useState('587');
  const [smtpUser, setSmtpUser] = useState('');
  const [smtpPass, setSmtpPass] = useState('');
  const [sendgridKey, setSendgridKey] = useState('');
  const [testStatus, setTestStatus] = useState<'idle' | 'success' | 'failure'>('idle');

  const handleTest = () => {
    // Simulate test email
    setTestStatus('success');
    completeStep('email');
  };

  return (
    <div className="max-w-md mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-[var(--color-primary-50)] rounded-lg flex items-center justify-center">
          <Mail className="text-[var(--color-primary)]" size={20} />
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-900">Connect Email</h2>
          <p className="text-sm text-gray-500">Choose your email provider</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-6">
        <button
          onClick={() => setProvider('smtp')}
          className={`p-4 rounded-lg border-2 text-left transition-all ${
            provider === 'smtp' ? 'border-[var(--color-primary)] bg-[var(--color-primary-50)]' : 'border-gray-200 hover:border-gray-300'
          }`}
        >
          <p className="font-medium text-gray-900">SMTP</p>
          <p className="text-xs text-gray-500 mt-1">Custom mail server</p>
        </button>
        <button
          onClick={() => setProvider('sendgrid')}
          className={`p-4 rounded-lg border-2 text-left transition-all ${
            provider === 'sendgrid' ? 'border-[var(--color-primary)] bg-[var(--color-primary-50)]' : 'border-gray-200 hover:border-gray-300'
          }`}
        >
          <p className="font-medium text-gray-900">SendGrid</p>
          <p className="text-xs text-gray-500 mt-1">API integration</p>
        </button>
      </div>

      {provider === 'smtp' && (
        <div className="space-y-3">
          <Input label="SMTP Host" placeholder="smtp.example.com" value={smtpHost} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSmtpHost(e.target.value)} />
          <Input label="Port" placeholder="587" value={smtpPort} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSmtpPort(e.target.value)} />
          <Input label="Username" placeholder="user@example.com" value={smtpUser} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSmtpUser(e.target.value)} />
          <Input label="Password" type="password" placeholder="********" value={smtpPass} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSmtpPass(e.target.value)} />
        </div>
      )}

      {provider === 'sendgrid' && (
        <div className="space-y-3">
          <Input label="SendGrid API Key" placeholder="SG.xxxxx..." value={sendgridKey} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSendgridKey(e.target.value)} />
        </div>
      )}

      {provider && (
        <div className="mt-4 space-y-3">
          <Button onClick={handleTest} className="w-full">Send Test Email</Button>
          {testStatus === 'success' && (
            <div className="flex items-center gap-2 text-green-600 text-sm">
              <CheckCircle size={16} /> Test email sent successfully
            </div>
          )}
          {testStatus === 'failure' && (
            <div className="flex items-center gap-2 text-red-600 text-sm">
              <XCircle size={16} /> Failed to send test email
            </div>
          )}
        </div>
      )}
    </div>
  );
}
