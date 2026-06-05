import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Key, Copy, Power, PowerOff } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../lib/api';
import { Card, Button, Input, Badge, Spinner, EmptyState, ErrorBanner, PageHeader, Modal } from '../components/ui';

export default function ApiKeys() {
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['api-keys'],
    queryFn: () => api.get('/api-keys').then((r) => r.data.data),
  });

  const createKey = useMutation({
    mutationFn: (body: any) => api.post('/api-keys', body),
    onSuccess: (res) => {
      setNewKey(res.data.data.key);
      qc.invalidateQueries({ queryKey: ['api-keys'] });
      setShowModal(false);
    },
  });

  const deleteKey = useMutation({
    mutationFn: (id: string) => api.delete(`/api-keys/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['api-keys'] }); toast.success('API key deleted'); },
  });

  const toggleKey = useMutation({
    mutationFn: (id: string) => api.post(`/api-keys/${id}/toggle`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['api-keys'] }); toast.success('Status toggled'); },
  });

  if (error) return <ErrorBanner message={error.message} onRetry={() => refetch()} />;

  return (
    <div>
      <PageHeader title="API Keys" description="Manage API keys for programmatic access" action={<Button onClick={() => setShowModal(true)}><Plus size={16} /><span className="ml-1">Create Key</span></Button>} />

      {newKey && (
        <Card className="mb-4 p-4 border-2 border-[var(--color-success)]/30 bg-[var(--color-success-bg)]">
          <p className="text-sm font-medium text-[var(--color-success)] mb-2">API key created! Copy it now — you won't see it again.</p>
          <div className="flex gap-2">
            <code className="flex-1 p-2 bg-[var(--color-surface)] border border-[var(--color-success)]/30 rounded text-sm font-mono text-[var(--color-text)] break-all">{newKey}</code>
            <Button size="sm" onClick={() => { navigator.clipboard.writeText(newKey!); toast.success('Copied!'); }}><Copy size={14} /></Button>
          </div>
        </Card>
      )}

      {isLoading ? <Spinner /> : !data?.length ? <EmptyState title="No API keys" description="Create your first API key to integrate with external systems" /> : (
        <Card>
          <div className="divide-y divide-[var(--color-border-light)]">
            {data.map((key: any) => (
              <div key={key.id} className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <Key size={18} className="text-[var(--color-text-tertiary)]" />
                  <div>
                    <p className="font-medium text-sm text-[var(--color-text)]">{key.name}</p>
                    <p className="text-xs text-[var(--color-text-tertiary)]">{key.keyPrefix}****</p>
                    <div className="flex gap-2 mt-1">
                      <Badge variant={key.active ? 'success' : 'warning'}>{key.active ? 'Active' : 'Inactive'}</Badge>
                      {key.expiresAt && <span className="text-xs text-[var(--color-text-tertiary)]">Expires {new Date(key.expiresAt).toLocaleDateString()}</span>}
                      {key.lastUsedAt && <span className="text-xs text-[var(--color-text-tertiary)]">Last used {new Date(key.lastUsedAt).toLocaleDateString()}</span>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={() => toggleKey.mutate(key.id)}>
                    {key.active ? <PowerOff size={14} /> : <Power size={14} />}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => { if (confirm('Delete this API key?')) deleteKey.mutate(key.id); }}>
                    <Trash2 size={14} className="text-[var(--color-error)]" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Create API Key">
        <form onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); createKey.mutate(Object.fromEntries(fd)); }} className="space-y-4">
          <Input label="Key Name" name="name" placeholder="e.g. Production Integration" required />
          <Input label="Expires in (days)" name="expiresInDays" type="number" placeholder="Leave empty for no expiry" />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button type="submit" disabled={createKey.isPending}>{createKey.isPending ? 'Creating...' : 'Create'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
