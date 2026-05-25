import { useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Save } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../lib/api';
import { Button, Badge, Spinner, ErrorBanner } from '../components/ui';
import SequenceBuilder from '../components/sequences/SequenceBuilder';
import type { SequenceStep, StepType, StepStatus } from '../hooks/useSequenceBuilder';

function mapApiStepsToNodes(steps: Record<string, unknown>[]): SequenceStep[] {
  return steps.map((step, index) => ({
    id: (step.id as string) || `step_${index}`,
    type: (step.type as StepType) || 'send_email',
    title: (step.title as string) || (step.type as string) || 'Step',
    config: (step.config as Record<string, unknown>) || {},
    status: (step.status as StepStatus) || 'pending',
    stats: {
      sent: (step.sent as number) || 0,
      openRate: (step.openRate as number) || 0,
    },
    order: index,
  }));
}

const STATUS_VARIANTS: Record<string, string> = {
  draft: 'default',
  active: 'success',
  paused: 'warning',
  completed: 'info',
};

export default function SequenceBuilderPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const builderNodesRef = useRef<SequenceStep[]>([]);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['sequence', id],
    queryFn: () => api.get(`/sequences/${id}`).then((r) => r.data),
    enabled: !!id,
  });

  const saveMutation = useMutation({
    mutationFn: (steps: SequenceStep[]) =>
      api.put(`/sequences/${id}`, {
        steps: steps.map((s) => ({
          id: s.id,
          type: s.type,
          title: s.title,
          config: s.config,
          order: s.order,
        })),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sequence', id] });
      queryClient.invalidateQueries({ queryKey: ['sequences'] });
      toast.success('Sequence saved');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to save sequence');
    },
  });

  const handleSave = () => {
    saveMutation.mutate(builderNodesRef.current);
  };

  const handleBuilderChange = (steps: SequenceStep[]) => {
    builderNodesRef.current = steps;
  };

  if (isLoading) return <Spinner />;
  if (error) return <ErrorBanner message={(error as Error).message} onRetry={() => refetch()} />;

  const sequence = data?.data || data;
  const steps: SequenceStep[] = sequence?.steps ? mapApiStepsToNodes(sequence.steps) : [];

  // Initialize ref with fetched steps so Save works even before any edits
  if (builderNodesRef.current.length === 0 && steps.length > 0) {
    builderNodesRef.current = steps;
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/sequences')}
            className="p-2 hover:bg-[var(--color-surface-secondary)] rounded-lg transition-colors"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-lg font-semibold text-[var(--color-text)]">{sequence?.name || 'Sequence Builder'}</h1>
            {sequence?.description && <p className="text-xs text-[var(--color-text-secondary)]">{sequence.description}</p>}
          </div>
          {sequence?.status && (
            <Badge variant={STATUS_VARIANTS[sequence.status] || 'default'}>{sequence.status}</Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="primary" size="sm" onClick={handleSave} disabled={saveMutation.isPending}>
            <Save size={14} className="mr-1" />
            {saveMutation.isPending ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </div>

      {/* Builder Canvas */}
      <div className="flex-1 p-4">
        <SequenceBuilder initialSteps={steps} onSave={handleSave} onChange={handleBuilderChange} />
      </div>
    </div>
  );
}
