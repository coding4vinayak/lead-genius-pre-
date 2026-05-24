import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Mail, MessageCircle } from 'lucide-react';
import api from '../lib/api';
import { Card, Button, Select, Badge, Spinner, EmptyState, ErrorBanner, PageHeader } from '../components/ui';

const STATUS_COLORS: Record<string, string> = { queued: 'default', sent: 'info', delivered: 'success', failed: 'danger', bounced: 'warning', replied: 'info' };

export default function Messages() {
  const [page, setPage] = useState(1);
  const [channel, setChannel] = useState('');
  const [status, setStatus] = useState('');

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['messages', page, channel, status],
    queryFn: () => api.get('/messages', { params: { page, pageSize: 50, channel: channel || undefined, status: status || undefined } }).then((r) => r.data),
    refetchInterval: 15000,
  });

  if (error) return <ErrorBanner message={error.message} onRetry={() => refetch()} />;

  const messages = data?.data || [];
  const meta = data?.meta;

  return (
    <div>
      <PageHeader title="Messages" description="All sent and received messages" />
      <Card className="mb-4 p-3">
        <div className="flex gap-3">
          <Select options={['', 'email', 'whatsapp']} value={channel} onChange={(e: any) => { setChannel(e.target.value); setPage(1); }} className="w-40" />
          <Select options={['', 'queued', 'sent', 'delivered', 'failed', 'bounced', 'replied']} value={status} onChange={(e: any) => { setStatus(e.target.value); setPage(1); }} className="w-40" />
        </div>
      </Card>

      {isLoading ? <Spinner /> : messages.length === 0 ? <EmptyState title="No messages" description="Messages will appear here when you send campaigns" /> : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="p-3 text-left font-medium text-gray-600">Lead</th>
                  <th className="p-3 text-left font-medium text-gray-600">Channel</th>
                  <th className="p-3 text-left font-medium text-gray-600">Status</th>
                  <th className="p-3 text-left font-medium text-gray-600">Campaign</th>
                  <th className="p-3 text-left font-medium text-gray-600">Sent</th>
                </tr>
              </thead>
              <tbody>
                {messages.map((msg: any) => (
                  <tr key={msg.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="p-3">{msg.lead?.name || msg.lead?.email || '—'}</td>
                    <td className="p-3">{msg.channel === 'email' ? <Mail size={14} className="text-blue-500" /> : <MessageCircle size={14} className="text-green-500" />}</td>
                    <td className="p-3"><Badge variant={STATUS_COLORS[msg.status] || 'default'}>{msg.status}</Badge></td>
                    <td className="p-3 text-gray-500">{msg.campaign?.name || '—'}</td>
                    <td className="p-3 text-gray-500 text-xs">{new Date(msg.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {meta && (
            <div className="flex items-center justify-between p-3 border-t text-sm text-gray-500">
              <span>Page {meta.page} of {meta.totalPages}</span>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
                <Button variant="secondary" size="sm" disabled={page >= meta.totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
