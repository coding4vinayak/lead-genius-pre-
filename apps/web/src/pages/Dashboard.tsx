import { useQuery } from '@tanstack/react-query';
import { BarChart3, Send, Users, TrendingUp } from 'lucide-react';
import { Card, ErrorBanner, PageHeader, StatCard, Skeleton, SkeletonCard } from '../components/ui';
import { CountUp } from '../components/ui/CountUp';
import { AnimatedList } from '../components/ui/AnimatedList';
import OnboardingChecklist from '../components/onboarding/OnboardingChecklist';
import api from '../lib/api';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444'];

function DashboardSkeleton() {
  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] p-4 space-y-3">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-16" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SkeletonCard />
        <SkeletonCard />
      </div>
    </div>
  );
}

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
  if (overview.isLoading) return <DashboardSkeleton />;

  const d = overview.data;

  return (
    <div>
      <PageHeader title="Dashboard" description="Real-time overview of your communication engine" />
      <AnimatedList className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          key="total-leads"
          icon={<Users size={20} />}
          label="Total Leads"
          value={<CountUp value={d.totalLeads} />}
        />
        <StatCard
          key="active-campaigns"
          icon={<BarChart3 size={20} />}
          label="Active Campaigns"
          value={<CountUp value={d.activeCampaigns} />}
        />
        <StatCard
          key="sent-today"
          icon={<Send size={20} />}
          label="Sent Today"
          value={<CountUp value={d.totalSent} />}
        />
        <StatCard
          key="delivery-rate"
          icon={<TrendingUp size={20} />}
          label="Delivery Rate"
          value={<CountUp value={d.deliveryRate} suffix="%" />}
        />
      </AnimatedList>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-4">
          <h3 className="text-sm font-semibold text-[var(--color-text-secondary)] mb-4">Sends (Last 7 Days)</h3>
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
          <h3 className="text-sm font-semibold text-[var(--color-text-secondary)] mb-4">Channel Breakdown</h3>
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
      <div className="mt-6">
        <OnboardingChecklist />
      </div>
    </div>
  );
}
