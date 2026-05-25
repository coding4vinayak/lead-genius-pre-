import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Mail, RefreshCw, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../lib/api';
import { Card, Button, Badge, Modal, Input, EmptyState, ErrorBanner, PageHeader, SkeletonCard } from '../components/ui';

export default function EmailAccounts() {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ email: '', smtpHost: '', smtpPort: '587', smtpUser: '', smtpPass: '', imapHost: '', imapPort: '993' });

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['email-accounts'],
    queryFn: () => api.get('/email-accounts').then((r) => r.data.data),
  });

  const createMutation = useMutation({
    mutationFn: (body: Record<string, string>) => api.post('/email-accounts', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-accounts'] });
      toast.success('Email account added');
      setShowModal(false);
      setForm({ email: '', smtpHost: '', smtpPort: '587', smtpUser: '', smtpPass: '', imapHost: '', imapPort: '993' });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/email-accounts/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-accounts'] });
      toast.success('Account removed');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const testMutation = useMutation({
    mutationFn: (id: string) => api.post(`/email-accounts/${id}/test`),
    onSuccess: () => toast.success('Connection test passed'),
    onError: (err: Error) => toast.error(err.message),
  });

  if (error) return <ErrorBanner message={(error as Error).message} onRetry={() => refetch()} />;

  const accounts = (data as Array<Record<string, unknown>>) || [];

  return (
    <div>
      <PageHeader
        title="Email Accounts"
        description="Manage sending accounts, rotation, and connection settings"
        action={
          <Button onClick={() => setShowModal(true)}>
            <Plus size={16} className="mr-1" />
            Add Account
          </Button>
        }
      />

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3].map((i) => <SkeletonCard key={i} />)}
        </div>
      ) : accounts.length === 0 ? (
        <EmptyState
          title="No email accounts"
          description="Add your first email account to start sending"
          action={<Button onClick={() => setShowModal(true)}>Add Account</Button>}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {accounts.map((account) => (
            <Card key={String(account.id)} className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Mail size={16} className="text-gray-500" />
                  <h3 className="font-semibold text-gray-900">{String(account.email)}</h3>
                </div>
                <Badge variant={account.status === 'active' ? 'success' : 'warning'}>
                  {String(account.status || 'inactive')}
                </Badge>
              </div>
              <div className="text-xs text-gray-500 mb-3">
                <p>SMTP: {String(account.smtpHost || 'Not configured')}</p>
                <p>Daily limit: {String(account.dailyLimit || 'Unlimited')}</p>
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" onClick={() => testMutation.mutate(String(account.id))}>
                  <RefreshCw size={14} className="mr-1" />Test
                </Button>
                <Button variant="danger" size="sm" onClick={() => deleteMutation.mutate(String(account.id))}>
                  <Trash2 size={14} className="mr-1" />Remove
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Add Email Account">
        <div className="space-y-4">
          <Input label="Email Address" value={form.email} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, email: e.target.value })} placeholder="you@example.com" />
          <div className="grid grid-cols-2 gap-4">
            <Input label="SMTP Host" value={form.smtpHost} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, smtpHost: e.target.value })} />
            <Input label="SMTP Port" value={form.smtpPort} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, smtpPort: e.target.value })} />
          </div>
          <Input label="SMTP Username" value={form.smtpUser} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, smtpUser: e.target.value })} />
          <Input label="SMTP Password" value={form.smtpPass} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, smtpPass: e.target.value })} type="password" />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button onClick={() => createMutation.mutate(form)} disabled={!form.email || createMutation.isPending}>
              {createMutation.isPending ? 'Adding...' : 'Add Account'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
