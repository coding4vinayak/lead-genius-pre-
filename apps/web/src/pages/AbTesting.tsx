import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, FlaskConical, TrendingUp, Trophy } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../lib/api';
import { Card, Button, Badge, Modal, Input, EmptyState, ErrorBanner, PageHeader, Tabs, Skeleton, SkeletonCard, ProgressBar } from '../components/ui';

export default function AbTesting() {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [activeTab, setActiveTab] = useState('all');
  const [form, setForm] = useState({ name: '', variantA: '', variantB: '' });

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['ab-tests', activeTab],
    queryFn: () => api.get('/ab-tests', { params: { status: activeTab === 'all' ? undefined : activeTab } }).then((r) => r.data.data),
  });

  const createMutation = useMutation({
    mutationFn: (body: Record<string, string>) => api.post('/ab-tests', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ab-tests'] });
      toast.success('A/B test created');
      setShowModal(false);
      setForm({ name: '', variantA: '', variantB: '' });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (error) return <ErrorBanner message={(error as Error).message} onRetry={() => refetch()} />;

  const tests = (data as Array<Record<string, unknown>>) || [];
  const tabs = [
    { id: 'all', label: 'All Tests' },
    { id: 'running', label: 'Running' },
    { id: 'completed', label: 'Completed' },
  ];

  return (
    <div>
      <PageHeader
        title="A/B Testing"
        description="Create and manage A/B tests to optimize your outreach"
        action={
          <Button onClick={() => setShowModal(true)}>
            <Plus size={16} className="mr-1" />
            New Test
          </Button>
        }
      />

      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3].map((i) => <SkeletonCard key={i} />)}
        </div>
      ) : tests.length === 0 ? (
        <EmptyState
          title="No A/B tests"
          description="Create your first test to optimize email performance"
          action={<Button onClick={() => setShowModal(true)}>Create Test</Button>}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {tests.map((test) => (
            <Card key={String(test.id)} className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <FlaskConical size={16} className="text-[var(--color-primary)]" />
                  <h3 className="font-semibold text-gray-900">{String(test.name)}</h3>
                </div>
                <Badge variant={test.status === 'running' ? 'success' : test.status === 'completed' ? 'info' : 'default'}>
                  {String(test.status || 'draft')}
                </Badge>
              </div>
              <div className="space-y-3 mb-3">
                <div>
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>Variant A</span>
                    <span>{String(test.variantARate || 0)}%</span>
                  </div>
                  <ProgressBar value={Number(test.variantARate) || 0} />
                </div>
                <div>
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>Variant B</span>
                    <span>{String(test.variantBRate || 0)}%</span>
                  </div>
                  <ProgressBar value={Number(test.variantBRate) || 0} />
                </div>
              </div>
              {test.winner ? (
                <div className="flex items-center gap-1 text-xs text-green-600">
                  <Trophy size={12} /> Winner: Variant {String(test.winner)}
                </div>
              ) : null}
            </Card>
          ))}
        </div>
      )}

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Create A/B Test">
        <div className="space-y-4">
          <Input
            label="Test Name"
            value={form.name}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, name: e.target.value })}
            placeholder="e.g., Subject Line Test"
          />
          <Input
            label="Variant A (Subject/Content)"
            value={form.variantA}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, variantA: e.target.value })}
            placeholder="First variant"
          />
          <Input
            label="Variant B (Subject/Content)"
            value={form.variantB}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, variantB: e.target.value })}
            placeholder="Second variant"
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button onClick={() => createMutation.mutate(form)} disabled={!form.name || createMutation.isPending}>
              {createMutation.isPending ? 'Creating...' : 'Create Test'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
