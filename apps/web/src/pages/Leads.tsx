import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, Plus, Trash2, Tags, ChevronRight, X, Phone, Building2, Briefcase, Target, Calendar, Bot, MessageSquare, Activity, History, FileText, Linkedin, Globe, Zap, Thermometer, Play, Square, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../lib/api';
import { Card, Button, Input, Select, Badge, Spinner, EmptyState, ErrorBanner, PageHeader, Modal } from '../components/ui';
import { LEAD_STAGE } from '@leadgenius/shared';

function LeadDetailDrawer({ leadId, onClose, onEdit, onDelete }: { leadId: string | null; onClose: () => void; onEdit?: (lead: any) => void; onDelete?: (id: string) => void }) {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['lead-detail', leadId],
    queryFn: () => api.get(`/leads/${leadId}`).then((r) => r.data),
    enabled: !!leadId,
  });

  const { data: timelineData } = useQuery({
    queryKey: ['lead-timeline', leadId],
    queryFn: () => api.get(`/leads/${leadId}/timeline`).then((r) => r.data),
    enabled: !!leadId,
  });

  const startWarmup = useMutation({
    mutationFn: () => api.post('/warmup/start', { leadIds: [leadId] }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead-detail', leadId] });
      toast.success('Warmup started');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const stopWarmup = useMutation({
    mutationFn: () => api.post('/warmup/stop', { leadIds: [leadId] }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead-detail', leadId] });
      toast.success('Warmup stopped');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updateStage = useMutation({
    mutationFn: (stage: string) => api.put(`/leads/${leadId}/stage`, { stage }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead-detail', leadId] });
      queryClient.invalidateQueries({ queryKey: ['lead-timeline', leadId] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      toast.success('Stage updated');
    },
  });

  const saveNotes = useMutation({
    mutationFn: (notes: string) => api.put(`/leads/${leadId}/notes`, { notes }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead-detail', leadId] });
      toast.success('Notes saved');
    },
  });

  const addTimelineEntry = useMutation({
    mutationFn: (params: { action: string; detail?: string; metadata?: any }) => api.post(`/leads/${leadId}/timeline`, params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead-timeline', leadId] });
      toast.success('Note added');
    },
  });

  const lead = data?.data;
  const timeline = timelineData?.data || [];

  const stageColors: Record<string, string> = {
    new: 'bg-[var(--color-surface-secondary)] text-[var(--color-text)]',
    contacted: 'bg-[var(--color-info-bg)] text-[var(--color-info)]',
    qualified: 'bg-[var(--color-primary)]/10 text-[var(--color-primary)]',
    demo: 'bg-purple-100 text-purple-700',
    proposal: 'bg-amber-100 text-amber-700',
    negotiation: 'bg-orange-100 text-orange-700',
    closed_won: 'bg-[var(--color-success-bg)] text-[var(--color-success)]',
    closed_lost: 'bg-[var(--color-error-bg)] text-[var(--color-error)]',
  };

  return (
    <div className={`fixed inset-y-0 right-0 z-40 w-full max-w-xl bg-[var(--color-surface)] shadow-2xl border-l border-[var(--color-border)] transform transition-transform duration-300 ease-out ${leadId ? 'translate-x-0' : 'translate-x-full'}`}>
      <div className="h-full flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-[var(--color-border)]">
          <h2 className="text-lg font-semibold text-[var(--color-text)]">Lead Details</h2>
          <div className="flex items-center gap-2">
            {lead && (
              <>
                <button onClick={() => onEdit?.(lead)} className="text-sm text-[var(--color-primary)] hover:underline font-medium">Edit</button>
                <button onClick={() => { if (confirm('Delete this lead?')) onDelete?.(lead.id); }} className="text-sm text-[var(--color-error)] hover:underline font-medium">Delete</button>
              </>
            )}
            <button onClick={onClose} className="p-1.5 hover:bg-[var(--color-surface-secondary)] rounded-lg text-[var(--color-text-secondary)] transition-colors"><X size={20} /></button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {isLoading ? <Spinner /> : !lead ? <EmptyState title="No data" description="" /> : <>
            <Card className="p-4">
              <h3 className="font-semibold text-[var(--color-text)] mb-3 flex items-center gap-2"><Activity size={16} /> Basic Info</h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-[var(--color-text-secondary)]">Name</span><p className="font-medium text-[var(--color-text)]">{lead.name || '—'}</p></div>
                <div><span className="text-[var(--color-text-secondary)]">Email</span><p className="font-medium text-[var(--color-text)]">{lead.email || '—'}</p></div>
                <div><span className="text-[var(--color-text-secondary)] flex items-center gap-1"><Phone size={12} /> Phone</span><p className="text-[var(--color-text)]">{lead.phone || '—'}</p></div>
                <div><span className="text-[var(--color-text-secondary)] flex items-center gap-1"><Building2 size={12} /> Company</span><p className="text-[var(--color-text)]">{lead.company || '—'}</p></div>
                <div><span className="text-[var(--color-text-secondary)] flex items-center gap-1"><Briefcase size={12} /> Title</span><p className="text-[var(--color-text)]">{lead.title || '—'}</p></div>
                <div><span className="text-[var(--color-text-secondary)] flex items-center gap-1"><Target size={12} /> Source</span><p className="text-[var(--color-text)]">{lead.source || '—'}</p></div>
                <div><span className="text-[var(--color-text-secondary)]">Status</span><p><Badge variant={lead.status === 'bounced' ? 'danger' : lead.status === 'active' ? 'success' : 'warning'}>{lead.status}</Badge></p></div>
                <div><span className="text-[var(--color-text-secondary)]">Score
                  <button
                    className="ml-1 align-middle text-[var(--color-text-tertiary)] hover:text-[var(--color-primary)]"
                    onClick={async (e) => {
                      e.stopPropagation();
                      try {
                        const res = await api.post(`/scoring/score/${lead.id}`);
                        queryClient.invalidateQueries({ queryKey: ['leads'] });
                        queryClient.invalidateQueries({ queryKey: ['lead-detail', lead.id] });
                        toast.success(`Score: ${res.data.data.score}`);
                      } catch (err: any) { toast.error(err.message); }
                    }}
                    title="Recalculate score"
                  >
                    <RefreshCw size={12} />
                  </button>
                </span>
                  <p>
                    {lead.score != null ? (
                      <span className="flex items-center gap-2">
                        <div className="w-16 h-2 bg-[var(--color-surface-secondary)] rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${lead.score >= 70 ? 'bg-[var(--color-success)]' : lead.score >= 40 ? 'bg-[var(--color-warning)]' : 'bg-[var(--color-text-tertiary)]'}`}
                            style={{ width: `${lead.score}%` }}
                          />
                        </div>
                        <span className={`text-xs font-semibold ${lead.score >= 70 ? 'text-[var(--color-success)]' : lead.score >= 40 ? 'text-[var(--color-warning)]' : 'text-[var(--color-text-secondary)]'}`}>{lead.score}</span>
                      </span>
                    ) : (
                      <button className="text-xs text-[var(--color-primary)] underline" onClick={async (e) => {
                        e.stopPropagation();
                        try {
                          const res = await api.post(`/scoring/score/${lead.id}`);
                          queryClient.invalidateQueries({ queryKey: ['leads'] });
                          queryClient.invalidateQueries({ queryKey: ['lead-detail', lead.id] });
                          toast.success(`Score: ${res.data.data.score}`);
                        } catch (err: any) { toast.error(err.message); }
                      }}>Calculate</button>
                    )}
                  </p>
                </div>
                <div><span className="text-[var(--color-text-secondary)] flex items-center gap-1"><Calendar size={12} /> Created</span><p className="text-[var(--color-text)]">{new Date(lead.createdAt).toLocaleDateString()}</p></div>
                <div><span className="text-[var(--color-text-secondary)]">Last Contacted</span><p className="text-[var(--color-text)]">{lead.lastContactedAt ? new Date(lead.lastContactedAt).toLocaleDateString() : '—'}</p></div>
              </div>
              {lead.linkedinUrl && <p className="mt-2 text-xs"><span className="text-[var(--color-text-tertiary)]">LinkedIn: </span><a href={lead.linkedinUrl} target="_blank" className="text-[var(--color-primary)] hover:underline">{lead.linkedinUrl}</a></p>}
              {lead.websiteUrl && <p className="mt-1 text-xs"><span className="text-[var(--color-text-tertiary)]">Website: </span><a href={lead.websiteUrl} target="_blank" className="text-[var(--color-primary)] hover:underline">{lead.websiteUrl}</a></p>}
              {lead.tags?.length > 0 && (
                <div className="mt-3 pt-3 border-t border-[var(--color-border-light)]">
                  <span className="text-xs text-[var(--color-text-tertiary)]">Tags</span>
                  <div className="flex gap-1 flex-wrap mt-1">{lead.tags.map((t: string) => <Badge key={t}>{t}</Badge>)}</div>
                </div>
              )}
            </Card>

            <Card className="p-4">
              <h3 className="font-semibold text-[var(--color-text)] mb-3 flex items-center gap-2"><Thermometer size={16} /> Warming</h3>
              <div className="flex items-center justify-between">
                <div>
                  {lead.warmupActive ? (
                    <span className="flex items-center gap-2 text-sm text-[var(--color-success)]"><Zap size={16} /> Active (step {lead.warmupStep})</span>
                  ) : (
                    <span className="text-sm text-[var(--color-text-secondary)]">Not warming</span>
                  )}
                  {lead.warmupStartedAt && <p className="text-xs text-[var(--color-text-tertiary)]">Started {new Date(lead.warmupStartedAt).toLocaleDateString()}</p>}
                </div>
                <Button
                  variant={lead.warmupActive ? 'danger' : 'primary'}
                  size="sm"
                  onClick={() => lead.warmupActive ? stopWarmup.mutate() : startWarmup.mutate()}
                  disabled={startWarmup.isPending || stopWarmup.isPending}
                >
                  {lead.warmupActive ? <><Square size={14} /><span className="ml-1">Stop</span></> : <><Play size={14} /><span className="ml-1">Start</span></>}
                </Button>
              </div>
              {lead.warmupTasks?.length > 0 && (
                <div className="mt-3 space-y-1 max-h-40 overflow-y-auto">
                  {lead.warmupTasks.map((t: any) => (
                    <div key={t.id} className="flex items-center justify-between text-xs p-2 bg-[var(--color-surface-secondary)] rounded">
                      <span className="text-[var(--color-text)]">{t.step.replace(/_/g, ' ')}</span>
                      <Badge variant={t.status === 'sent' ? 'success' : t.status === 'failed' ? 'danger' : 'warning'}>{t.status}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card className="p-4">
              <h3 className="font-semibold text-[var(--color-text)] mb-3 flex items-center gap-2"><Target size={16} /> Pipeline Stage</h3>
              <div className="flex flex-wrap gap-2">
                {LEAD_STAGE.map((s) => (
                  <button
                    key={s}
                    onClick={() => updateStage.mutate(s)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${lead.stage === s ? 'ring-2 ring-[var(--color-primary)] ' + stageColors[s] : 'bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-border-light)]'}`}
                  >
                    {s.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </Card>

            <Card className="p-4">
              <h3 className="font-semibold text-[var(--color-text)] mb-3 flex items-center gap-2"><FileText size={16} /> Notes</h3>
              <textarea
                className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg p-2 text-sm text-[var(--color-text)] resize-none focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                rows={3}
                defaultValue={lead.notes || ''}
                placeholder="Write notes about this lead..."
                onBlur={(e) => {
                  const val = e.target.value.trim();
                  if (val !== (lead.notes || '').trim()) saveNotes.mutate(val);
                }}
              />
            </Card>

            <Card className="p-4">
              <h3 className="font-semibold text-[var(--color-text)] mb-3 flex items-center gap-2"><History size={16} /> Timeline ({timeline.length})</h3>
              <div className="space-y-2 max-h-60 overflow-y-auto mb-3">
                {timeline.length === 0 ? (
                  <p className="text-xs text-[var(--color-text-tertiary)]">No activity yet</p>
                ) : (
                  timeline.map((entry: any) => (
                    <div key={entry.id} className="flex gap-3 text-sm border-l-2 border-[var(--color-border)] pl-3 py-1">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-xs text-[var(--color-text)] capitalize">{entry.action.replace(/_/g, ' ')}</p>
                        {entry.detail && <p className="text-xs text-[var(--color-text-secondary)]">{entry.detail}</p>}
                      </div>
                      <span className="text-xs text-[var(--color-text-tertiary)] whitespace-nowrap">{new Date(entry.createdAt).toLocaleDateString()}</span>
                    </div>
                  ))
                )}
              </div>
              <div className="flex gap-2">
                <input
                  className="flex-1 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-3 py-1.5 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                  placeholder="Add a note to timeline..."
                  id="timeline-note-input"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const input = e.currentTarget;
                      const val = input.value.trim();
                      if (val) {
                        addTimelineEntry.mutate({ action: 'note', detail: val });
                        input.value = '';
                      }
                    }
                  }}
                />
                <Button
                  size="sm"
                  onClick={() => {
                    const input = document.getElementById('timeline-note-input') as HTMLInputElement;
                    if (input?.value.trim()) {
                      addTimelineEntry.mutate({ action: 'note', detail: input.value.trim() });
                      input.value = '';
                    }
                  }}
                >Add</Button>
              </div>
            </Card>

            {lead.groupMembers?.length > 0 && (
              <Card className="p-4">
                <h3 className="font-semibold text-[var(--color-text)] mb-3 flex items-center gap-2"><Building2 size={16} /> Groups</h3>
                <div className="flex gap-2 flex-wrap">
                  {lead.groupMembers.map((gm: any) => (
                    <Badge key={gm.groupId} variant="info">{gm.group.name}</Badge>
                  ))}
                </div>
              </Card>
            )}

            {lead.enrichmentData && Object.keys(lead.enrichmentData).length > 0 && (
              <Card className="p-4">
                <h3 className="font-semibold text-[var(--color-text)] mb-3 flex items-center gap-2"><Bot size={16} /> AI Enrichment</h3>
                <pre className="text-xs bg-[var(--color-surface-secondary)] p-3 rounded-lg overflow-x-auto whitespace-pre-wrap text-[var(--color-text)]">{JSON.stringify(lead.enrichmentData, null, 2)}</pre>
              </Card>
            )}

            {lead.intentAnalysis && Object.keys(lead.intentAnalysis).length > 0 && (
              <Card className="p-4">
                <h3 className="font-semibold text-[var(--color-text)] mb-3 flex items-center gap-2"><MessageSquare size={16} /> Intent Analysis</h3>
                <pre className="text-xs bg-[var(--color-surface-secondary)] p-3 rounded-lg overflow-x-auto whitespace-pre-wrap text-[var(--color-text)]">{JSON.stringify(lead.intentAnalysis, null, 2)}</pre>
              </Card>
            )}

            {lead.customFields && Object.keys(lead.customFields).length > 0 && (
              <Card className="p-4">
                <h3 className="font-semibold text-[var(--color-text)] mb-3">Custom Fields</h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {Object.entries(lead.customFields).map(([k, v]) => (
                    <div key={k}><span className="text-[var(--color-text-secondary)] text-xs">{k}</span><p className="text-[var(--color-text)]">{String(v)}</p></div>
                  ))}
                </div>
              </Card>
            )}

            {lead.messages?.length > 0 && (
              <Card className="p-4">
                <h3 className="font-semibold text-[var(--color-text)] mb-3 flex items-center gap-2"><MessageSquare size={16} /> Message History ({lead.messages.length})</h3>
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {lead.messages.map((msg: any) => (
                    <div key={msg.id} className={`p-3 rounded-lg text-sm ${msg.direction === 'inbound' ? 'bg-[var(--color-info-bg)] ml-4' : 'bg-[var(--color-surface-secondary)] mr-4'}`}>
                      <div className="flex items-center justify-between mb-1">
                        <Badge variant={msg.direction === 'inbound' ? 'info' : 'default'}>{msg.direction}</Badge>
                        <span className="text-xs text-[var(--color-text-tertiary)]">{new Date(msg.createdAt).toLocaleString()}</span>
                      </div>
                      <p className="font-medium text-xs text-[var(--color-text)]">{msg.subject || '(no subject)'}</p>
                      <p className="text-[var(--color-text-secondary)] text-xs mt-1 line-clamp-2">{msg.body.replace(/<[^>]*>/g, '').slice(0, 200)}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant={msg.status === 'sent' || msg.status === 'delivered' ? 'success' : msg.status === 'failed' ? 'danger' : 'warning'}>{msg.status}</Badge>
                        {msg.isAiGenerated && <Badge variant="info">AI</Badge>}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            <Card className="p-4">
              <h3 className="font-semibold text-[var(--color-text)] mb-3">Raw Data</h3>
              <details>
                <summary className="text-sm text-[var(--color-text-secondary)] cursor-pointer hover:text-[var(--color-text)]">Show full JSON</summary>
                <pre className="text-xs bg-[var(--color-surface-secondary)] p-3 rounded-lg overflow-x-auto mt-2 whitespace-pre-wrap max-h-96 text-[var(--color-text)]">{JSON.stringify(lead, null, 2)}</pre>
              </details>
            </Card>
          </>}
        </div>
      </div>
    </div>
  );
}

function LinkedInImportModal({ isOpen, onClose, onComplete }: { isOpen: boolean; onClose: () => void; onComplete: () => void }) {
  const [searchUrl, setSearchUrl] = useState('');
  const [keywords, setKeywords] = useState('');
  const [title, setTitle] = useState('');
  const [company, setCompany] = useState('');
  const [maxLeads, setMaxLeads] = useState(25);
  const [groupId, setGroupId] = useState('');

  const { data: groupsData } = useQuery({
    queryKey: ['groups'],
    queryFn: () => api.get('/groups').then((r) => r.data),
  });

  const importMut = useMutation({
    mutationFn: (body: any) => api.post('/leads/source/linkedin', body),
    onSuccess: (res) => {
      toast.success(`Imported ${res.data.data.count} leads from LinkedIn`);
      onComplete();
      onClose();
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (!isOpen) return null;
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Import from LinkedIn">
      <form onSubmit={(e) => { e.preventDefault(); importMut.mutate({ searchUrl, keywords, title, company, maxLeads, groupId: groupId || undefined }); }} className="space-y-4">
        <Input label="LinkedIn Profile URL" placeholder="https://linkedin.com/in/username" value={searchUrl} onChange={(e) => setSearchUrl(e.target.value)} />
        <p className="text-xs text-[var(--color-text-tertiary)]">Or search by criteria:</p>
        <Input label="Keywords" placeholder="e.g. software engineer" value={keywords} onChange={(e) => setKeywords(e.target.value)} />
        <Input label="Title" placeholder="e.g. CTO" value={title} onChange={(e) => setTitle(e.target.value)} />
        <Input label="Company" placeholder="e.g. Google" value={company} onChange={(e) => setCompany(e.target.value)} />
        <Input label="Max Leads" type="number" value={String(maxLeads)} onChange={(e) => setMaxLeads(Number(e.target.value))} />
        <Select label="Add to Group (optional)" options={['', ...(groupsData?.data || []).map((g: any) => ({ value: g.id, label: g.name }))]} value={groupId} onChange={(e: any) => setGroupId(e.target.value)} />
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={importMut.isPending}>{importMut.isPending ? 'Importing...' : 'Import'}</Button>
        </div>
      </form>
    </Modal>
  );
}

function WebsiteImportModal({ isOpen, onClose, onComplete }: { isOpen: boolean; onClose: () => void; onComplete: () => void }) {
  const [url, setUrl] = useState('');
  const [maxLeads, setMaxLeads] = useState(25);
  const [groupId, setGroupId] = useState('');

  const { data: groupsData } = useQuery({
    queryKey: ['groups'],
    queryFn: () => api.get('/groups').then((r) => r.data),
  });

  const importMut = useMutation({
    mutationFn: (body: any) => api.post('/leads/source/website', body),
    onSuccess: (res) => {
      toast.success(`Imported ${res.data.data.count} leads from website`);
      onComplete();
      onClose();
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (!isOpen) return null;
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Import from Website">
      <form onSubmit={(e) => { e.preventDefault(); importMut.mutate({ url, maxLeads, groupId: groupId || undefined }); }} className="space-y-4">
        <Input label="Website URL" placeholder="https://example.com/team" value={url} onChange={(e) => setUrl(e.target.value)} />
        <Input label="Max Leads" type="number" value={String(maxLeads)} onChange={(e) => setMaxLeads(Number(e.target.value))} />
        <Select label="Add to Group (optional)" options={['', ...(groupsData?.data || []).map((g: any) => ({ value: g.id, label: g.name }))]} value={groupId} onChange={(e: any) => setGroupId(e.target.value)} />
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={importMut.isPending}>{importMut.isPending ? 'Importing...' : 'Import'}</Button>
        </div>
      </form>
    </Modal>
  );
}

function WarmupSettingsModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();

  const { data } = useQuery({
    queryKey: ['warmup-settings'],
    queryFn: () => api.get('/warmup/settings').then((r) => r.data),
    enabled: isOpen,
  });

  const saveMut = useMutation({
    mutationFn: (body: any) => api.put('/warmup/settings', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warmup-settings'] });
      toast.success('Warmup settings saved');
      onClose();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const settings = data?.data;
  if (!isOpen) return null;
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Warmup Settings">
      <form onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); saveMut.mutate({ enabled: fd.get('enabled') === 'on', maxActiveWarmups: Number(fd.get('maxActiveWarmups')), stepsPerDay: Number(fd.get('stepsPerDay')), minDelayHours: Number(fd.get('minDelayHours')), maxDelayHours: Number(fd.get('maxDelayHours')), workingHoursStart: fd.get('workingHoursStart'), workingHoursEnd: fd.get('workingHoursEnd'), timezone: fd.get('timezone') }); }} className="space-y-4">
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="enabled" defaultChecked={settings?.enabled} className="accent-[var(--color-primary)]" /> Enable Auto-Warming</label>
        <Input label="Max Active Warmups" name="maxActiveWarmups" type="number" defaultValue={settings?.maxActiveWarmups || 20} />
        <Input label="Steps Per Day" name="stepsPerDay" type="number" defaultValue={settings?.stepsPerDay || 2} />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Min Delay (hours)" name="minDelayHours" type="number" defaultValue={settings?.minDelayHours || 12} />
          <Input label="Max Delay (hours)" name="maxDelayHours" type="number" defaultValue={settings?.maxDelayHours || 48} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Working Hours Start" name="workingHoursStart" defaultValue={settings?.workingHoursStart || '09:00'} />
          <Input label="Working Hours End" name="workingHoursEnd" defaultValue={settings?.workingHoursEnd || '18:00'} />
        </div>
        <Input label="Timezone" name="timezone" defaultValue={settings?.timezone || 'UTC'} />
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={saveMut.isPending}>{saveMut.isPending ? 'Saving...' : 'Save'}</Button>
        </div>
      </form>
    </Modal>
  );
}

export default function Leads() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [warmupFilter, setWarmupFilter] = useState('');
  const [scoreFilter, setScoreFilter] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [detailLeadId, setDetailLeadId] = useState<string | null>(null);
  const [showLinkedinModal, setShowLinkedinModal] = useState(false);
  const [showWebsiteModal, setShowWebsiteModal] = useState(false);
  const [showWarmupSettings, setShowWarmupSettings] = useState(false);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['leads', page, search, statusFilter, sourceFilter, warmupFilter, scoreFilter],
    queryFn: () => api.get('/leads', { params: { page, pageSize: 50, search, status: statusFilter || undefined, source: sourceFilter || undefined, warmupActive: warmupFilter || undefined, scoreSegment: scoreFilter || undefined } }).then((r) => r.data),
  });

  const bulkWarmup = useMutation({
    mutationFn: () => api.post('/warmup/start', { leadIds: selected }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['leads'] }); toast.success('Warmup started'); setSelected([]); },
    onError: (e: any) => toast.error(e.message),
  });

  const bulkStopWarmup = useMutation({
    mutationFn: () => api.post('/warmup/stop', { leadIds: selected }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['leads'] }); toast.success('Warmup stopped'); setSelected([]); },
    onError: (e: any) => toast.error(e.message),
  });

  const bulkTag = useMutation({
    mutationFn: (body: { ids: string[]; tags: string[]; action: 'add' | 'remove' }) => api.post('/leads/bulk-tag', body),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['leads'] }); toast.success('Tags updated'); setSelected([]); },
  });

  const bulkDelete = useMutation({
    mutationFn: (ids: string[]) => Promise.all(ids.map((id) => api.delete(`/leads/${id}`))),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['leads'] }); toast.success('Leads deleted'); setSelected([]); },
  });

  const saveLead = useMutation({
    mutationFn: (body: any) => editing ? api.put(`/leads/${editing.id}`, body) : api.post('/leads', body),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['leads'] }); toast.success(editing ? 'Lead updated' : 'Lead created'); setShowModal(false); setEditing(null); },
  });

  const leads = data?.data || [];
  const meta = data?.meta;

  if (error) return <ErrorBanner message={error.message} onRetry={() => refetch()} />;

  return (
    <div>
      <div className="flex relative">
        <div className="flex-1 min-w-0">
          <PageHeader
            title="Leads"
            description="Source, manage and warm up your leads"
            action={
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => setShowWarmupSettings(true)}>
                  <Thermometer size={16} /><span className="ml-1">Warmup</span>
                </Button>
                <Button variant="secondary" onClick={() => setShowWebsiteModal(true)}>
                  <Globe size={16} /><span className="ml-1">Website</span>
                </Button>
                <Button variant="secondary" onClick={() => setShowLinkedinModal(true)}>
                  <Linkedin size={16} /><span className="ml-1">LinkedIn</span>
                </Button>
                <Button onClick={() => { setEditing(null); setShowModal(true); }}>
                  <Plus size={16} /><span className="ml-1">Add Lead</span>
                </Button>
              </div>
            }
          />

          <Card className="mb-4 p-3">
            <div className="flex flex-wrap gap-3 items-center">
              <div className="flex-1 min-w-[200px] relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-tertiary)]" />
                <input className="w-full pl-9 pr-3 py-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-tertiary)]" placeholder="Search by name, email, company..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
              </div>
              <Select options={['', 'active', 'unsubscribed', 'bounced', 'invalid']} value={statusFilter} onChange={(e: any) => { setStatusFilter(e.target.value); setPage(1); }} className="w-32" />
              <Select options={['', 'manual', 'csv', 'linkedin', 'website', 'webhook', 'api', 'referral']} value={sourceFilter} onChange={(e: any) => { setSourceFilter(e.target.value); setPage(1); }} className="w-32" />
              <Select options={[{ value: '', label: 'Warmup: All' }, { value: 'true', label: 'Warming Active' }, { value: 'false', label: 'Not Warming' }]} value={warmupFilter} onChange={(e: any) => { setWarmupFilter(e.target.value); setPage(1); }} className="w-40" />
              <Select options={[{ value: '', label: 'Score: All' }, { value: 'hot', label: 'Hot (70+)' }, { value: 'warm', label: 'Warm (40-69)' }, { value: 'cool', label: 'Cool (20-39)' }, { value: 'cold', label: 'Cold (1-19)' }, { value: 'unscored', label: 'Unscored' }]} value={scoreFilter} onChange={(e: any) => { setScoreFilter(e.target.value); setPage(1); }} className="w-40" />
              {selected.length > 0 && (
                <>
                  <Button variant="secondary" size="sm" onClick={() => { const tag = prompt('Enter tags (comma-separated):'); if (tag) bulkTag.mutate({ ids: selected, tags: tag.split(',').map((t) => t.trim()), action: 'add' }); }}>
                    <Tags size={14} /><span className="ml-1">Tag ({selected.length})</span>
                  </Button>
                  <Button variant="primary" size="sm" onClick={() => bulkWarmup.mutate()}>
                    <Zap size={14} /><span className="ml-1">Warm ({selected.length})</span>
                  </Button>
                  <Button variant="danger" size="sm" onClick={() => { if (confirm(`Delete ${selected.length} leads?`)) bulkDelete.mutate(selected); }}>
                    <Trash2 size={14} /><span className="ml-1">Delete</span>
                  </Button>
                </>
              )}
            </div>
          </Card>

          {isLoading ? <Spinner /> : leads.length === 0 ? <EmptyState title="No leads yet" description="Import from LinkedIn, website, or add manually" action={<Button onClick={() => setShowModal(true)}>Add Lead</Button>} /> : (
            <Card>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface-secondary)]">
                      <th className="p-3 text-left w-10"><input type="checkbox" onChange={(e) => setSelected(e.target.checked ? leads.map((l: any) => l.id) : [])} checked={selected.length === leads.length && leads.length > 0} className="accent-[var(--color-primary)]" /></th>
                      <th className="p-3 text-left font-medium text-[var(--color-text-secondary)] text-xs uppercase tracking-wider">Name / Email</th>
                      <th className="p-3 text-left font-medium text-[var(--color-text-secondary)] text-xs uppercase tracking-wider">Company</th>
                      <th className="p-3 text-left font-medium text-[var(--color-text-secondary)] text-xs uppercase tracking-wider">Source</th>
                      <th className="p-3 text-left font-medium text-[var(--color-text-secondary)] text-xs uppercase tracking-wider">Warmup</th>
                      <th className="p-3 text-left font-medium text-[var(--color-text-secondary)] text-xs uppercase tracking-wider">Score</th>
                      <th className="p-3 text-left font-medium text-[var(--color-text-secondary)] text-xs uppercase tracking-wider">Status</th>
                      <th className="p-3 text-left font-medium text-[var(--color-text-secondary)] text-xs uppercase tracking-wider">Tags</th>
                      <th className="p-3 text-left font-medium text-[var(--color-text-secondary)] text-xs uppercase tracking-wider"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {leads.map((lead: any) => (
                      <tr key={lead.id} className="border-b border-[var(--color-border-light)] hover:bg-[var(--color-surface-secondary)] cursor-pointer transition-colors" onClick={() => setDetailLeadId(lead.id)}>
                        <td className="p-3" onClick={(e) => e.stopPropagation()}><input type="checkbox" checked={selected.includes(lead.id)} onChange={(e) => setSelected(e.target.checked ? [...selected, lead.id] : selected.filter((id) => id !== lead.id))} className="accent-[var(--color-primary)]" /></td>
                        <td className="p-3">
                          <p className="font-medium text-[var(--color-text)]">{lead.name || '—'}</p>
                          <p className="text-xs text-[var(--color-text-tertiary)]">{lead.email || ''}</p>
                        </td>
                        <td className="p-3 text-[var(--color-text-secondary)]">{lead.company || '—'}</td>
                        <td className="p-3">{lead.source ? <Badge variant="info">{lead.source}</Badge> : '—'}</td>
                        <td className="p-3">
                          {lead.warmupActive ? (
                            <span className="flex items-center gap-1 text-xs text-[var(--color-success)]"><Zap size={12} /> Step {lead.warmupStep}</span>
                          ) : (
                            <span className="text-xs text-[var(--color-text-tertiary)]">—</span>
                          )}
                        </td>
                        <td className="p-3">{lead.score != null ? <Badge variant={lead.score >= 70 ? 'success' : lead.score >= 40 ? 'warning' : 'default'}>{lead.score}</Badge> : '—'}</td>
                        <td className="p-3"><Badge variant={lead.status === 'bounced' ? 'danger' : lead.status === 'active' ? 'success' : 'warning'}>{lead.status}</Badge></td>
                        <td className="p-3"><div className="flex gap-1 flex-wrap max-w-[120px]">{lead.tags?.slice(0, 2).map((t: string) => <Badge key={t}>{t}</Badge>)}{lead.tags?.length > 2 && <span className="text-xs text-[var(--color-text-tertiary)]">+{lead.tags.length - 2}</span>}</div></td>
                        <td className="p-3" onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="sm" onClick={() => setDetailLeadId(lead.id)}><ChevronRight size={16} /></Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {meta && (
                <div className="flex items-center justify-between p-3 border-t border-[var(--color-border)] text-sm text-[var(--color-text-secondary)]">
                  <span>Page {meta.page} of {meta.totalPages} ({meta.total} leads)</span>
                  <div className="flex gap-2">
                    <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
                    <Button variant="secondary" size="sm" disabled={page >= meta.totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
                  </div>
                </div>
              )}
            </Card>
          )}
        </div>

        <LeadDetailDrawer leadId={detailLeadId} onClose={() => setDetailLeadId(null)} onEdit={(lead) => { setEditing(lead); setDetailLeadId(null); setShowModal(true); }} onDelete={(id) => { api.delete(`/leads/${id}`).then(() => { queryClient.invalidateQueries({ queryKey: ['leads'] }); setDetailLeadId(null); toast.success('Lead deleted'); }).catch((e) => toast.error(e.message)); }} />
        {detailLeadId && <div className="fixed inset-0 z-30 bg-[var(--color-overlay)]" onClick={() => setDetailLeadId(null)} />}
      </div>

      <Modal isOpen={showModal} onClose={() => { setShowModal(false); setEditing(null); }} title={editing ? 'Edit Lead' : 'Add Lead'}>
        <form onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); saveLead.mutate(Object.fromEntries(fd)); }} className="space-y-4">
          <Input label="Name" name="name" defaultValue={editing?.name || ''} />
          <Input label="Email" name="email" type="email" defaultValue={editing?.email || ''} />
          <Input label="Phone" name="phone" defaultValue={editing?.phone || ''} />
          <Input label="Company" name="company" defaultValue={editing?.company || ''} />
          <Input label="Title" name="title" defaultValue={editing?.title || ''} />
          <Input label="LinkedIn URL" name="linkedinUrl" defaultValue={editing?.linkedinUrl || ''} />
          <Input label="Website URL" name="websiteUrl" defaultValue={editing?.websiteUrl || ''} />
          <Select label="Status" name="status" options={['active', 'unsubscribed', 'bounced', 'invalid']} defaultValue={editing?.status || 'active'} />
          <Input label="Tags (comma-separated)" name="tags" defaultValue={editing?.tags?.join(', ') || ''} />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => { setShowModal(false); setEditing(null); }}>Cancel</Button>
            <Button type="submit" disabled={saveLead.isPending}>{saveLead.isPending ? 'Saving...' : 'Save'}</Button>
          </div>
        </form>
      </Modal>

      <LinkedInImportModal isOpen={showLinkedinModal} onClose={() => setShowLinkedinModal(false)} onComplete={() => { queryClient.invalidateQueries({ queryKey: ['leads'] }); }} />
      <WebsiteImportModal isOpen={showWebsiteModal} onClose={() => setShowWebsiteModal(false)} onComplete={() => { queryClient.invalidateQueries({ queryKey: ['leads'] }); }} />
      <WarmupSettingsModal isOpen={showWarmupSettings} onClose={() => setShowWarmupSettings(false)} />
    </div>
  );
}
