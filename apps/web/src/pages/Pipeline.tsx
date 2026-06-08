import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Users, Building2, Target, Zap, ChevronDown, Phone, Mail, Linkedin } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../lib/api';
import { Card, Badge, Spinner, ErrorBanner, PageHeader } from '../components/ui';
import { LEAD_STAGE } from '@leadgenius/shared';

interface Lead {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  company: string | null;
  title: string | null;
  source: string | null;
  stage: string;
  score: number | null;
  tags: string[];
  status: string;
  linkedinUrl: string | null;
  warmupActive: boolean;
  createdAt: string;
}

const STAGE_LABELS: Record<string, string> = {
  new: 'New',
  contacted: 'Contacted',
  qualified: 'Qualified',
  demo: 'Demo',
  proposal: 'Proposal',
  negotiation: 'Negotiation',
  closed_won: 'Closed Won',
  closed_lost: 'Closed Lost',
};

const STAGE_COLORS: Record<string, string> = {
  new: 'border-l-[var(--color-text-tertiary)]',
  contacted: 'border-l-[var(--color-info)]',
  qualified: 'border-l-[var(--color-primary)]',
  demo: 'border-l-purple-500',
  proposal: 'border-l-amber-500',
  negotiation: 'border-l-orange-500',
  closed_won: 'border-l-[var(--color-success)]',
  closed_lost: 'border-l-[var(--color-error)]',
};

const STAGE_HEADER_COLORS: Record<string, string> = {
  new: 'bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)]',
  contacted: 'bg-[var(--color-info-bg)] text-[var(--color-info)]',
  qualified: 'bg-[var(--color-primary)]/10 text-[var(--color-primary)]',
  demo: 'bg-purple-100 text-purple-700',
  proposal: 'bg-amber-100 text-amber-700',
  negotiation: 'bg-orange-100 text-orange-700',
  closed_won: 'bg-[var(--color-success-bg)] text-[var(--color-success)]',
  closed_lost: 'bg-[var(--color-error-bg)] text-[var(--color-error)]',
};

