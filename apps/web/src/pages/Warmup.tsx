import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Flame, TrendingUp, Calendar, Mail } from 'lucide-react';
import api from '../lib/api';
import { Card, PageHeader, StatCard, Badge, ErrorBanner, EmptyState, Tabs, Skeleton, SkeletonCard, ProgressBar } from '../components/ui';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

export default function Warmup() {
  const [activeTab, setActiveTab] = useState('progress');

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['warmup'],
    queryFn: () => api.get('/warmup').then((r) => r.data.data),
  });

  const logs = useQuery({
    queryKey: ['warmup-logs'],
    queryFn: () => api.get('/warmup/logs').then((r) => r.data.data),
  });

  if (error) return <ErrorBanner message={(error as Error).message} onRetry={() => refetch()} />;

  const tabs = [
    { id: 'progress', label: 'Progress' },
    { id: 'schedules', label: 'Schedules' },
    { id: 'logs', label: 'Daily Logs' },
  ];

  const schedules = (data as Array<Record<string, unknown>>) || [];

  return (
    <div>
      <PageHeader title="Warm-up" description="Email warm-up schedules, progress, and daily sending logs" />
      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      {activeTab === 'progress' && (
        <>
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              {[1, 2, 3, 4].map((i) => <SkeletonCard key={i} />)}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <StatCard icon={<Flame size={20} />} label="Active Warm-ups" value={schedules.filter((s) => s.status === 'active').length} />
              <StatCard icon={<TrendingUp size={20} />} label="Avg Progress" value={schedules.length > 0 ? `${Math.round(schedules.reduce((sum, s) => sum + (Number(s.progress) || 0), 0) / schedules.length)}%` : '0%'} />
              <StatCard icon={<Calendar size={20} />} label="Days Active" value={schedules.length > 0 ? String(schedules[0].daysActive || 0) : '0'} />
              <StatCard icon={<Mail size={20} />} label="Emails Sent Today" value={schedules.reduce((sum, s) => sum + (Number(s.sentToday) || 0), 0)} />
            </div>
          )}
          <Card className="p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Warm-up Volume Over Time</h3>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={(logs.data as Array<Record<string, unknown>>) || []}>
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Line type="monotone" dataKey="sent" stroke="#6366f1" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="received" stroke="#10b981" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        </>
      )}

      {activeTab === 'schedules' && (
        <div className="space-y-4">
          {isLoading ? (
            [1, 2, 3].map((i) => <SkeletonCard key={i} />)
          ) : schedules.length === 0 ? (
            <EmptyState title="No warm-up schedules" description="Configure warm-up schedules for your email accounts" />
          ) : (
            schedules.map((schedule, idx) => (
              <Card key={idx} className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-gray-900">{String(schedule.accountEmail || schedule.email || 'Account')}</h3>
                  <Badge variant={schedule.status === 'active' ? 'success' : 'default'}>{String(schedule.status || 'inactive')}</Badge>
                </div>
                <div className="mb-2">
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>Progress</span>
                    <span>{String(schedule.progress || 0)}%</span>
                  </div>
                  <ProgressBar value={Number(schedule.progress) || 0} />
                </div>
                <p className="text-xs text-gray-500">Target: {String(schedule.targetVolume || 50)} emails/day</p>
              </Card>
            ))
          )}
        </div>
      )}

      {activeTab === 'logs' && (
        <Card className="p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Daily Logs</h3>
          {logs.isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-8 w-full" />)}
            </div>
          ) : !logs.data || (logs.data as unknown[]).length === 0 ? (
            <EmptyState title="No logs yet" description="Warm-up logs will appear here once sending begins" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 text-gray-500 font-medium">Date</th>
                    <th className="text-left py-2 text-gray-500 font-medium">Sent</th>
                    <th className="text-left py-2 text-gray-500 font-medium">Received</th>
                    <th className="text-left py-2 text-gray-500 font-medium">Bounced</th>
                  </tr>
                </thead>
                <tbody>
                  {(logs.data as Array<Record<string, unknown>>).map((log, idx) => (
                    <tr key={idx} className="border-b border-gray-100">
                      <td className="py-2 text-gray-700">{String(log.date)}</td>
                      <td className="py-2 text-gray-700">{String(log.sent || 0)}</td>
                      <td className="py-2 text-gray-700">{String(log.received || 0)}</td>
                      <td className="py-2 text-gray-700">{String(log.bounced || 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
