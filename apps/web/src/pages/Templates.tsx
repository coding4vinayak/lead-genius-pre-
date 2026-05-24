import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Mail, MessageCircle, Eye } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../lib/api';
import { Card, Button, Input, Select, Modal, Spinner, EmptyState, ErrorBanner, PageHeader, Badge } from '../components/ui';

export default function Templates() {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [channel, setChannel] = useState('email');
  const [preview, setPreview] = useState<any>(null);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['templates', channel],
    queryFn: () => api.get('/templates', { params: { channel } }).then((r) => r.data.data),
  });

  const saveTemplate = useMutation({
    mutationFn: (body: any) => editing ? api.put(`/templates/${editing.id}`, body) : api.post('/templates', body),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['templates'] }); toast.success(editing ? 'Template updated' : 'Template created'); setShowModal(false); setEditing(null); },
  });

  const deleteTemplate = useMutation({
    mutationFn: (id: string) => api.delete(`/templates/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['templates'] }); toast.success('Template deleted'); },
  });

  if (error) return <ErrorBanner message={error.message} onRetry={() => refetch()} />;

  const variableHelp = 'Available: {{name}}, {{email}}, {{phone}}, {{company}}, {{title}}';

  return (
    <div>
      <PageHeader title="Templates" description="Message templates with variable support" action={<Button onClick={() => { setEditing(null); setShowModal(true); }}><Plus size={16} /><span className="ml-1">New Template</span></Button>} />

      <div className="flex gap-2 mb-4">
        <Button variant={channel === 'email' ? 'primary' : 'secondary'} size="sm" onClick={() => setChannel('email')}><Mail size={14} className="mr-1" />Email</Button>
        <Button variant={channel === 'whatsapp' ? 'primary' : 'secondary'} size="sm" onClick={() => setChannel('whatsapp')}><MessageCircle size={14} className="mr-1" />WhatsApp</Button>
      </div>

      {isLoading ? <Spinner /> : data?.length === 0 ? <EmptyState title="No templates" description="Create your first template" action={<Button onClick={() => setShowModal(true)}>Create Template</Button>} /> : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {data?.map((tpl: any) => (
            <Card key={tpl.id} className="p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold">{tpl.name}</h3>
                <Badge variant={tpl.channel === 'email' ? 'info' : 'warning'}>{tpl.channel}</Badge>
              </div>
              {tpl.category && <p className="text-xs text-gray-400 mb-2">{tpl.category}</p>}
              <p className="text-sm text-gray-500 line-clamp-2 mb-3">{tpl.body}</p>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => api.post(`/templates/${tpl.id}/preview`, { variables: { name: 'John', email: 'john@test.com' } }).then((r) => setPreview(r.data.data))}><Eye size={14} className="mr-1" />Preview</Button>
                <Button variant="ghost" size="sm" onClick={() => { setEditing(tpl); setShowModal(true); }}>Edit</Button>
                <Button variant="ghost" size="sm" className="text-red-500" onClick={() => deleteTemplate.mutate(tpl.id)}>Delete</Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {preview && (
        <Modal isOpen={true} onClose={() => setPreview(null)} title="Template Preview">
          {preview.subject && <p className="text-sm font-medium mb-2">Subject: {preview.subject}</p>}
          <div className="p-3 bg-gray-50 rounded-lg text-sm whitespace-pre-wrap">{preview.body}</div>
        </Modal>
      )}

      <Modal isOpen={showModal} onClose={() => { setShowModal(false); setEditing(null); }} title={editing ? 'Edit Template' : 'New Template'}>
        <form onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); saveTemplate.mutate({ name: fd.get('name'), channel: fd.get('channel'), subject: fd.get('subject'), body: fd.get('body'), category: fd.get('category'), variables: (fd.get('body') as string || '').match(/\{\{(\w+)\}\}/g)?.map((v: string) => v.replace(/[{}]/g, '')) || [] }); }} className="space-y-4">
          <Input label="Template Name" name="name" defaultValue={editing?.name || ''} required />
          <Select label="Channel" name="channel" options={['email', 'whatsapp']} defaultValue={editing?.channel || 'email'} />
          <Input label="Category (e.g. festival, offer, followup)" name="category" defaultValue={editing?.category || ''} />
          <Input label="Subject (email only)" name="subject" defaultValue={editing?.subject || ''} />
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">Body (Handlebars)</label>
            <p className="text-xs text-gray-400">{variableHelp}</p>
            <textarea name="body" rows={8} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]" defaultValue={editing?.body || ''} required />
          </div>
          <div className="flex justify-end gap-2"><Button variant="secondary" type="button" onClick={() => { setShowModal(false); setEditing(null); }}>Cancel</Button><Button type="submit">Save</Button></div>
        </form>
      </Modal>
    </div>
  );
}
