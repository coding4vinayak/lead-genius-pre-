import { useCallback, useRef, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import SequenceCanvas from './SequenceCanvas';
import SequenceNode from './SequenceNode';
import SequenceEdge from './SequenceEdge';
import AddStepButton from './AddStepButton';
import StepConfigPanel from './StepConfigPanel';
import type { SequenceStep, StepType } from '../../hooks/useSequenceBuilder';
import { useSequenceBuilder } from '../../hooks/useSequenceBuilder';

interface SequenceBuilderProps {
  initialSteps?: SequenceStep[];
  onSave?: (steps: SequenceStep[]) => void;
  onChange?: (steps: SequenceStep[]) => void;
}

const NODE_HEIGHT = 80;
const NODE_GAP = 60;

export default function SequenceBuilder({ initialSteps = [], onSave, onChange }: SequenceBuilderProps) {
  const { nodes, edges, selectedNodeId, setSelectedNodeId, addStep, removeStep, updateStep, reorderSteps } =
    useSequenceBuilder(initialSteps);

  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const dragStartY = useRef(0);

  // Report node changes to parent
  const prevNodesRef = useRef(nodes);
  if (prevNodesRef.current !== nodes) {
    prevNodesRef.current = nodes;
    onChange?.(nodes);
  }

  const selectedNode = nodes.find((n) => n.id === selectedNodeId) || null;

  const handleNodeClick = useCallback((id: string) => {
    setSelectedNodeId(id);
  }, [setSelectedNodeId]);

  const handleDragStart = useCallback((index: number, e: React.PointerEvent) => {
    e.stopPropagation();
    setDragIndex(index);
    dragStartY.current = e.clientY;
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (dragIndex === null) return;
    const dy = e.clientY - dragStartY.current;
    const stepsToMove = Math.round(dy / (NODE_HEIGHT + NODE_GAP));
    if (stepsToMove !== 0) {
      const newIndex = Math.min(Math.max(0, dragIndex + stepsToMove), nodes.length - 1);
      if (newIndex !== dragIndex) {
        reorderSteps(dragIndex, newIndex);
        setDragIndex(newIndex);
        dragStartY.current = e.clientY;
      }
    }
  }, [dragIndex, nodes.length, reorderSteps]);

  const handlePointerUp = useCallback(() => {
    setDragIndex(null);
  }, []);

  const handleAddStep = useCallback((afterIndex: number, type: StepType) => {
    addStep(afterIndex, type);
  }, [addStep]);

  const totalHeight = nodes.length * (NODE_HEIGHT + NODE_GAP) + 100;

  return (
    <div
      className="flex flex-1 h-full"
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      data-testid="sequence-builder"
    >
      <SequenceCanvas>
        {/* SVG for edges */}
        <svg
          width={320}
          height={totalHeight}
          className="absolute left-0 top-0 pointer-events-none"
          style={{ overflow: 'visible' }}
        >
          <defs>
            <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
              <polygon points="0 0, 8 3, 0 6" fill="#9ca3af" />
            </marker>
          </defs>
          {edges.map((edge) => {
            const fromIdx = nodes.findIndex((n) => n.id === edge.from);
            const toIdx = nodes.findIndex((n) => n.id === edge.to);
            if (fromIdx === -1 || toIdx === -1) return null;
            const fromY = fromIdx * (NODE_HEIGHT + NODE_GAP) + NODE_HEIGHT;
            const toY = toIdx * (NODE_HEIGHT + NODE_GAP);
            const isConditionBranch = !!edge.label;
            return (
              <SequenceEdge
                key={edge.id}
                fromY={fromY}
                toY={toY}
                label={edge.label}
                isBranch={isConditionBranch}
                branchDirection={edge.label === 'No' ? 'right' : 'left'}
              />
            );
          })}
        </svg>

        {/* Nodes */}
        <div className="relative flex flex-col items-center" style={{ minHeight: totalHeight }}>
          {/* Add step at the top if no nodes */}
          {nodes.length === 0 && (
            <AddStepButton afterIndex={-1} onAdd={handleAddStep} />
          )}

          <AnimatePresence>
            {nodes.map((step, index) => (
              <div key={step.id} className="flex flex-col items-center">
                <SequenceNode
                  step={step}
                  isSelected={selectedNodeId === step.id}
                  onClick={() => handleNodeClick(step.id)}
                  onDragStart={(e) => handleDragStart(index, e)}
                />
                <AddStepButton afterIndex={index} onAdd={handleAddStep} />
              </div>
            ))}
          </AnimatePresence>
        </div>
      </SequenceCanvas>

      {/* Config Panel */}
      {selectedNode && (
        <StepConfigPanel
          step={selectedNode}
          onUpdate={updateStep}
          onDelete={(id) => { removeStep(id); setSelectedNodeId(null); }}
          onClose={() => setSelectedNodeId(null)}
        />
      )}
    </div>
  );
}