function LeadCard({ lead, onMove }: { lead: Lead; onMove: (id: string, direction: 'forward' | 'backward') => void }) {
  const currentIdx = LEAD_STAGE.indexOf(lead.stage as any);
  const canForward = currentIdx < LEAD_STAGE.length - 1;
  const canBackward = currentIdx > 0;

  return (
    <div
      className={`bg-[var(--color-surface)] border border-[var(--color-border-light)] rounded-lg p-3 cursor-pointer hover:shadow-md hover:border-[var(--color-primary)]/30 transition-all border-l-4 ${STAGE_COLORS[lead.stage] || 'border-l-[var(--color-border)]'}`}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', JSON.stringify({ leadId: lead.id, fromStage: lead.stage }));
      }}
    >
      <div className="flex items-start justify-between mb-1">
        <p className="font-medium text-sm text-[var(--color-text)] truncate">{lead.name || lead.email || 'Unnamed'}</p>
        {lead.score != null && (
          <Badge variant={lead.score >= 70 ? 'success' : lead.score >= 40 ? 'warning' : 'default'}>{lead.score}</Badge>
        )}
      </div>
      {lead.company && (
        <p className="text-xs text-[var(--color-text-secondary)] flex items-center gap-1 truncate">
          <Building2 size={10} /> {lead.company}
        </p>
      )}
      {lead.title && (
        <p className="text-xs text-[var(--color-text-tertiary)] truncate">{lead.title}</p>
      )}
      {lead.tags.length > 0 && (
        <div className="flex gap-1 flex-wrap mt-1.5">
          {lead.tags.slice(0, 3).map((t) => (
            <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-surface-secondary)] text-[var(--color-text-tertiary)]">{t}</span>
          ))}
        </div>
      )}
      <div className="flex items-center justify-between mt-2 pt-2 border-t border-[var(--color-border-light)]">
        {lead.source && <Badge variant="info">{lead.source}</Badge>}
        <div className="flex gap-1">
          {canBackward && (
            <button
              className="p-1 rounded hover:bg-[var(--color-surface-secondary)] text-[var(--color-text-tertiary)] hover:text-[var(--color-text)] transition-colors"
              onClick={(e) => { e.stopPropagation(); onMove(lead.id, 'backward'); }}
              title="Move to previous stage"
            >
              <ChevronLeft size={14} />
            </button>
          )}
          {canForward && (
            <button
              className="p-1 rounded hover:bg-[var(--color-surface-secondary)] text-[var(--color-text-tertiary)] hover:text-[var(--color-text)] transition-colors"
              onClick={(e) => { e.stopPropagation(); onMove(lead.id, 'forward'); }}
              title="Move to next stage"
            >
              <ChevronRight size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Pipeline() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState('');

  const stageQueries = LEAD_STAGE.map((stage) => ({
    queryKey: ['leads', 'stage', stage],
    queryFn: () => api.get('/leads', { params: { stage, pageSize: 200 } }).then((r) => r.data.data || []),
  }));

  const allQueries = useQuery({
    queryKey: ['leads', 'pipeline', filter],
    queryFn: async () => {
      const results: Record<string, Lead[]> = {};
      for (const stage of LEAD_STAGE) {
        const res = await api.get('/leads', { params: { stage, pageSize: 200, search: filter || undefined } });
        results[stage] = res.data.data || [];
      }
      return results;
    },
    refetchInterval: 15000,
  });

  const moveLead = useMutation({
    mutationFn: ({ id, stage }: { id: string; stage: string }) => api.put(`/leads/${id}/stage`, { stage }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads', 'pipeline'] });
      toast.success('Stage updated');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const handleMove = (id: string, direction: 'forward' | 'backward') => {
    const data = allQueries.data;
    if (!data) return;

    for (const [stage, leads] of Object.entries(data)) {
      if (leads.some((l) => l.id === id)) {
        const idx = LEAD_STAGE.indexOf(stage as any);
        const newIdx = direction === 'forward' ? idx + 1 : idx - 1;
        if (newIdx >= 0 && newIdx < LEAD_STAGE.length) {
          moveLead.mutate({ id, stage: LEAD_STAGE[newIdx] });
        }
        break;
      }
    }
  };

  const handleDrop = (e: React.DragEvent, targetStage: string) => {
    e.preventDefault();
    try {
      const data = JSON.parse(e.dataTransfer.getData('text/plain'));
      if (data.fromStage !== targetStage) {
        moveLead.mutate({ id: data.leadId, stage: targetStage });
      }
    } catch { }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  if (allQueries.error) return <ErrorBanner message={(allQueries.error as any).message} onRetry={() => allQueries.refetch()} />;

  const leadsByStage = allQueries.data || {};

  return (
    <div>
      <PageHeader
        title="Pipeline"
        description="Visual sales pipeline — drag leads between stages"
        action={
          <div className="relative">
            <input
              className="w-48 pl-8 pr-3 py-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-tertiary)]"
              placeholder="Filter leads..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
            <Users size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-text-tertiary)]" />
          </div>
        }
      />

      {allQueries.isLoading ? <Spinner /> : (
        <div className="flex gap-3 overflow-x-auto pb-4 min-h-[70vh]" style={{ scrollbarWidth: 'thin' }}>
          {LEAD_STAGE.map((stage) => {
            const leads = leadsByStage[stage] || [];
            return (
              <div
                key={stage}
                className="flex-shrink-0 w-64 bg-[var(--color-surface-secondary)]/50 rounded-xl border border-[var(--color-border-light)] flex flex-col"
                onDrop={(e) => handleDrop(e, stage)}
                onDragOver={handleDragOver}
              >
                <div className={`p-3 rounded-t-xl font-semibold text-sm flex items-center justify-between ${STAGE_HEADER_COLORS[stage]}`}>
                  <span>{STAGE_LABELS[stage] || stage}</span>
                  <span className="text-xs opacity-75 bg-white/20 dark:bg-black/20 px-2 py-0.5 rounded-full">{leads.length}</span>
                </div>
                <div className="flex-1 p-2 space-y-2 overflow-y-auto min-h-[200px]" style={{ maxHeight: 'calc(100vh - 220px)' }}>
                  {leads.length === 0 ? (
                    <p className="text-xs text-[var(--color-text-tertiary)] text-center pt-8">No leads</p>
                  ) : (
                    leads.map((lead) => (
                      <LeadCard key={lead.id} lead={lead} onMove={handleMove} />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
