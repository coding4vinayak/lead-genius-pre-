import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '../lib/api';
import { Card, Button, Input, Spinner, ErrorBanner, PageHeader } from '../components/ui';

export default function Settings() {
  const queryClient = useQueryClient();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['settings'],
    queryFn: () => api.get('/settings').then((r) => r.data.data),
  });

  const saveSettings = useMutation({
    mutationFn: (body: any) => api.put('/settings', body),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['settings'] }); toast.success('Settings saved'); },
  });

  const testEmail = useMutation({ mutationFn: (to: string) => api.post('/settings/test-email', { to }), onSuccess: () => toast.success('Test email sent') });
  const testWhatsApp = useMutation({ mutationFn: (to: string) => api.post('/settings/test-whatsapp', { to }), onSuccess: () => toast.success('Test WhatsApp sent') });

  if (error) return <ErrorBanner message={error.message} onRetry={() => refetch()} />;
  if (isLoading) return <Spinner />;

  return (
    <div>
      <PageHeader title="Settings" description="Configure email, WhatsApp, and global limits" />
      <form onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); saveSettings.mutate(Object.fromEntries(fd)); }} className="space-y-6">
        <Card className="p-4">
          <h3 className="font-semibold mb-4">Email (SMTP)</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="SMTP Host" name="smtpHost" defaultValue={data?.smtpHost || ''} />
            <Input label="SMTP Port" name="smtpPort" type="number" defaultValue={data?.smtpPort || 587} />
            <Input label="SMTP User" name="smtpUser" defaultValue={data?.smtpUser || ''} />
            <Input label="SMTP Pass" name="smtpPass" type="password" defaultValue={data?.smtpPass || ''} />
            <Input label="From Email" name="fromEmail" defaultValue={data?.fromEmail || ''} />
            <Input label="From Name" name="fromName" defaultValue={data?.fromName || ''} />
          </div>
        </Card>
        <Card className="p-4">
          <h3 className="font-semibold mb-4">WhatsApp (Twilio)</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="Account SID" name="twilioAccountSid" defaultValue={data?.twilioAccountSid || ''} />
            <Input label="Auth Token" name="twilioAuthToken" type="password" defaultValue={data?.twilioAuthToken || ''} />
            <Input label="From Number (with country code)" name="twilioFromNumber" defaultValue={data?.twilioFromNumber || ''} />
          </div>
        </Card>
        <Card className="p-4">
          <h3 className="font-semibold mb-4">Global Limits</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="Daily Global Limit" name="dailyGlobalLimit" type="number" defaultValue={data?.dailyGlobalLimit || 1000} />
            <Input label="Default Min Delay (ms)" name="defaultMinDelayMs" type="number" defaultValue={data?.defaultMinDelayMs || 30000} />
          </div>
        </Card>
        <div className="flex gap-3">
          <Button type="submit" disabled={saveSettings.isPending}>{saveSettings.isPending ? 'Saving...' : 'Save Settings'}</Button>
          <Button type="button" variant="secondary" onClick={() => { const to = prompt('Send test email to:'); if (to) testEmail.mutate(to); }}>Test Email</Button>
          <Button type="button" variant="secondary" onClick={() => { const to = prompt('Send test WhatsApp to:'); if (to) testWhatsApp.mutate(to); }}>Test WhatsApp</Button>
        </div>
      </form>
    </div>
  );
}
