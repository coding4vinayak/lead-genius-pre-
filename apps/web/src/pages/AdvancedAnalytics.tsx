import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { TrendingUp, Download, Users, DollarSign } from 'lucide-react';
import api from '../lib/api';
import { Card, Button, PageHeader, ErrorBanner, Tabs, Skeleton, SkeletonCard, StatCard, EmptyState } from '../components/ui';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

function FunnelChart({ data }: { data: Array<{ stage: string; count: number }> }) {
  if (!data || data.length === 0) return <EmptyState title="No funnel data" description="Data will appear once leads progress through stages" />;
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} layout="vertical">
        <XAxis type="number" tick={{ fontSize: 12 }} />
        <YAxis dataKey="stage" type="category" tick={{ fontSize: 12 }} width={100} />
        <Tooltip />
        <Bar dataKey="count" fill="#6366f1" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function CohortTable({ data }: { data: Array<Record<string, unknown>> }) {
  if (!data || data.length === 0) return <EmptyState title="No cohort data" description="Cohort analysis will appear once you have enough data" />;
  const headers = Object.keys(data[0]);
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200">
            {headers.map((h) => (
              <th key={h} className="text-left py-2 px-2 text-gray-500 font-medium">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, idx) => (
            <tr key={idx} className="border-b border-gray-100">
              {headers.map((h) => (
                <td key={h} className="py-2 px-2 text-gray-700">{String(row[h] ?? '')}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function AdvancedAnalytics() {
  const [activeTab, setActiveTab] = useState('funnels');

  const funnel = useQuery({
    queryKey: ['analytics-funnel'],
    queryFn: () => api.get('/analytics/funnel').then((r) => r.data.data),
  });

  const cohorts = useQuery({
    queryKey: ['analytics-cohorts'],
    queryFn: () => api.get('/analytics/cohorts').then((r) => r.data.data),
  });

  const revenue = useQuery({
    queryKey: ['analytics-revenue'],
    queryFn: () => api.get('/analytics/revenue').then((r) => r.data.data),
  });

  const tabs = [
    { id: 'funnels', label: 'Funnels' },
    { id: 'cohorts', label: 'Cohorts' },
    { id: 'revenue', label: 'Revenue Attribution' },
  ];

  const handleExport = () => {
    const csvData = JSON.stringify(funnel.data || cohorts.data || []);
    const blob = new Blob([csvData], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'analytics-export.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <PageHeader
        title="Advanced Analytics"
        description="Funnel visualization, cohort analysis, and revenue attribution"
        action={
          <Button variant="secondary" onClick={handleExport}>
            <Download size={16} className="mr-1" />
            Export CSV
          </Button>
        }
      />

      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      {activeTab === 'funnels' && (
        <Card className="p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Conversion Funnel</h3>
          {funnel.isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : funnel.error ? (
            <ErrorBanner message={(funnel.error as Error).message} onRetry={() => funnel.refetch()} />
          ) : (
            <FunnelChart data={(funnel.data as Array<{ stage: string; count: number }>) || []} />
          )}
        </Card>
      )}

      {activeTab === 'cohorts' && (
        <Card className="p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Cohort Analysis</h3>
          {cohorts.isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : cohorts.error ? (
            <ErrorBanner message={(cohorts.error as Error).message} onRetry={() => cohorts.refetch()} />
          ) : (
            <CohortTable data={(cohorts.data as Array<Record<string, unknown>>) || []} />
          )}
        </Card>
      )}

      {activeTab === 'revenue' && (
        <>
          {revenue.isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              {[1, 2, 3].map((i) => <SkeletonCard key={i} />)}
            </div>
          ) : revenue.error ? (
            <ErrorBanner message={(revenue.error as Error).message} onRetry={() => revenue.refetch()} />
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                <StatCard icon={<DollarSign size={20} />} label="Total Revenue" value={`$${(revenue.data as Record<string, unknown>)?.total || 0}`} />
                <StatCard icon={<TrendingUp size={20} />} label="Attributed" value={`$${(revenue.data as Record<string, unknown>)?.attributed || 0}`} />
                <StatCard icon={<Users size={20} />} label="Converted Leads" value={String((revenue.data as Record<string, unknown>)?.convertedLeads || 0)} />
              </div>
              <Card className="p-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-4">Revenue by Channel</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={((revenue.data as Record<string, unknown>)?.byChannel as Array<Record<string, unknown>>) || []}>
                    <XAxis dataKey="channel" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Bar dataKey="revenue" fill="#6366f1" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            </>
          )}
        </>
      )}
    </div>
  );
}
