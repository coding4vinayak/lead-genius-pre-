import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, Plus, Trash2, Tags, ChevronRight, X, Phone, Building2, Briefcase, Target, Calendar, Bot, MessageSquare, Activity } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../lib/api';
import { Card, Button, Input, Select, Badge, Spinner, EmptyState, ErrorBanner, PageHeader, Modal } from '../components/ui';

function LeadDetailDrawer({ leadId, onClose }: { leadId: string | null; onClose: () => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ['lead-detail', leadId],
    queryFn: () => api.get(`/leads/${leadId}`).then((r) => r.data),
    enabled: !!leadId,
  });

  const lead = data?.data;

  return (
    <div className={`fixed inset-y-0 right-0 z-40 w-full max-w-xl bg-white shadow-2xl border-l border-gray-200 transform transition-transform duration-300 ${leadId ? 'translate-x-0' : 'translate-x-full'}`}>
      <div className="h-full flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold">Lead Details</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg"><X size={20} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {isLoading ? <Spinner /> : !lead ? <EmptyState title="No data" description="" /> : <>
            <Card className="p-4">
              <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2"><Activity size={16} /> Basic Info</h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-gray-500">Name</span><p className="font-medium">{lead.name || '—'}</p></div>
                <div><span className="text-gray-500">Email</span><p className="font-medium">{lead.email || '—'}</p></div>
                <div><span className="text-gray-500 flex items-center gap-1"><Phone size={12} /> Phone</span><p>{lead.phone || '—'}</p></div>
                <div><span className="text-gray-500 flex items-center gap-1"><Building2 size={12} /> Company</span><p>{lead.company || '—'}</p></div>
                <div><span className="text-gray-500 flex items-center gap-1"><Briefcase size={12} /> Title</span><p>{lead.title || '—'}</p></div>
                <div><span className="text-gray-500 flex items-center gap-1"><Target size={12} /> Source</span><p>{lead.source || '—'}</p></div>
                <div><span className="text-gray-500">Status</span><p><Badge variant={lead.status === 'bounced' ? 'danger' : lead.status === 'active' ? 'success' : 'warning'}>{lead.status}</Badge></p></div>
                <div><span className="text-gray-500">Score</span><p>{lead.score != null ? <Badge variant={lead.score >= 70 ? 'success' : lead.score >= 40 ? 'warning' : 'default'}>{lead.score}</Badge> : '—'}</p></div>
                <div><span className="text-gray-500 flex items-center gap-1"><Calendar size={12} /> Created</span><p>{new Date(lead.createdAt).toLocaleDateString()}</p></div>
                <div><span className="text-gray-500">Last Contacted</span><p>{lead.lastContactedAt ? new Date(lead.lastContactedAt).toLocaleDateString() : '—'}</p></div>
              </div>
              {lead.tags?.length > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <span className="text-xs text-gray-500">Tags</span>
                  <div className="flex gap-1 flex-wrap mt-1">{lead.tags.map((t: string) => <Badge key={t}>{t}</Badge>)}</div>
                </div>
              )}
            </Card>

            {lead.groupMembers?.length > 0 && (
              <Card className="p-4">
                <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2"><Building2 size={16} /> Groups</h3>
                <div className="flex gap-2 flex-wrap">
                  {lead.groupMembers.map((gm: any) => (
                    <Badge key={gm.groupId} variant="info">{gm.group.name}</Badge>
                  ))}
                </div>
              </Card>
            )}

            {lead.enrichmentData && Object.keys(lead.enrichmentData).length > 0 && (
              <Card className="p-4">
                <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2"><Bot size={16} /> AI Enrichment</h3>
                <pre className="text-xs bg-gray-50 p-3 rounded-lg overflow-x-auto whitespace-pre-wrap">{JSON.stringify(lead.enrichmentData, null, 2)}</pre>
              </Card>
            )}

            {lead.intentAnalysis && Object.keys(lead.intentAnalysis).length > 0 && (
              <Card className="p-4">
                <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2"><MessageSquare size={16} /> Intent Analysis</h3>
                <pre className="text-xs bg-gray-50 p-3 rounded-lg overflow-x-auto whitespace-pre-wrap">{JSON.stringify(lead.intentAnalysis, null, 2)}</pre>
              </Card>
            )}

            {lead.customFields && Object.keys(lead.customFields).length > 0 && (
              <Card className="p-4">
                <h3 className="font-semibold text-gray-900 mb-3">Custom Fields</h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {Object.entries(lead.customFields).map(([k, v]) => (
                    <div key={k}><span className="text-gray-500 text-xs">{k}</span><p>{String(v)}</p></div>
                  ))}
                </div>
              </Card>
            )}

            {lead.messages?.length > 0 && (
              <Card className="p-4">
                <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2"><MessageSquare size={16} /> Message History ({lead.messages.length})</h3>
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {lead.messages.map((msg: any) => (
                    <div key={msg.id} className={`p-3 rounded-lg text-sm ${msg.direction === 'inbound' ? 'bg-blue-50 ml-4' : 'bg-gray-50 mr-4'}`}>
                      <div className="flex items-center justify-between mb-1">
                        <Badge variant={msg.direction === 'inbound' ? 'info' : 'default'}>{msg.direction}</Badge>
                        <span className="text-xs text-gray-400">{new Date(msg.createdAt).toLocaleString()}</span>
                      </div>
                      <p className="font-medium text-xs">{msg.subject || '(no subject)'}</p>
                      <p className="text-gray-600 text-xs mt-1 line-clamp-2">{msg.body.replace(/<[^>]*>/g, '').slice(0, 200)}</p>
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
              <h3 className="font-semibold text-gray-900 mb-3">Raw Data</h3>
              <details>
                <summary className="text-sm text-gray-500 cursor-pointer hover:text-gray-700">Show full JSON</summary>
                <pre className="text-xs bg-gray-50 p-3 rounded-lg overflow-x-auto mt-2 whitespace-pre-wrap max-h-96">{JSON.stringify(lead, null, 2)}</pre>
              </details>
            </Card>
          </>}
        </div>
      </div>
    </div>
  );
}

export default function Leads() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [detailLeadId, setDetailLeadId] = useState<string | null>(null);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['leads', page, search, statusFilter, sourceFilter],
    queryFn: () => api.get('/leads', { params: { page, pageSize: 50, search, status: statusFilter || undefined, source: sourceFilter || undefined } }).then((r) => r.data),
  });

  const sourcesQuery = useQuery({
    queryKey: ['lead-sources'],
    queryFn: () => api.get('/leads', { params: { pageSize: 1 } }).then(() => []),
    enabled: false,
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
          <PageHeader title="Leads" description="All your leads in one place" action={<Button onClick={() => { setEditing(null); setShowModal(true); }}><Plus size={16} /><span className="ml-1">Add Lead</span></Button>} />

          <Card className="mb-4 p-3">
            <div className="flex flex-wrap gap-3 items-center">
              <div className="flex-1 min-w-[200px] relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="Search by name, email, company..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
              </div>
              <Select options={['', 'active', 'unsubscribed', 'bounced', 'invalid']} value={statusFilter} onChange={(e: any) => { setStatusFilter(e.target.value); setPage(1); }} className="w-36" />
              <Select options={['', 'website', 'referral', 'linkedin', 'conference', 'webinar', 'cold-outreach', 'partner', 'advertisement', 'trial-signup']} value={sourceFilter} onChange={(e: any) => { setSourceFilter(e.target.value); setPage(1); }} className="w-36" />
              {selected.length > 0 && (
                <>
                  <Button variant="secondary" size="sm" onClick={() => { const tag = prompt('Enter tags (comma-separated):'); if (tag) bulkTag.mutate({ ids: selected, tags: tag.split(',').map((t) => t.trim()), action: 'add' }); }}>
                    <Tags size={14} /><span className="ml-1">Tag ({selected.length})</span>
                  </Button>
                  <Button variant="danger" size="sm" onClick={() => { if (confirm(`Delete ${selected.length} leads?`)) bulkDelete.mutate(selected); }}>
                    <Trash2 size={14} /><span className="ml-1">Delete</span>
                  </Button>
                </>
              )}
            </div>
          </Card>

          {isLoading ? <Spinner /> : leads.length === 0 ? <EmptyState title="No leads yet" description="Add your first lead or import a CSV" action={<Button onClick={() => setShowModal(true)}>Add Lead</Button>} /> : (
            <Card>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                      <th className="p-3 text-left w-8"><input type="checkbox" onChange={(e) => setSelected(e.target.checked ? leads.map((l: any) => l.id) : [])} checked={selected.length === leads.length && leads.length > 0} /></th>
                      <th className="p-3 text-left font-medium text-gray-600">Name / Email</th>
                      <th className="p-3 text-left font-medium text-gray-600">Company</th>
                      <th className="p-3 text-left font-medium text-gray-600">Title</th>
                      <th className="p-3 text-left font-medium text-gray-600">Phone</th>
                      <th className="p-3 text-left font-medium text-gray-600">Source</th>
                      <th className="p-3 text-left font-medium text-gray-600">Score</th>
                      <th className="p-3 text-left font-medium text-gray-600">Status</th>
                      <th className="p-3 text-left font-medium text-gray-600">Tags</th>
                      <th className="p-3 text-left font-medium text-gray-600"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {leads.map((lead: any) => (
                      <tr key={lead.id} className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer" onClick={() => setDetailLeadId(lead.id)}>
                        <td className="p-3" onClick={(e) => e.stopPropagation()}><input type="checkbox" checked={selected.includes(lead.id)} onChange={(e) => setSelected(e.target.checked ? [...selected, lead.id] : selected.filter((id) => id !== lead.id))} /></td>
                        <td className="p-3">
                          <p className="font-medium text-gray-900">{lead.name || '—'}</p>
                          <p className="text-xs text-gray-400">{lead.email || ''}</p>
                        </td>
                        <td className="p-3 text-gray-600">{lead.company || '—'}</td>
                        <td className="p-3 text-gray-600">{lead.title || '—'}</td>
                        <td className="p-3 text-gray-500 text-xs">{lead.phone || '—'}</td>
                        <td className="p-3">{lead.source ? <Badge variant="info">{lead.source}</Badge> : '—'}</td>
                        <td className="p-3">{lead.score != null ? <Badge variant={lead.score >= 70 ? 'success' : lead.score >= 40 ? 'warning' : 'default'}>{lead.score}</Badge> : '—'}</td>
                        <td className="p-3"><Badge variant={lead.status === 'bounced' ? 'danger' : lead.status === 'active' ? 'success' : 'warning'}>{lead.status}</Badge></td>
                        <td className="p-3"><div className="flex gap-1 flex-wrap max-w-[120px]">{lead.tags?.slice(0, 2).map((t: string) => <Badge key={t}>{t}</Badge>)}{lead.tags?.length > 2 && <span className="text-xs text-gray-400">+{lead.tags.length - 2}</span>}</div></td>
                        <td className="p-3" onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="sm" onClick={() => setDetailLeadId(lead.id)}><ChevronRight size={16} /></Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {meta && (
                <div className="flex items-center justify-between p-3 border-t border-gray-200 text-sm text-gray-500">
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

        <LeadDetailDrawer leadId={detailLeadId} onClose={() => setDetailLeadId(null)} />
        {detailLeadId && <div className="fixed inset-0 z-30 bg-black/20" onClick={() => setDetailLeadId(null)} />}
      </div>

      <Modal isOpen={showModal} onClose={() => { setShowModal(false); setEditing(null); }} title={editing ? 'Edit Lead' : 'Add Lead'}>
        <form onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); saveLead.mutate(Object.fromEntries(fd)); }} className="space-y-4">
          <Input label="Name" name="name" defaultValue={editing?.name || ''} />
          <Input label="Email" name="email" type="email" defaultValue={editing?.email || ''} />
          <Input label="Phone" name="phone" defaultValue={editing?.phone || ''} />
          <Input label="Company" name="company" defaultValue={editing?.company || ''} />
          <Input label="Title" name="title" defaultValue={editing?.title || ''} />
          <Select label="Status" name="status" options={['active', 'unsubscribed', 'bounced', 'invalid']} defaultValue={editing?.status || 'active'} />
          <Input label="Tags (comma-separated)" name="tags" defaultValue={editing?.tags?.join(', ') || ''} />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => { setShowModal(false); setEditing(null); }}>Cancel</Button>
            <Button type="submit" disabled={saveLead.isPending}>{saveLead.isPending ? 'Saving...' : 'Save'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}


