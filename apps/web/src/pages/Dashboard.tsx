import { useQuery } from '@tanstack/react-query';
import { Card, Spinner, ErrorBanner, PageHeader } from '../components/ui';
import api from '../lib/api';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444'];

export default function Dashboard() {
  const overview = useQuery({
    queryKey: ['analytics-overview'],
    queryFn: () => api.get('/analytics/overview').then((r) => r.data.data),
    refetchInterval: 30000,
  });
  const timeline = useQuery({
    queryKey: ['analytics-timeline'],
    queryFn: () => api.get('/analytics/timeline?days=7').then((r) => r.data.data),
  });
  const breakdown = useQuery({
    queryKey: ['analytics-breakdown'],
    queryFn: () => api.get('/analytics/channel-breakdown').then((r) => r.data.data),
  });

  if (overview.error) return <ErrorBanner message={overview.error.message} onRetry={() => overview.refetch()} />;
  if (overview.isLoading) return <Spinner />;

  const d = overview.data;
  const kpis = [
    { label: 'Total Leads', value: d.totalLeads, color: 'text-blue-600' },
    { label: 'Active Campaigns', value: d.activeCampaigns, color: 'text-green-600' },
    { label: 'Sent Today', value: d.totalSent, color: 'text-indigo-600' },
    { label: 'Delivery Rate', value: `${d.deliveryRate}%`, color: 'text-emerald-600' },
  ];

  return (
    <div>
      <PageHeader title="Dashboard" description="Real-time overview of your communication engine" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {kpis.map((kpi) => (
          <Card key={kpi.label} className="p-4">
            <p className="text-sm text-gray-500 mb-1">{kpi.label}</p>
            <p className={`text-2xl font-bold ${kpi.color}`}>{kpi.value}</p>
          </Card>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Sends (Last 7 Days)</h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={timeline.data || []}>
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Line type="monotone" dataKey="sent" stroke="#6366f1" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="delivered" stroke="#10b981" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </Card>
        <Card className="p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Channel Breakdown</h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie data={[
                { name: 'Email', value: breakdown.data?.email || 0 },
                { name: 'WhatsApp', value: breakdown.data?.whatsapp || 0 },
              ]} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                {COLORS.slice(0, 2).map((c) => <Cell key={c} fill={c} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </Card>
      </div>
    </div>
  );
}
