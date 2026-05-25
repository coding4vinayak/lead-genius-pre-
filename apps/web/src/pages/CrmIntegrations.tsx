import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link2, RefreshCw, CheckCircle, XCircle, Settings } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../lib/api';
import { Card, Button, Badge, PageHeader, ErrorBanner, EmptyState, Skeleton, SkeletonCard } from '../components/ui';

const CRM_PROVIDERS = [
  { id: 'hubspot', name: 'HubSpot', icon: '🟠', description: 'Sync contacts, deals, and activities' },
  { id: 'salesforce', name: 'Salesforce', icon: '☁️', description: 'Enterprise CRM integration' },
  { id: 'pipedrive', name: 'Pipedrive', icon: '🟢', description: 'Pipeline and deal management' },
];

export default function CrmIntegrations() {
  const queryClient = useQueryClient();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['crm-integrations'],
    queryFn: () => api.get('/integrations/crm').then((r) => r.data.data),
  });

  const connectMutation = useMutation({
    mutationFn: (provider: string) => api.post(`/integrations/crm/${provider}/connect`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-integrations'] });
      toast.success('CRM connected');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const syncMutation = useMutation({
    mutationFn: (provider: string) => api.post(`/integrations/crm/${provider}/sync`),
    onSuccess: () => toast.success('Sync started'),
    onError: (err: Error) => toast.error(err.message),
  });

  if (error) return <ErrorBanner message={(error as Error).message} onRetry={() => refetch()} />;

  const integrations = (data as Array<Record<string, unknown>>) || [];

  return (
    <div>
      <PageHeader title="CRM Integrations" description="Connect and sync with your CRM platform" />

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <SkeletonCard key={i} />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {CRM_PROVIDERS.map((provider) => {
            const connected = integrations.find((i) => i.provider === provider.id);
            return (
              <Card key={provider.id} className="p-4">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-2xl">{provider.icon}</span>
                  <div>
                    <h3 className="font-semibold text-gray-900">{provider.name}</h3>
                    <p className="text-xs text-gray-500">{provider.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 mb-3">
                  {connected ? (
                    <Badge variant="success">Connected</Badge>
                  ) : (
                    <Badge variant="default">Not Connected</Badge>
                  )}
                </div>
                <div className="flex gap-2">
                  {connected ? (
                    <>
                      <Button variant="secondary" size="sm" onClick={() => syncMutation.mutate(provider.id)}>
                        <RefreshCw size={14} className="mr-1" />Sync
                      </Button>
                      <Button variant="ghost" size="sm">
                        <Settings size={14} className="mr-1" />Configure
                      </Button>
                    </>
                  ) : (
                    <Button size="sm" onClick={() => connectMutation.mutate(provider.id)}>
                      <Link2 size={14} className="mr-1" />Connect
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Card className="p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Sync Status</h3>
        {integrations.filter((i) => i.provider).length === 0 ? (
          <EmptyState title="No integrations connected" description="Connect a CRM to see sync status" />
        ) : (
          <div className="space-y-3">
            {integrations.map((integration, idx) => (
              <div key={idx} className="flex items-center justify-between py-2 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  {integration.syncStatus === 'synced' ? (
                    <CheckCircle size={16} className="text-green-500" />
                  ) : (
                    <XCircle size={16} className="text-red-500" />
                  )}
                  <span className="text-sm text-gray-700">{String(integration.provider)}</span>
                </div>
                <span className="text-xs text-gray-500">Last sync: {String(integration.lastSync || 'Never')}</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
