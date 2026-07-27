import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PanelRightClose, PanelRightOpen, Tag, Users, Activity, StickyNote, Plus } from 'lucide-react';
import api from '../../lib/api';
import { Badge, Button, Avatar } from '../ui';

interface LeadContextSidebarProps {
  leadId: string;
  lead: {
    name: string;
    email?: string;
    company?: string;
    score?: number;
    stage?: string;
    tags?: string[];
    assignedTo?: string;
  };
  collapsed: boolean;
  onToggle: () => void;
}

export default function LeadContextSidebar({ leadId, lead, collapsed, onToggle }: LeadContextSidebarProps) {
  const [noteText, setNoteText] = useState('');
  const [showAddTag, setShowAddTag] = useState(false);
  const [newTag, setNewTag] = useState('');
  const queryClient = useQueryClient();

  const { data: activityData } = useQuery({
    queryKey: ['lead-activity', leadId],
    queryFn: () => api.get(`/leads/${leadId}/activity`).then((r) => r.data),
    enabled: !!leadId && !collapsed,
  });

  const { data: notesData } = useQuery({
    queryKey: ['lead-notes', leadId],
    queryFn: () => api.get(`/leads/${leadId}/notes`).then((r) => r.data),
    enabled: !!leadId && !collapsed,
  });

  const addNoteMutation = useMutation({
    mutationFn: (body: string) => api.post(`/leads/${leadId}/notes`, { body }),
    onSuccess: () => {
      setNoteText('');
      queryClient.invalidateQueries({ queryKey: ['lead-notes', leadId] });
    },
  });

  const activities = activityData?.data?.slice(0, 5) || [];
  const notes = notesData?.data || [];

  if (collapsed) {
    return (
      <div className="flex items-start pt-4" data-testid="sidebar-collapsed">
        <button onClick={onToggle} className="p-2 hover:bg-[var(--color-surface-secondary)] rounded-lg transition-colors" data-testid="sidebar-toggle">
          <PanelRightOpen size={18} className="text-gray-500" />
        </button>
      </div>
    );
  }

  const scoreVariant = (lead.score ?? 0) >= 70 ? 'success' : (lead.score ?? 0) >= 40 ? 'warning' : 'default';

  return (
    <div className="w-[300px] shrink-0 border-l border-[var(--color-border)] overflow-y-auto flex flex-col" data-testid="lead-context-sidebar">
      <div className="flex items-center justify-between p-3 border-b border-[var(--color-border)]">
        <span className="text-sm font-medium text-[var(--color-text-secondary)]">Lead Info</span>
        <button onClick={onToggle} className="p-1 hover:bg-[var(--color-surface-secondary)] rounded transition-colors" data-testid="sidebar-toggle">
          <PanelRightClose size={16} className="text-gray-500" />
        </button>
      </div>

      <div className="p-4 space-y-4 flex-1">
        {/* Lead Header */}
        <div className="flex items-center gap-3">
          <Avatar name={lead.name} size="lg" />
          <div className="min-w-0">
            <p className="font-semibold text-sm truncate">{lead.name}</p>
            {lead.company && <p className="text-xs text-gray-500 truncate">{lead.company}</p>}
            {lead.email && <p className="text-xs text-gray-400 truncate">{lead.email}</p>}
          </div>
        </div>

        {/* Score and Stage */}
        <div className="flex items-center gap-2 flex-wrap">
          {lead.score !== undefined && (
            <Badge variant={scoreVariant}>Score: {lead.score}</Badge>
          )}
          {lead.stage && <Badge variant="info">{lead.stage}</Badge>}
        </div>

        {/* Tags */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Tag size={12} className="text-gray-400" />
            <span className="text-xs font-medium text-gray-600">Tags</span>
            <button
              onClick={() => setShowAddTag(!showAddTag)}
              className="ml-auto text-xs text-blue-500 hover:text-blue-700"
              data-testid="add-tag-btn"
            >
              <Plus size={12} />
            </button>
          </div>
          <div className="flex flex-wrap gap-1">
            {(lead.tags || []).map((tag) => (
              <Badge key={tag} variant="default">{tag}</Badge>
            ))}
          </div>
          {showAddTag && (
            <div className="flex gap-1 mt-2">
              <input
                type="text"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                placeholder="New tag..."
                className="flex-1 text-xs px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
              />
              <Button size="sm" variant="ghost" onClick={() => { setShowAddTag(false); setNewTag(''); }}>
                Add
              </Button>
            </div>
          )}
        </div>

        {/* Recent Activity */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Activity size={12} className="text-gray-400" />
            <span className="text-xs font-medium text-gray-600">Recent Activity</span>
          </div>
          <div className="space-y-2">
            {activities.length === 0 ? (
              <p className="text-xs text-gray-400">No recent activity</p>
            ) : (
              activities.map((act: { id: string; type: string; description?: string; createdAt: string }, idx: number) => (
                <div key={act.id || idx} className="text-xs text-gray-600 flex items-start gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-gray-300 mt-1.5 shrink-0" />
                  <div>
                    <span>{act.description || act.type}</span>
                    <p className="text-gray-400">{new Date(act.createdAt).toLocaleDateString()}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Internal Notes */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <StickyNote size={12} className="text-gray-400" />
            <span className="text-xs font-medium text-gray-600">Notes</span>
          </div>
          <div className="space-y-2 mb-2 max-h-32 overflow-y-auto">
            {notes.length === 0 ? (
              <p className="text-xs text-gray-400">No notes yet</p>
            ) : (
              notes.slice(0, 5).map((note: { id: string; body: string; createdAt: string }) => (
                <div key={note.id} className="text-xs bg-yellow-50 p-2 rounded border border-yellow-100">
                  <p className="text-gray-700">{note.body}</p>
                  <p className="text-gray-400 mt-0.5">{new Date(note.createdAt).toLocaleDateString()}</p>
                </div>
              ))
            )}
          </div>
          <div className="flex gap-1">
            <input
              type="text"
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="Add a note..."
              className="flex-1 text-xs px-2 py-1.5 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
              data-testid="note-input"
            />
            <Button
              size="sm"
              variant="ghost"
              onClick={() => { if (noteText.trim()) addNoteMutation.mutate(noteText); }}
              disabled={!noteText.trim() || addNoteMutation.isPending}
            >
              Add
            </Button>
          </div>
        </div>

        {/* Quick Actions */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Users size={12} className="text-gray-400" />
            <span className="text-xs font-medium text-gray-600">Quick Actions</span>
          </div>
          <div className="space-y-2">
            <select className="w-full text-xs border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]">
              <option value="">Change Stage...</option>
              <option value="new">New</option>
              <option value="contacted">Contacted</option>
              <option value="qualified">Qualified</option>
              <option value="proposal">Proposal</option>
              <option value="negotiation">Negotiation</option>
              <option value="closed">Closed</option>
            </select>
            <select className="w-full text-xs border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]">
              <option value="">Assign to...</option>
              <option value="user1">John Smith</option>
              <option value="user2">Jane Doe</option>
              <option value="user3">Alex Johnson</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}
