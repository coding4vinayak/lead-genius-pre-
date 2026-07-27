import { useQuery, useMutation } from '@tanstack/react-query';
import { Mail, MessageSquare, Wifi, WifiOff, Shield, AlertTriangle, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../lib/api';
import { Card, Button, Badge, ErrorBanner, PageHeader, Skeleton, SkeletonCard, ProgressBar } from '../components/ui';

export default function Integrations() {
  const { data: healthData, isLoading: healthLoading, error: healthError, refetch: refetchHealth } = useQuery({
    queryKey: ['channel-health'],
    queryFn: () => api.get('/channel-health').then((r) => r.data),
    refetchInterval: 60000,
  });

  const { data: templatesData, isLoading: templatesLoading } = useQuery({
    queryKey: ['whatsapp-templates'],
    queryFn: () => api.get('/whatsapp-templates').then((r) => r.data),
  });

  const testEmailMutation = useMutation({
    mutationFn: () => api.post('/channel-health/test', { channel: 'email' }),
    onSuccess: () => toast.success('Email connection test passed'),
    onError: (err: Error) => toast.error(err.message),
  });

  const testWhatsappMutation = useMutation({
    mutationFn: () => api.post('/channel-health/test', { channel: 'whatsapp' }),
    onSuccess: () => toast.success('WhatsApp connection test passed'),
    onError: (err: Error) => toast.error(err.message),
  });

  if (healthError) return <ErrorBanner message={(healthError as Error).message} onRetry={() => refetchHealth()} />;

  const health = healthData?.data;
  const emailHealth = health?.email;
  const whatsappHealth = health?.whatsapp;
  const templates = templatesData?.data || [];

  return (
    <div>
      <PageHeader
        title="Integrations"
        description="Manage channel connections and monitor delivery health"
      />

      {healthLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Channel Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Email Integration Card */}
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
                    <Mail size={20} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">Email</h3>
                    <p className="text-xs text-gray-500">SMTP / SendGrid</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {emailHealth?.connected ? (
                    <Badge variant="success"><Wifi size={12} className="mr-1" />Connected</Badge>
                  ) : (
                    <Badge variant="danger"><WifiOff size={12} className="mr-1" />Disconnected</Badge>
                  )}
                </div>
              </div>

              {/* Domain Authentication */}
              <div className="mb-4">
                <p className="text-xs font-medium text-gray-500 mb-2">Domain Authentication</p>
                <div className="flex gap-2">
                  <Badge variant={emailHealth?.spf ? 'success' : 'warning'}>
                    <Shield size={10} className="mr-1" />SPF
                  </Badge>
                  <Badge variant={emailHealth?.dkim ? 'success' : 'warning'}>
                    <Shield size={10} className="mr-1" />DKIM
                  </Badge>
                  <Badge variant={emailHealth?.dmarc ? 'success' : 'warning'}>
                    <Shield size={10} className="mr-1" />DMARC
                  </Badge>
                </div>
              </div>

              {/* Delivery Rate */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-medium text-gray-500">Delivery Rate</p>
                  <p className="text-sm font-semibold text-gray-900">{emailHealth?.deliveryRate ?? 0}%</p>
                </div>
                <ProgressBar value={emailHealth?.deliveryRate ?? 0} />
              </div>

              {/* Daily Counters */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="text-center p-2 bg-gray-50 rounded-lg">
                  <p className="text-lg font-bold text-gray-900">{emailHealth?.sentToday ?? 0}</p>
                  <p className="text-xs text-gray-500">Sent Today</p>
                </div>
                <div className="text-center p-2 bg-gray-50 rounded-lg">
                  <p className="text-lg font-bold text-gray-900">{emailHealth?.dailyLimit ?? 0}</p>
                  <p className="text-xs text-gray-500">Daily Limit</p>
                </div>
              </div>

              <Button
                variant="secondary"
                size="sm"
                onClick={() => testEmailMutation.mutate()}
                disabled={testEmailMutation.isPending}
                className="w-full"
              >
                {testEmailMutation.isPending ? 'Testing...' : 'Test Connection'}
              </Button>
            </Card>

            {/* WhatsApp Integration Card */}
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-green-50 text-green-600">
                    <MessageSquare size={20} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">WhatsApp</h3>
                    <p className="text-xs text-gray-500">Twilio Business API</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {whatsappHealth?.connected ? (
                    <Badge variant="success"><Wifi size={12} className="mr-1" />Connected</Badge>
                  ) : (
                    <Badge variant="danger"><WifiOff size={12} className="mr-1" />Disconnected</Badge>
                  )}
                </div>
              </div>

              {/* Session vs Template info */}
              <div className="mb-4">
                <p className="text-xs font-medium text-gray-500 mb-2">Message Types</p>
                <div className="flex gap-2">
                  <Badge variant="info">Template Messages</Badge>
                  <Badge variant="default">Session Messages</Badge>
                </div>
              </div>

              {/* Delivery Rate */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-medium text-gray-500">Delivery Rate</p>
                  <p className="text-sm font-semibold text-gray-900">{whatsappHealth?.deliveryRate ?? 0}%</p>
                </div>
                <ProgressBar value={whatsappHealth?.deliveryRate ?? 0} />
              </div>

              {/* Quota */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="text-center p-2 bg-gray-50 rounded-lg">
                  <p className="text-lg font-bold text-gray-900">{whatsappHealth?.sentToday ?? 0}</p>
                  <p className="text-xs text-gray-500">Sent Today</p>
                </div>
                <div className="text-center p-2 bg-gray-50 rounded-lg">
                  <p className="text-lg font-bold text-gray-900">{whatsappHealth?.dailyLimit ?? 0}</p>
                  <p className="text-xs text-gray-500">Daily Limit</p>
                </div>
              </div>

              <Button
                variant="secondary"
                size="sm"
                onClick={() => testWhatsappMutation.mutate()}
                disabled={testWhatsappMutation.isPending}
                className="w-full"
              >
                {testWhatsappMutation.isPending ? 'Testing...' : 'Test Connection'}
              </Button>
            </Card>
          </div>

          {/* Channel Health Dashboard */}
          <Card className="p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Channel Health Overview</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-3 rounded-lg border border-gray-200">
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle size={14} className="text-green-500" />
                  <p className="text-xs text-gray-500">Overall Delivery</p>
                </div>
                <p className="text-xl font-bold text-gray-900">
                  {health ? Math.round(((emailHealth?.deliveryRate ?? 0) + (whatsappHealth?.deliveryRate ?? 0)) / 2) : 0}%
                </p>
              </div>
              <div className="p-3 rounded-lg border border-gray-200">
                <div className="flex items-center gap-2 mb-1">
                  <AlertTriangle size={14} className="text-yellow-500" />
                  <p className="text-xs text-gray-500">Bounce Rate</p>
                </div>
                <p className="text-xl font-bold text-gray-900">{emailHealth?.bounceRate ?? 0}%</p>
              </div>
              <div className="p-3 rounded-lg border border-gray-200">
                <div className="flex items-center gap-2 mb-1">
                  <AlertTriangle size={14} className="text-red-500" />
                  <p className="text-xs text-gray-500">Complaint Rate</p>
                </div>
                <p className="text-xl font-bold text-gray-900">{emailHealth?.complaintRate ?? 0}%</p>
              </div>
              <div className="p-3 rounded-lg border border-gray-200">
                <div className="flex items-center gap-2 mb-1">
                  <Mail size={14} className="text-blue-500" />
                  <p className="text-xs text-gray-500">Total Sent Today</p>
                </div>
                <p className="text-xl font-bold text-gray-900">
                  {(emailHealth?.sentToday ?? 0) + (whatsappHealth?.sentToday ?? 0)}
                </p>
              </div>
            </div>
          </Card>

          {/* WhatsApp Templates */}
          {!templatesLoading && templates.length > 0 && (
            <Card className="p-6">
              <h3 className="font-semibold text-gray-900 mb-4">WhatsApp Templates</h3>
              <div className="space-y-2">
                {templates.map((tpl: Record<string, unknown>) => (
                  <div key={tpl.id as string} className="flex items-center justify-between p-3 rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{tpl.name as string}</p>
                      <p className="text-xs text-gray-500">{tpl.language as string || 'en'}</p>
                    </div>
                    <Badge variant={(tpl.status as string) === 'approved' ? 'success' : (tpl.status as string) === 'rejected' ? 'danger' : 'warning'}>
                      {tpl.status as string}
                    </Badge>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
