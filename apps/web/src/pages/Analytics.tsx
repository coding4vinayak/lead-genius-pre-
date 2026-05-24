import { useQuery } from '@tanstack/react-query';
import { Card, Spinner, ErrorBanner, PageHeader } from '../components/ui';
import api from '../lib/api';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

export default function Analytics() {
  const overview = useQuery({ queryKey: ['analytics-overview'], queryFn: () => api.get('/analytics/overview').then((r) => r.data.data) });
  const byCampaign = useQuery({ queryKey: ['analytics-by-campaign'], queryFn: () => api.get('/analytics/by-campaign').then((r) => r.data.data) });
  const timeline = useQuery({ queryKey: ['analytics-timeline-30'], queryFn: () => api.get('/analytics/timeline?days=30').then((r) => r.data.data) });

  if (overview.error) return <ErrorBanner message={overview.error.message} onRetry={() => overview.refetch()} />;
  if (overview.isLoading) return <Spinner />;

  const d = overview.data;

  return (
    <div>
      <PageHeader title="Analytics" description="Detailed metrics and reports" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Sent', value: d.totalSent, color: 'text-indigo-600' },
          { label: 'Delivered', value: d.totalDelivered, color: 'text-green-600' },
          { label: 'Failed', value: d.totalFailed, color: 'text-red-500' },
          { label: 'Replies', value: d.totalReplied, color: 'text-blue-600' },
        ].map((kpi) => (
          <Card key={kpi.label} className="p-4">
            <p className="text-sm text-gray-500">{kpi.label}</p>
            <p className={`text-2xl font-bold ${kpi.color}`}>{kpi.value}</p>
          </Card>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-4">
          <h3 className="text-sm font-semibold mb-4">Sends (Last 30 Days)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={timeline.data || []}>
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="sent" fill="#6366f1" radius={[4, 4, 0, 0]} />
              <Bar dataKey="delivered" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
        <Card className="p-4">
          <h3 className="text-sm font-semibold mb-4">Per Campaign</h3>
          <div className="space-y-3 max-h-[300px] overflow-y-auto">
            {byCampaign.data?.map((c: any) => (
              <div key={c.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                <span className="text-sm font-medium">{c.name}</span>
                <div className="flex gap-3 text-xs">
                  <span>Sent: <strong>{c.sentCount}</strong></span>
                  <span className="text-green-600">Replies: <strong>{c.replyCount}</strong></span>
                  <span className="text-red-500">Failed: <strong>{c.failedCount}</strong></span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
