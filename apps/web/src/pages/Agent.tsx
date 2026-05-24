import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bot, Settings, ToggleLeft, ToggleRight, Save, RotateCcw, Sparkles } from 'lucide-react';
import api from '../lib/api';
import { Card, Button, Input, Select, Badge, Spinner, ErrorBanner, PageHeader } from '../components/ui';
import toast from 'react-hot-toast';

export default function Agent() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<any>({
    aiProvider: 'openai',
    aiModel: 'gpt-4o-mini',
    aiApiKey: '',
    aiBaseUrl: '',
    tone: 'professional',
    autoReplyThreshold: 70,
    isAutoPilotActive: false,
    maxDailyReplies: 50,
    workingHoursStart: '09:00',
    workingHoursEnd: '17:00',
  });

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['agent-settings'],
    queryFn: () => api.get('/agent').then((r) => r.data),
  });

  useEffect(() => {
    if (data?.data) {
      setForm({
        aiProvider: data.data.aiProvider || 'openai',
        aiModel: data.data.aiModel || 'gpt-4o-mini',
        aiApiKey: data.data.aiApiKey || '',
        aiBaseUrl: data.data.aiBaseUrl || '',
        tone: data.data.tone || 'professional',
        autoReplyThreshold: data.data.autoReplyThreshold ?? 70,
        isAutoPilotActive: data.data.isAutoPilotActive || false,
        maxDailyReplies: data.data.maxDailyReplies ?? 50,
        workingHoursStart: data.data.workingHoursStart || '09:00',
        workingHoursEnd: data.data.workingHoursEnd || '17:00',
      });
    }
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: (settings: any) => api.put('/agent', settings),
    onSuccess: () => {
      toast.success('Agent settings saved');
      queryClient.invalidateQueries({ queryKey: ['agent-settings'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const toggleMutation = useMutation({
    mutationFn: () => api.post('/agent/toggle-autopilot'),
    onSuccess: (res) => {
      setForm((prev: any) => ({ ...prev, isAutoPilotActive: res.data.data.isAutoPilotActive }));
      toast.success(res.data.data.isAutoPilotActive ? 'Auto-pilot enabled' : 'Auto-pilot disabled');
      queryClient.invalidateQueries({ queryKey: ['agent-settings'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (error) return <ErrorBanner message={(error as Error).message} onRetry={() => refetch()} />;
  if (isLoading) return <Spinner />;

  return (
    <div>
      <PageHeader
        title="AI Agent"
        description="Configure your AI sales agent settings"
        action={
          <Button
            variant={form.isAutoPilotActive ? 'danger' : 'primary'}
            onClick={() => toggleMutation.mutate()}
            disabled={toggleMutation.isPending}
          >
            {form.isAutoPilotActive ? <ToggleRight size={18} className="mr-1" /> : <ToggleLeft size={18} className="mr-1" />}
            {form.isAutoPilotActive ? 'Disable Auto-pilot' : 'Enable Auto-pilot'}
          </Button>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card className="p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Bot size={20} /> AI Model Configuration
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Select
                label="AI Provider"
                value={form.aiProvider}
                onChange={(e: any) => setForm((prev: any) => ({ ...prev, aiProvider: e.target.value }))}
                options={[
                  { value: 'openai', label: 'OpenAI' },
                  { value: 'gemini', label: 'Gemini' },
                  { value: 'anthropic', label: 'Anthropic' },
                ]}
              />
              <Input
                label="Model"
                value={form.aiModel}
                onChange={(e: any) => setForm((prev: any) => ({ ...prev, aiModel: e.target.value }))}
                placeholder="gpt-4o-mini"
              />
              <Input
                label="API Key"
                type="password"
                value={form.aiApiKey}
                onChange={(e: any) => setForm((prev: any) => ({ ...prev, aiApiKey: e.target.value }))}
                placeholder="sk-..."
              />
              <Input
                label="API Base URL (optional)"
                value={form.aiBaseUrl}
                onChange={(e: any) => setForm((prev: any) => ({ ...prev, aiBaseUrl: e.target.value }))}
                placeholder="https://api.openai.com/v1"
              />
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Sparkles size={20} /> Reply Settings
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Select
                label="Default Tone"
                value={form.tone}
                onChange={(e: any) => setForm((prev: any) => ({ ...prev, tone: e.target.value }))}
                options={[
                  { value: 'professional', label: 'Professional' },
                  { value: 'friendly', label: 'Friendly' },
                  { value: 'casual', label: 'Casual' },
                  { value: 'formal', label: 'Formal' },
                ]}
              />
              <Input
                label="Auto-reply Confidence Threshold (%)"
                type="number"
                min={0}
                max={100}
                value={form.autoReplyThreshold}
                onChange={(e: any) => setForm((prev: any) => ({ ...prev, autoReplyThreshold: parseInt(e.target.value) || 70 }))}
              />
              <Input
                label="Max Daily Auto-replies"
                type="number"
                min={1}
                value={form.maxDailyReplies}
                onChange={(e: any) => setForm((prev: any) => ({ ...prev, maxDailyReplies: parseInt(e.target.value) || 50 }))}
              />
              <Input
                label="Working Hours Start"
                type="time"
                value={form.workingHoursStart}
                onChange={(e: any) => setForm((prev: any) => ({ ...prev, workingHoursStart: e.target.value }))}
              />
              <Input
                label="Working Hours End"
                type="time"
                value={form.workingHoursEnd}
                onChange={(e: any) => setForm((prev: any) => ({ ...prev, workingHoursEnd: e.target.value }))}
              />
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="p-6">
            <h2 className="text-lg font-semibold mb-4">Auto-pilot Status</h2>
            <div className="flex flex-col items-center text-center">
              <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-4 ${form.isAutoPilotActive ? 'bg-green-100' : 'bg-gray-100'}`}>
                <Bot size={36} className={form.isAutoPilotActive ? 'text-green-600' : 'text-gray-400'} />
              </div>
              <Badge variant={form.isAutoPilotActive ? 'success' : 'default'}>
                {form.isAutoPilotActive ? 'Active' : 'Inactive'}
              </Badge>
              <p className="text-sm text-gray-500 mt-3">
                {form.isAutoPilotActive
                  ? 'Auto-pilot will automatically analyze intent and reply to leads within configured thresholds.'
                  : 'Auto-pilot is disabled. AI features work in manual mode.'}
              </p>
              <div className="w-full mt-4 pt-4 border-t border-gray-200">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-500">Model</span>
                  <span className="font-medium">{form.aiModel}</span>
                </div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-500">Provider</span>
                  <span className="font-medium capitalize">{form.aiProvider}</span>
                </div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-500">Max Replies/Day</span>
                  <span className="font-medium">{form.maxDailyReplies}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Threshold</span>
                  <span className="font-medium">{form.autoReplyThreshold}%</span>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>

      <div className="mt-6 flex justify-end gap-3">
        <Button variant="secondary" onClick={() => refetch()}>
          <RotateCcw size={16} className="mr-1" /> Reset
        </Button>
        <Button variant="primary" onClick={() => saveMutation.mutate(form)} disabled={saveMutation.isPending}>
          <Save size={16} className="mr-1" /> Save Settings
        </Button>
      </div>
    </div>
  );
}
