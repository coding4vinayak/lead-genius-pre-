import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Play, Pause, Square } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../lib/api';
import { Card, Button, Input, Select, Modal, Spinner, EmptyState, ErrorBanner, PageHeader, Badge } from '../components/ui';

const STATUS_COLORS: Record<string, string> = { draft: 'default', scheduled: 'info', running: 'success', paused: 'warning', completed: 'default' };

export default function Campaigns() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<any>({});

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['campaigns', filter],
    queryFn: () => api.get('/campaigns', { params: { status: filter || undefined, pageSize: 100 } }).then((r) => r.data),
    refetchInterval: 10000,
  });

  const { data: groups } = useQuery({ queryKey: ['groups'], queryFn: () => api.get('/groups').then((r) => r.data.data) });
  const { data: templates } = useQuery({ queryKey: ['templates'], queryFn: () => api.get('/templates').then((r) => r.data.data) });

  const saveCampaign = useMutation({
    mutationFn: (body: any) => api.post('/campaigns', body),
    onSuccess: (r) => { api.post(`/campaigns/${r.data.data.id}/activate`); queryClient.invalidateQueries({ queryKey: ['campaigns'] }); toast.success('Campaign created & activated'); setShowModal(false); setStep(1); },
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, action }: { id: string; action: string }) => api.post(`/campaigns/${id}/${action}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['campaigns'] }); toast.success('Status updated'); },
  });

  if (error) return <ErrorBanner message={error.message} onRetry={() => refetch()} />;

  const campaigns = data?.data || [];

  return (
    <div>
      <PageHeader title="Campaigns" description="Create and manage message campaigns" action={<Button onClick={() => { setForm({}); setStep(1); setShowModal(true); }}><Plus size={16} /><span className="ml-1">New Campaign</span></Button>} />

      <div className="flex gap-2 mb-4">
        {['', 'draft', 'scheduled', 'running', 'paused', 'completed'].map((s) => (
          <Button key={s} variant={filter === s ? 'primary' : 'secondary'} size="sm" onClick={() => setFilter(s)}>{s || 'All'}</Button>
        ))}
      </div>

      {isLoading ? <Spinner /> : campaigns.length === 0 ? <EmptyState title="No campaigns" description="Create your first campaign" action={<Button onClick={() => setShowModal(true)}>Create Campaign</Button>} /> : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {campaigns.map((c: any) => (
            <Card key={c.id} className="p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold">{c.name}</h3>
                <Badge variant={STATUS_COLORS[c.status] || 'default'}>{c.status}</Badge>
              </div>
              <p className="text-xs text-gray-400 mb-3">{c.template?.name} · {c.channel}</p>
              <div className="grid grid-cols-3 gap-2 mb-3 text-center text-xs">
                <div><p className="font-semibold text-gray-900">{c.sentCount}</p><p className="text-gray-500">Sent</p></div>
                <div><p className="font-semibold text-green-600">{c.replyCount}</p><p className="text-gray-500">Replies</p></div>
                <div><p className="font-semibold text-red-500">{c.failedCount}</p><p className="text-gray-500">Failed</p></div>
              </div>
              <div className="flex gap-2">
                {c.status === 'running' && <Button variant="secondary" size="sm" onClick={() => updateStatus.mutate({ id: c.id, action: 'pause' })}><Pause size={14} className="mr-1" />Pause</Button>}
                {c.status === 'paused' && <Button variant="secondary" size="sm" onClick={() => updateStatus.mutate({ id: c.id, action: 'resume' })}><Play size={14} className="mr-1" />Resume</Button>}
                {(c.status === 'running' || c.status === 'paused') && <Button variant="secondary" size="sm" onClick={() => updateStatus.mutate({ id: c.id, action: 'stop' })}><Square size={14} className="mr-1" />Stop</Button>}
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal isOpen={showModal} onClose={() => { setShowModal(false); setStep(1); }} title={`New Campaign (Step ${step}/4)`}>
        {step === 1 && (
          <div className="space-y-4">
            <Input label="Campaign Name" value={form.name || ''} onChange={(e: any) => setForm({ ...form, name: e.target.value })} required />
            <Input label="Description" value={form.description || ''} onChange={(e: any) => setForm({ ...form, description: e.target.value })} />
            <Select label="Channel" options={['email', 'whatsapp']} value={form.channel || 'email'} onChange={(e: any) => setForm({ ...form, channel: e.target.value })} />
            <Button onClick={() => setStep(2)} disabled={!form.name}>Next</Button>
          </div>
        )}
        {step === 2 && (
          <div className="space-y-4">
            <Select label="Template" options={templates?.filter((t: any) => t.channel === form.channel).map((t: any) => ({ value: t.id, label: t.name })) || []} value={form.templateId || ''} onChange={(e: any) => setForm({ ...form, templateId: e.target.value })} />
            <Button onClick={() => setStep(3)} disabled={!form.templateId}>Next</Button>
            <Button variant="secondary" onClick={() => setStep(1)}>Back</Button>
          </div>
        )}
        {step === 3 && (
          <div className="space-y-4">
            <Select label="Lead Group" options={groups?.map((g: any) => ({ value: g.id, label: `${g.name} (${g._count?.members || 0} leads)` })) || []} value={form.leadGroupId || ''} onChange={(e: any) => setForm({ ...form, leadGroupIds: [e.target.value], leadGroupId: e.target.value })} />
            <Select label="Schedule" options={['immediate', 'scheduled', 'recurring']} value={form.scheduleType || 'immediate'} onChange={(e: any) => setForm({ ...form, scheduleType: e.target.value })} />
            {form.scheduleType === 'scheduled' && <Input label="Scheduled Date" type="datetime-local" value={form.scheduledAt || ''} onChange={(e: any) => setForm({ ...form, scheduledAt: e.target.value })} />}
            <Button onClick={() => setStep(4)}>Next</Button>
            <Button variant="secondary" onClick={() => setStep(2)}>Back</Button>
          </div>
        )}
        {step === 4 && (
          <div className="space-y-4">
            <Select label="Send Strategy" options={['sequential', 'batch', 'burst']} value={form.sendStrategy || 'sequential'} onChange={(e: any) => setForm({ ...form, sendStrategy: e.target.value })} />
            <Input label="Daily Limit" type="number" value={form.dailyLimit || ''} onChange={(e: any) => setForm({ ...form, dailyLimit: parseInt(e.target.value) })} />
            <Input label="Min Delay (ms)" type="number" value={form.minDelayMs || 30000} onChange={(e: any) => setForm({ ...form, minDelayMs: parseInt(e.target.value) })} />
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setStep(3)}>Back</Button>
              <Button onClick={() => saveCampaign.mutate(form)} disabled={saveCampaign.isPending}>{saveCampaign.isPending ? 'Creating...' : 'Create & Activate'}</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
