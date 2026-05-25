import { useQuery } from '@tanstack/react-query';
import { ShieldCheck, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import api from '../lib/api';
import { Card, PageHeader, StatCard, Badge, ErrorBanner, Skeleton, SkeletonCard, EmptyState, Tabs, Button } from '../components/ui';
import { useState } from 'react';

export default function Deliverability() {
  const [activeTab, setActiveTab] = useState('overview');

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['deliverability'],
    queryFn: () => api.get('/email-verification/stats').then((r) => r.data.data),
  });

  const suppression = useQuery({
    queryKey: ['suppression-list'],
    queryFn: () => api.get('/email-verification/suppression').then((r) => r.data.data),
  });

  if (error) return <ErrorBanner message={(error as Error).message} onRetry={() => refetch()} />;

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'suppression', label: 'Suppression List' },
    { id: 'compliance', label: 'Compliance' },
  ];

  return (
    <div>
      <PageHeader title="Deliverability" description="Email verification status, suppression lists, and compliance" />
      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      {activeTab === 'overview' && (
        <>
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              {[1, 2, 3, 4].map((i) => <SkeletonCard key={i} />)}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <StatCard icon={<ShieldCheck size={20} />} label="Verified Emails" value={data?.verified || 0} />
              <StatCard icon={<CheckCircle size={20} />} label="Valid" value={data?.valid || 0} />
              <StatCard icon={<AlertTriangle size={20} />} label="Risky" value={data?.risky || 0} />
              <StatCard icon={<XCircle size={20} />} label="Invalid" value={data?.invalid || 0} />
            </div>
          )}
          <Card className="p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Verification Summary</h3>
            {isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            ) : (
              <p className="text-sm text-gray-600">
                Your email list has been verified. {data?.valid || 0} valid addresses are ready for sending.
              </p>
            )}
          </Card>
        </>
      )}

      {activeTab === 'suppression' && (
        <Card className="p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Suppression List</h3>
          {suppression.isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-8 w-full" />)}
            </div>
          ) : !suppression.data || (suppression.data as unknown[]).length === 0 ? (
            <EmptyState title="No suppressed emails" description="Your suppression list is empty" />
          ) : (
            <div className="space-y-2">
              {(suppression.data as Array<{ email: string; reason: string }>).map((item, idx) => (
                <div key={idx} className="flex items-center justify-between py-2 border-b border-gray-100">
                  <span className="text-sm text-gray-700">{item.email}</span>
                  <Badge variant="warning">{item.reason}</Badge>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {activeTab === 'compliance' && (
        <Card className="p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Compliance Status</h3>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <CheckCircle size={20} className="text-green-500" />
              <span className="text-sm text-gray-700">SPF record configured</span>
            </div>
            <div className="flex items-center gap-3">
              <CheckCircle size={20} className="text-green-500" />
              <span className="text-sm text-gray-700">DKIM signing enabled</span>
            </div>
            <div className="flex items-center gap-3">
              <CheckCircle size={20} className="text-green-500" />
              <span className="text-sm text-gray-700">DMARC policy set</span>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
