import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Save } from 'lucide-react';
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

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['sequence', id],
    queryFn: () => api.get(`/sequences/${id}`).then((r) => r.data),
    enabled: !!id,
  });

  if (isLoading) return <Spinner />;
  if (error) return <ErrorBanner message={(error as Error).message} onRetry={() => refetch()} />;

  const sequence = data?.data || data;
  const steps: SequenceStep[] = sequence?.steps ? mapApiStepsToNodes(sequence.steps) : [];

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-white">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/sequences')}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-lg font-semibold text-gray-900">{sequence?.name || 'Sequence Builder'}</h1>
            {sequence?.description && <p className="text-xs text-gray-500">{sequence.description}</p>}
          </div>
          {sequence?.status && (
            <Badge variant={STATUS_VARIANTS[sequence.status] || 'default'}>{sequence.status}</Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="primary" size="sm">
            <Save size={14} className="mr-1" />
            Save
          </Button>
        </div>
      </div>

      {/* Builder Canvas */}
      <div className="flex-1 p-4">
        <SequenceBuilder initialSteps={steps} />
      </div>
    </div>
  );
}
