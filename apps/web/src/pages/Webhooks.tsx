import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Power, PowerOff, RefreshCw, Copy, Globe, History } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../lib/api';
import { Card, Button, Input, Select, Badge, Spinner, EmptyState, ErrorBanner, PageHeader, Modal } from '../components/ui';

const AVAILABLE_EVENTS = [
  'lead.created', 'lead.updated', 'lead.stage_changed', 'lead.deleted',
  'campaign.started', 'campaign.completed', 'campaign.paused',
  'message.sent', 'message.bounced', 'message.replied',
];

export default function Webhooks() {
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [showDeliveries, setShowDeliveries] = useState<string | null>(null);
  const [newSecret, setNewSecret] = useState<string | null>(null);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['webhook-endpoints'],
    queryFn: () => api.get('/webhook-endpoints').then((r) => r.data.data),
  });

  const { data: deliveries } = useQuery({
    queryKey: ['webhook-deliveries', showDeliveries],
    queryFn: () => api.get(`/webhook-endpoints/${showDeliveries}/deliveries`).then((r) => r.data.data),
    enabled: !!showDeliveries,
  });

  const createEndpoint = useMutation({
    mutationFn: (body: any) => api.post('/webhook-endpoints', body),
    onSuccess: (res) => {
      setNewSecret(res.data.data.secret);
      qc.invalidateQueries({ queryKey: ['webhook-endpoints'] });
      setShowModal(false);
    },
  });

  const deleteEndpoint = useMutation({
    mutationFn: (id: string) => api.delete(`/webhook-endpoints/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['webhook-endpoints'] }); toast.success('Webhook deleted'); },
  });

  const toggleEndpoint = useMutation({
    mutationFn: (id: string) => api.post(`/webhook-endpoints/${id}/toggle`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['webhook-endpoints'] }); toast.success('Status toggled'); },
  });

  const regenerateSecret = useMutation({
    mutationFn: (id: string) => api.post(`/webhook-endpoints/${id}/regenerate-secret`),
    onSuccess: (res) => { setNewSecret(res.data.data.secret); toast.success('Secret regenerated'); },
  });

  if (error) return <ErrorBanner message={error.message} onRetry={() => refetch()} />;

  return (
    <div>
      <PageHeader title="Webhooks" description="Send real-time events to external systems" action={<Button onClick={() => setShowModal(true)}><Plus size={16} /><span className="ml-1">Add Webhook</span></Button>} />

      {newSecret && (
        <Card className="mb-4 p-4 border-2 border-amber-200 bg-amber-50">
          <p className="text-sm font-medium text-amber-800 mb-2">Webhook secret shown once. Use it to verify incoming requests.</p>
          <div className="flex gap-2">
            <code className="flex-1 p-2 bg-white border border-amber-300 rounded text-sm font-mono">{newSecret}</code>
            <Button size="sm" onClick={() => { navigator.clipboard.writeText(newSecret!); toast.success('Copied!'); setNewSecret(null); }}><Copy size={14} /></Button>
          </div>
        </Card>
      )}

      {isLoading ? <Spinner /> : !data?.length ? <EmptyState title="No webhooks configured" description="Add a webhook endpoint to receive events" /> : (
        <div className="space-y-4">
          {data.map((ep: any) => (
            <Card key={ep.id} className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <Globe size={18} className="text-gray-400 mt-0.5" />
                  <div>
                    <p className="font-medium text-sm flex items-center gap-2">
                      {ep.name}
                      <Badge variant={ep.active ? 'success' : 'warning'}>{ep.active ? 'Active' : 'Inactive'}</Badge>
                    </p>
                    <p className="text-xs text-gray-500 font-mono mt-0.5">{ep.url}</p>
                    <div className="flex gap-1 flex-wrap mt-2">
                      {ep.events.map((e: string) => <Badge key={e}>{e}</Badge>)}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setShowDeliveries(showDeliveries === ep.id ? null : ep.id)}>
                    <History size={14} />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => regenerateSecret.mutate(ep.id)}>
                    <RefreshCw size={14} />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => toggleEndpoint.mutate(ep.id)}>
                    {ep.active ? <PowerOff size={14} /> : <Power size={14} />}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => { if (confirm('Delete this webhook?')) deleteEndpoint.mutate(ep.id); }}>
                    <Trash2 size={14} className="text-red-500" />
                  </Button>
                </div>
              </div>

              {showDeliveries === ep.id && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Recent Deliveries</h4>
                  {!deliveries?.length ? <p className="text-xs text-gray-400">No deliveries yet</p> : (
                    <div className="space-y-1 max-h-48 overflow-y-auto">
                      {deliveries.map((d: any) => (
                        <div key={d.id} className="flex items-center justify-between text-xs p-2 bg-gray-50 rounded">
                          <div className="flex items-center gap-2">
                            <Badge variant={d.status === 'delivered' ? 'success' : 'danger'}>{d.status}</Badge>
                            <span className="text-gray-600">{d.event}</span>
                            {d.responseCode && <span className="text-gray-400">HTTP {d.responseCode}</span>}
                          </div>
                          <span className="text-gray-400">{new Date(d.createdAt).toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Add Webhook Endpoint">
        <form onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); const events = fd.getAll('events') as string[]; createEndpoint.mutate({ name: fd.get('name'), url: fd.get('url'), events }); }} className="space-y-4">
          <Input label="Name" name="name" placeholder="e.g. My CRM Integration" required />
          <Input label="URL" name="url" type="url" placeholder="https://example.com/webhook" required />
          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">Events</label>
            <div className="grid grid-cols-2 gap-2">
              {AVAILABLE_EVENTS.map((ev) => (
                <label key={ev} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="events" value={ev} defaultChecked />
                  {ev}
                </label>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button type="submit" disabled={createEndpoint.isPending}>{createEndpoint.isPending ? 'Creating...' : 'Create'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
