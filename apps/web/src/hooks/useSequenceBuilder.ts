import { useState, useCallback } from 'react';

export type StepType =
  | 'send_email'
  | 'send_whatsapp'
  | 'send_linkedin'
  | 'delay'
  | 'condition'
  | 'update_lead_stage'
  | 'update_lead_score';

export type StepStatus = 'completed' | 'active' | 'pending' | 'failed';

export interface StepConfig {
  templateId?: string;
  delay?: number;
  delayUnit?: 'minutes' | 'hours' | 'days';
  field?: string;
  operator?: string;
  value?: string;
  yesBranch?: string;
  noBranch?: string;
  stage?: string;
  scoreChange?: number;
  subject?: string;
  message?: string;
}

export interface SequenceStep {
  id: string;
  type: StepType;
  title: string;
  config: StepConfig;
  status: StepStatus;
  stats?: {
    sent?: number;
    openRate?: number;
  };
  order: number;
}

export interface SequenceEdge {
  id: string;
  from: string;
  to: string;
  label?: string;
}

interface UseSequenceBuilderReturn {
  nodes: SequenceStep[];
  edges: SequenceEdge[];
  selectedNodeId: string | null;
  setSelectedNodeId: (id: string | null) => void;
  addStep: (afterIndex: number, type: StepType) => void;
  removeStep: (id: string) => void;
  updateStep: (id: string, config: Partial<SequenceStep>) => void;
  reorderSteps: (fromIndex: number, toIndex: number) => void;
  setNodes: (nodes: SequenceStep[]) => void;
}

const STEP_TITLES: Record<StepType, string> = {
  send_email: 'Send Email',
  send_whatsapp: 'Send WhatsApp',
  send_linkedin: 'Send LinkedIn',
  delay: 'Wait / Delay',
  condition: 'Condition',
  update_lead_stage: 'Update Lead Stage',
  update_lead_score: 'Update Lead Score',
};

function generateId(): string {
  return `step_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function buildEdges(nodes: SequenceStep[]): SequenceEdge[] {
  const edges: SequenceEdge[] = [];
  for (let i = 0; i < nodes.length - 1; i++) {
    const current = nodes[i];
    const next = nodes[i + 1];
    if (current.type === 'condition') {
      edges.push({
        id: `edge_${current.id}_${next.id}_yes`,
        from: current.id,
        to: next.id,
        label: 'Yes',
      });
      if (nodes[i + 2]) {
        edges.push({
          id: `edge_${current.id}_${nodes[i + 2].id}_no`,
          from: current.id,
          to: nodes[i + 2].id,
          label: 'No',
        });
      }
    } else {
      edges.push({
        id: `edge_${current.id}_${next.id}`,
        from: current.id,
        to: next.id,
      });
    }
  }
  return edges;
}

export function useSequenceBuilder(initialNodes: SequenceStep[] = []): UseSequenceBuilderReturn {
  const [nodes, setNodes] = useState<SequenceStep[]>(initialNodes);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const edges = buildEdges(nodes);

  const addStep = useCallback((afterIndex: number, type: StepType) => {
    const newStep: SequenceStep = {
      id: generateId(),
      type,
      title: STEP_TITLES[type],
      config: {},
      status: 'pending',
      stats: { sent: 0, openRate: 0 },
      order: afterIndex + 1,
    };
    setNodes((prev) => {
      const updated = [...prev];
      updated.splice(afterIndex + 1, 0, newStep);
      return updated.map((n, i) => ({ ...n, order: i }));
    });
  }, []);

  const removeStep = useCallback((id: string) => {
    setNodes((prev) => prev.filter((n) => n.id !== id).map((n, i) => ({ ...n, order: i })));
    setSelectedNodeId((current) => (current === id ? null : current));
  }, []);

  const updateStep = useCallback((id: string, updates: Partial<SequenceStep>) => {
    setNodes((prev) => prev.map((n) => (n.id === id ? { ...n, ...updates } : n)));
  }, []);

  const reorderSteps = useCallback((fromIndex: number, toIndex: number) => {
    setNodes((prev) => {
      const updated = [...prev];
      const [moved] = updated.splice(fromIndex, 1);
      updated.splice(toIndex, 0, moved);
      return updated.map((n, i) => ({ ...n, order: i }));
    });
  }, []);

  return {
    nodes,
    edges,
    selectedNodeId,
    setSelectedNodeId,
    addStep,
    removeStep,
    updateStep,
    reorderSteps,
    setNodes,
  };
}
