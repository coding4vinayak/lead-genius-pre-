import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../lib/api';
import { Card, Button, Input, Modal, Spinner, EmptyState, ErrorBanner, PageHeader, Badge } from '../components/ui';

export default function Groups() {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [viewGroup, setViewGroup] = useState<any>(null);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['groups'],
    queryFn: () => api.get('/groups').then((r) => r.data.data),
  });

  const saveGroup = useMutation({
    mutationFn: (body: any) => api.post('/groups', body),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['groups'] }); toast.success('Group created'); setShowModal(false); },
  });

  const deleteGroup = useMutation({
    mutationFn: (id: string) => api.delete(`/groups/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['groups'] }); toast.success('Group deleted'); },
  });

  if (error) return <ErrorBanner message={error.message} onRetry={() => refetch()} />;

  return (
    <div>
      <PageHeader title="Groups" description="Organize leads into groups for targeted campaigns" action={<Button onClick={() => setShowModal(true)}><Plus size={16} /><span className="ml-1">Create Group</span></Button>} />

      {isLoading ? <Spinner /> : data?.length === 0 ? <EmptyState title="No groups yet" description="Create your first lead group" action={<Button onClick={() => setShowModal(true)}>Create Group</Button>} /> : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {data?.map((group: any) => (
            <Card key={group.id} className="p-4 hover:shadow-md transition-shadow cursor-pointer" onClick={() => setViewGroup(group)}>
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center"><Users size={20} className="text-indigo-600" /></div>
                  <div><h3 className="font-semibold">{group.name}</h3><p className="text-xs text-gray-500">{group._count?.members || 0} leads</p></div>
                </div>
              </div>
              {group.description && <p className="text-sm text-gray-500">{group.description}</p>}
            </Card>
          ))}
        </div>
      )}

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Create Group">
        <form onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); saveGroup.mutate({ name: fd.get('name'), description: fd.get('description') }); }} className="space-y-4">
          <Input label="Group Name" name="name" required />
          <Input label="Description" name="description" />
          <div className="flex justify-end gap-2"><Button variant="secondary" type="button" onClick={() => setShowModal(false)}>Cancel</Button><Button type="submit">Create</Button></div>
        </form>
      </Modal>
    </div>
  );
}
