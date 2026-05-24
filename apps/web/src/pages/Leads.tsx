import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, Plus, Upload, Download, Trash2, Tags } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../lib/api';
import { Card, Button, Input, Select, Badge, Modal, Spinner, EmptyState, ErrorBanner, PageHeader } from '../components/ui';

export default function Leads() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<any>(null);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['leads', page, search, statusFilter],
    queryFn: () => api.get('/leads', { params: { page, pageSize: 50, search, status: statusFilter || undefined } }).then((r) => r.data),
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
      <PageHeader title="Leads" description="Manage your leads" action={<Button onClick={() => { setEditing(null); setShowModal(true); }}><Plus size={16} /><span className="ml-1">Add Lead</span></Button>} />

      <Card className="mb-4 p-3">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="flex-1 min-w-[200px] relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="Search leads..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
          </div>
          <Select options={['', 'active', 'unsubscribed', 'bounced', 'invalid']} value={statusFilter} onChange={(e: any) => { setStatusFilter(e.target.value); setPage(1); }} className="w-40" />
          {selected.length > 0 && (
            <>
              <Button variant="secondary" size="sm" onClick={() => { const tag = prompt('Enter tags (comma-separated):'); if (tag) bulkTag.mutate({ ids: selected, tags: tag.split(',').map((t) => t.trim()), action: 'add' }); }}>
                <Tags size={14} /><span className="ml-1">Tag</span>
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
                  <th className="p-3 text-left font-medium text-gray-600">Name</th>
                  <th className="p-3 text-left font-medium text-gray-600">Email</th>
                  <th className="p-3 text-left font-medium text-gray-600">Company</th>
                  <th className="p-3 text-left font-medium text-gray-600">Status</th>
                  <th className="p-3 text-left font-medium text-gray-600">Tags</th>
                  <th className="p-3 text-left font-medium text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((lead: any) => (
                  <tr key={lead.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="p-3"><input type="checkbox" checked={selected.includes(lead.id)} onChange={(e) => setSelected(e.target.checked ? [...selected, lead.id] : selected.filter((id) => id !== lead.id))} /></td>
                    <td className="p-3 font-medium">{lead.name || '—'}</td>
                    <td className="p-3 text-gray-500">{lead.email || '—'}</td>
                    <td className="p-3 text-gray-500">{lead.company || '—'}</td>
                    <td className="p-3"><Badge variant={lead.status === 'bounced' ? 'danger' : lead.status === 'active' ? 'success' : 'warning'}>{lead.status}</Badge></td>
                    <td className="p-3"><div className="flex gap-1 flex-wrap">{lead.tags?.map((t: string) => <Badge key={t}>{t}</Badge>)}</div></td>
                    <td className="p-3">
                      <Button variant="ghost" size="sm" onClick={() => { setEditing(lead); setShowModal(true); }}>Edit</Button>
                      <Button variant="ghost" size="sm" className="text-red-500" onClick={() => { if (confirm('Delete?')) api.delete(`/leads/${lead.id}`).then(() => refetch()); }}>Delete</Button>
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

      <Modal isOpen={showModal} onClose={() => { setShowModal(false); setEditing(null); }} title={editing ? 'Edit Lead' : 'Add Lead'}>
        <form onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); saveLead.mutate(Object.fromEntries(fd)); }} className="space-y-4">
          <Input label="Name" name="name" defaultValue={editing?.name || ''} />
          <Input label="Email" name="email" type="email" defaultValue={editing?.email || ''} />
          <Input label="Phone" name="phone" defaultValue={editing?.phone || ''} />
          <Input label="Company" name="company" defaultValue={editing?.company || ''} />
          <Input label="Title" name="title" defaultValue={editing?.title || ''} />
          <Select label="Status" name="status" options={['active', 'unsubscribed', 'bounced', 'invalid']} defaultValue={editing?.status || 'active'} />
          <Input label="Tags (comma-separated)" name="tags" defaultValue={editing?.tags?.join(', ') || ''} onChange={(e: any) => { const input = e.target; input._tags = e.target.value.split(',').map((t: string) => t.trim()).filter(Boolean); }} />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => { setShowModal(false); setEditing(null); }}>Cancel</Button>
            <Button type="submit" disabled={saveLead.isPending}>{saveLead.isPending ? 'Saving...' : 'Save'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
