import { useQuery } from '@tanstack/react-query';
import { CreditCard, Zap, Receipt, ArrowUpCircle } from 'lucide-react';
import api from '../lib/api';
import { Card, Button, Badge, PageHeader, StatCard, ErrorBanner, Skeleton, SkeletonCard, ProgressBar } from '../components/ui';

function PlanCard({ name, price, features, current }: { name: string; price: string; features: string[]; current?: boolean }) {
  return (
    <Card className={`p-6 ${current ? 'ring-2 ring-[var(--color-primary)]' : ''}`}>
      {current && <Badge variant="info">Current Plan</Badge>}
      <h3 className="text-lg font-bold text-gray-900 mt-2">{name}</h3>
      <p className="text-3xl font-bold text-gray-900 my-2">{price}<span className="text-sm font-normal text-gray-500">/mo</span></p>
      <ul className="space-y-2 mb-4">
        {features.map((f) => (
          <li key={f} className="text-sm text-gray-600 flex items-center gap-2">
            <Zap size={12} className="text-[var(--color-primary)]" />
            {f}
          </li>
        ))}
      </ul>
      {!current && <Button variant="secondary" className="w-full">Upgrade</Button>}
    </Card>
  );
}

function UsageMeter({ label, used, limit }: { label: string; used: number; limit: number }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="text-gray-600">{label}</span>
        <span className="text-gray-900 font-medium">{used.toLocaleString()} / {limit.toLocaleString()}</span>
      </div>
      <ProgressBar value={used} max={limit} />
    </div>
  );
}

export default function Billing() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['billing'],
    queryFn: () => api.get('/billing').then((r) => r.data.data),
  });

  const invoices = useQuery({
    queryKey: ['invoices'],
    queryFn: () => api.get('/billing/invoices').then((r) => r.data.data),
  });

  if (error) return <ErrorBanner message={(error as Error).message} onRetry={() => refetch()} />;

  return (
    <div>
      <PageHeader title="Billing & Plans" description="Manage your subscription, usage, and invoices" />

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[1, 2, 3, 4].map((i) => <SkeletonCard key={i} />)}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatCard icon={<CreditCard size={20} />} label="Current Plan" value={String(data?.plan || 'Free')} />
            <StatCard icon={<Zap size={20} />} label="Emails Sent" value={data?.emailsSent || 0} />
            <StatCard icon={<ArrowUpCircle size={20} />} label="Contacts" value={data?.contacts || 0} />
            <StatCard icon={<Receipt size={20} />} label="Next Invoice" value={data?.nextInvoiceDate || 'N/A'} />
          </div>

          <Card className="p-6 mb-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Usage This Period</h3>
            <div className="space-y-4">
              <UsageMeter label="Emails" used={data?.emailsSent || 0} limit={data?.emailLimit || 10000} />
              <UsageMeter label="Contacts" used={data?.contacts || 0} limit={data?.contactLimit || 5000} />
              <UsageMeter label="Sequences" used={data?.sequences || 0} limit={data?.sequenceLimit || 20} />
            </div>
          </Card>
        </>
      )}

      <h3 className="text-lg font-semibold text-gray-900 mb-4">Available Plans</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <PlanCard name="Starter" price="$29" features={['5,000 emails/mo', '1,000 contacts', '5 sequences']} current={data?.plan === 'starter'} />
        <PlanCard name="Growth" price="$79" features={['25,000 emails/mo', '10,000 contacts', '50 sequences']} current={data?.plan === 'growth'} />
        <PlanCard name="Enterprise" price="$199" features={['Unlimited emails', 'Unlimited contacts', 'Unlimited sequences']} current={data?.plan === 'enterprise'} />
      </div>

      <Card className="p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Invoice History</h3>
        {invoices.isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-8 w-full" />)}
          </div>
        ) : !invoices.data || (invoices.data as unknown[]).length === 0 ? (
          <p className="text-sm text-gray-500">No invoices yet</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 text-gray-500 font-medium">Date</th>
                  <th className="text-left py-2 text-gray-500 font-medium">Amount</th>
                  <th className="text-left py-2 text-gray-500 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {(invoices.data as Array<Record<string, unknown>>).map((inv, idx) => (
                  <tr key={idx} className="border-b border-gray-100">
                    <td className="py-2 text-gray-700">{String(inv.date)}</td>
                    <td className="py-2 text-gray-700">{String(inv.amount)}</td>
                    <td className="py-2"><Badge variant={inv.status === 'paid' ? 'success' : 'warning'}>{String(inv.status)}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
