import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Plus, Mail, MessageCircle, Eye } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../lib/api';
import { Card, Button, Modal, Spinner, EmptyState, ErrorBanner, PageHeader, Badge } from '../components/ui';

export default function Templates() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [channel, setChannel] = useState('email');
  const [preview, setPreview] = useState<any>(null);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['templates', channel],
    queryFn: () => api.get('/templates', { params: { channel } }).then((r) => r.data.data),
  });

  const deleteTemplate = useMutation({
    mutationFn: (id: string) => api.delete(`/templates/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['templates'] }); toast.success('Template deleted'); },
  });

  if (error) return <ErrorBanner message={error.message} onRetry={() => refetch()} />;

  return (
    <div>
      <PageHeader title="Templates" description="Message templates with variable support" action={<Button onClick={() => navigate('/templates/new')}><Plus size={16} /><span className="ml-1">New Template</span></Button>} />

      <div className="flex gap-2 mb-4">
        <Button variant={channel === 'email' ? 'primary' : 'secondary'} size="sm" onClick={() => setChannel('email')}><Mail size={14} className="mr-1" />Email</Button>
        <Button variant={channel === 'whatsapp' ? 'primary' : 'secondary'} size="sm" onClick={() => setChannel('whatsapp')}><MessageCircle size={14} className="mr-1" />WhatsApp</Button>
      </div>

      {isLoading ? <Spinner /> : data?.length === 0 ? <EmptyState title="No templates" description="Create your first template" action={<Button onClick={() => navigate('/templates/new')}>Create Template</Button>} /> : (
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
                <Button variant="ghost" size="sm" onClick={() => navigate(`/templates/${tpl.id}/edit`)}>Edit</Button>
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
    </div>
  );
}
