import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Play, Pause, GitBranch, Mail, MessageSquare, Clock, Filter, Users, Workflow } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../lib/api';
import { Card, Button, Badge, Modal, Input, Select, EmptyState, ErrorBanner, PageHeader, Skeleton, SkeletonCard, Tabs, ProgressBar } from '../components/ui';

const STATUS_COLORS: Record<string, string> = {
  draft: 'default',
  active: 'success',
  paused: 'warning',
  completed: 'info',
};

const STEP_ICONS: Record<string, React.ReactNode> = {
  send_email: <Mail size={14} />,
  send_whatsapp: <MessageSquare size={14} />,
  delay: <Clock size={14} />,
  condition: <Filter size={14} />,
  update_stage: <Users size={14} />,
  update_score: <GitBranch size={14} />,
};

export default function Sequences() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [showModal, setShowModal] = useState(false);
  const [activeTab, setActiveTab] = useState('all');
  const [form, setForm] = useState<Record<string, string>>({ name: '', description: '', triggerType: 'manual' });

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['sequences', activeTab],
    queryFn: () => api.get('/sequences', { params: { status: activeTab === 'all' ? undefined : activeTab, pageSize: 100 } }).then((r) => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (body: Record<string, string>) => api.post('/sequences', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sequences'] });
      toast.success('Sequence created');
      setShowModal(false);
      setForm({ name: '', description: '', triggerType: 'manual' });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const activateMutation = useMutation({
    mutationFn: (id: string) => api.post(`/sequences/${id}/activate`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sequences'] });
      toast.success('Sequence activated');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const pauseMutation = useMutation({
    mutationFn: (id: string) => api.post(`/sequences/${id}/pause`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sequences'] });
      toast.success('Sequence paused');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (error) return <ErrorBanner message={(error as Error).message} onRetry={() => refetch()} />;

  const sequences = data?.data || [];
  const tabs = [
    { id: 'all', label: 'All' },
    { id: 'active', label: 'Active' },
    { id: 'draft', label: 'Draft' },
    { id: 'paused', label: 'Paused' },
    { id: 'completed', label: 'Completed' },
  ];

  return (
    <div>
      <PageHeader
        title="Sequences"
        description="Automated multi-step outreach sequences"
        action={
          <Button onClick={() => setShowModal(true)}>
            <Plus size={16} className="mr-1" />
            New Sequence
          </Button>
        }
      />

      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <SkeletonCard key={i} />)}
        </div>
      ) : sequences.length === 0 ? (
        <EmptyState
          title="No sequences"
          description="Create your first automated sequence to engage leads"
          action={<Button onClick={() => setShowModal(true)}>Create Sequence</Button>}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sequences.map((seq: Record<string, unknown>) => {
            const steps = (seq.steps as Array<Record<string, unknown>>) || [];
            const enrollmentCount = (seq._count as Record<string, number>)?.enrollments || 0;
            return (
              <Card key={seq.id as string} className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-gray-900 truncate">{seq.name as string}</h3>
                  <Badge variant={STATUS_COLORS[seq.status as string] || 'default'}>{seq.status as string}</Badge>
                </div>
                {seq.description ? (
                  <p className="text-xs text-gray-500 mb-3 line-clamp-2">{String(seq.description)}</p>
                ) : null}
                <div className="grid grid-cols-3 gap-2 text-center text-xs mb-3">
                  <div>
                    <p className="font-semibold text-gray-900">{steps.length}</p>
                    <p className="text-gray-500">Steps</p>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">{enrollmentCount}</p>
                    <p className="text-gray-500">Enrolled</p>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">{seq.triggerType as string || 'manual'}</p>
                    <p className="text-gray-500">Trigger</p>
                  </div>
                </div>
                {steps.length > 0 && (
                  <div className="flex items-center gap-1 mb-3 flex-wrap">
                    {steps.slice(0, 5).map((step, idx) => (
                      <span key={idx} className="inline-flex items-center gap-1 text-xs bg-gray-100 rounded px-1.5 py-0.5">
                        {STEP_ICONS[step.type as string] || <GitBranch size={12} />}
                      </span>
                    ))}
                    {steps.length > 5 && <span className="text-xs text-gray-400">+{steps.length - 5}</span>}
                  </div>
                )}
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => navigate(`/sequences/${seq.id}/builder`)}>
                    <Workflow size={14} className="mr-1" />Builder
                  </Button>
                  {seq.status === 'draft' && (
                    <Button variant="primary" size="sm" onClick={() => activateMutation.mutate(seq.id as string)}>
                      <Play size={14} className="mr-1" />Activate
                    </Button>
                  )}
                  {seq.status === 'active' && (
                    <Button variant="secondary" size="sm" onClick={() => pauseMutation.mutate(seq.id as string)}>
                      <Pause size={14} className="mr-1" />Pause
                    </Button>
                  )}
                  {seq.status === 'paused' && (
                    <Button variant="primary" size="sm" onClick={() => activateMutation.mutate(seq.id as string)}>
                      <Play size={14} className="mr-1" />Resume
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Create Sequence">
        <div className="space-y-4">
          <Input
            label="Sequence Name"
            value={form.name}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, name: e.target.value })}
            placeholder="e.g., Welcome Series"
          />
          <Input
            label="Description"
            value={form.description}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, description: e.target.value })}
            placeholder="Brief description of this sequence"
          />
          <Select
            label="Trigger Type"
            options={[
              { value: 'manual', label: 'Manual Enrollment' },
              { value: 'on_lead_created', label: 'When Lead Created' },
              { value: 'on_tag_added', label: 'When Tag Added' },
            ]}
            value={form.triggerType}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setForm({ ...form, triggerType: e.target.value })}
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button
              onClick={() => createMutation.mutate(form)}
              disabled={!form.name || createMutation.isPending}
            >
              {createMutation.isPending ? 'Creating...' : 'Create Sequence'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
