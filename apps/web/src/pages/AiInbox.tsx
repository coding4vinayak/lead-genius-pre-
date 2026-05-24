import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bot, Send, RefreshCw, Sparkles, User, ChevronRight, ChevronLeft } from 'lucide-react';
import api from '../lib/api';
import { Card, Button, Badge, Spinner, EmptyState, ErrorBanner, PageHeader } from '../components/ui';
import toast from 'react-hot-toast';

const INTENT_COLORS: Record<string, string> = {
  interested: 'success',
  meeting_request: 'info',
  pricing_question: 'warning',
  feature_question: 'info',
  not_interested: 'danger',
  out_of_office: 'default',
  competitor_mention: 'warning',
  spam: 'danger',
  other: 'default',
};

export default function AiInbox() {
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [draftText, setDraftText] = useState('');
  const queryClient = useQueryClient();

  const { data: conversationsData, isLoading: convLoading, error: convError, refetch: refetchConvs } = useQuery({
    queryKey: ['inbox-conversations'],
    queryFn: () => api.get('/inbox/conversations').then((r) => r.data),
    refetchInterval: 30000,
  });

  const { data: conversationData, isLoading: msgLoading } = useQuery({
    queryKey: ['inbox-conversation', selectedLeadId],
    queryFn: () => api.get(`/inbox/${selectedLeadId}`).then((r) => r.data),
    enabled: !!selectedLeadId,
    refetchInterval: 15000,
  });

  const analyzeMutation = useMutation({
    mutationFn: (messageId: string) => api.post(`/inbox/${messageId}/analyze`),
    onSuccess: () => {
      toast.success('Intent analyzed');
      queryClient.invalidateQueries({ queryKey: ['inbox-conversations'] });
      if (selectedLeadId) {
        queryClient.invalidateQueries({ queryKey: ['inbox-conversation', selectedLeadId] });
      }
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const draftMutation = useMutation({
    mutationFn: (messageId: string) => api.post('/ai/generate-draft', { messageId }),
    onSuccess: (res) => {
      setDraftText(res.data.data.body || '');
      setReplyText(res.data.data.body || '');
      toast.success('AI draft generated');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const sendDraftMutation = useMutation({
    mutationFn: ({ messageId, draftBody }: { messageId: string; draftBody: string }) =>
      api.post(`/inbox/${messageId}/send-draft`, { draftBody }),
    onSuccess: () => {
      toast.success('Reply sent');
      setReplyText('');
      setDraftText('');
      if (selectedLeadId) {
        queryClient.invalidateQueries({ queryKey: ['inbox-conversation', selectedLeadId] });
      }
      queryClient.invalidateQueries({ queryKey: ['inbox-conversations'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const conversations = conversationsData?.data || [];
  const messages = conversationData?.data?.messages || [];
  const selectedLead = conversationData?.data?.lead;

  if (convError) return <ErrorBanner message={(convError as Error).message} onRetry={() => refetchConvs()} />;

  return (
    <div>
      <PageHeader title="AI Inbox" description="AI-powered conversation management with intent analysis and smart replies" />
      <div className="flex gap-4 h-[calc(100vh-12rem)]">
        <Card className="w-80 shrink-0 overflow-y-auto">
          {convLoading ? <Spinner /> : conversations.length === 0 ? (
            <EmptyState title="No conversations" description="Inbound messages will appear here" />
          ) : (
            <div className="divide-y divide-gray-100">
              {conversations.map((conv: any) => (
                <button
                  key={conv.leadId}
                  onClick={() => setSelectedLeadId(conv.leadId)}
                  className={`w-full text-left p-3 hover:bg-gray-50 transition-colors ${selectedLeadId === conv.leadId ? 'bg-blue-50' : ''}`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-sm truncate">{conv.leadName}</span>
                    {conv.intentCategory && (
                      <Badge variant={INTENT_COLORS[conv.intentCategory] || 'default'}>
                        {conv.intentCategory}
                      </Badge>
                    )}
                  </div>
                  {conv.leadCompany && <p className="text-xs text-gray-500 mb-1">{conv.leadCompany}</p>}
                  <p className="text-xs text-gray-400 truncate">{conv.lastMessage}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    {conv.lastMessageAt ? new Date(conv.lastMessageAt).toLocaleString() : ''}
                  </p>
                </button>
              ))}
            </div>
          )}
        </Card>

        <Card className="flex-1 flex flex-col overflow-hidden">
          {!selectedLeadId ? (
            <div className="flex-1 flex items-center justify-center">
              <EmptyState title="Select a conversation" description="Choose a conversation from the left to view messages" />
            </div>
          ) : msgLoading ? (
            <Spinner />
          ) : (
            <>
              <div className="p-4 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="font-semibold">{selectedLead?.name || selectedLead?.email || 'Unknown'}</h2>
                    {selectedLead?.company && <p className="text-sm text-gray-500">{selectedLead.company}</p>}
                  </div>
                  <div className="flex gap-2">
                    {selectedLead?.score && (
                      <Badge variant={selectedLead.score >= 70 ? 'success' : selectedLead.score >= 40 ? 'warning' : 'default'}>
                        Score: {selectedLead.score}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.map((msg: any) => {
                  const isInbound = msg.direction === 'inbound';
                  const intent = msg.intentAnalysis as Record<string, any> | null;
                  return (
                    <div key={msg.id} className={`flex ${isInbound ? 'justify-start' : 'justify-end'}`}>
                      <div className={`max-w-[70%] rounded-lg p-3 ${isInbound ? 'bg-gray-100' : 'bg-blue-500 text-white'}`}>
                        <div className="flex items-center gap-2 mb-1">
                          {isInbound ? <User size={14} /> : <Bot size={14} />}
                          <span className="text-xs font-medium">{isInbound ? 'Lead' : 'You'}</span>
                          {msg.isAiGenerated && <Badge variant="info">AI</Badge>}
                        </div>
                        {msg.subject && <p className="text-xs opacity-70 mb-1">{msg.subject}</p>}
                        <p className="text-sm whitespace-pre-wrap">{msg.body}</p>
                        {isInbound && !msg.intentAnalysis && (
                          <button
                            onClick={() => analyzeMutation.mutate(msg.id)}
                            className="mt-2 text-xs flex items-center gap-1 text-blue-500 hover:text-blue-700"
                          >
                            <Sparkles size={12} /> Analyze intent
                          </button>
                        )}
                        {intent && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            <Badge variant={INTENT_COLORS[intent.category as string] || 'default'}>
                              {intent.category as string}
                            </Badge>
                            {intent.sentiment && (
                              <Badge variant={intent.sentiment === 'positive' ? 'success' : intent.sentiment === 'negative' ? 'danger' : 'default'}>
                                {intent.sentiment as string}
                              </Badge>
                            )}
                          </div>
                        )}
                        <p className="text-xs opacity-50 mt-1">{new Date(msg.createdAt).toLocaleString()}</p>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="border-t border-gray-200 p-4">
                {draftText && (
                  <div className="mb-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Sparkles size={16} className="text-yellow-600" />
                      <span className="text-sm font-medium text-yellow-800">AI Suggested Reply</span>
                      <button
                        onClick={() => { setDraftText(''); setReplyText(''); }}
                        className="ml-auto text-xs text-gray-500 hover:text-gray-700"
                      >
                        Clear
                      </button>
                    </div>
                    <textarea
                      className="w-full text-sm p-2 border border-yellow-300 rounded resize-none focus:outline-none focus:ring-1 focus:ring-yellow-400"
                      rows={3}
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                    />
                    <div className="flex gap-2 mt-2">
                      <Button size="sm" variant="primary" onClick={() => {
                        const lastInbound = [...messages].reverse().find((m: any) => m.direction === 'inbound');
                        if (lastInbound) sendDraftMutation.mutate({ messageId: lastInbound.id, draftBody: replyText });
                      }}>
                        <Send size={14} className="mr-1" /> Send Reply
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => draftMutation.mutate(messages.filter((m: any) => m.direction === 'inbound').slice(-1)[0]?.id)}>
                        <RefreshCw size={14} className="mr-1" /> Regenerate
                      </Button>
                    </div>
                  </div>
                )}
                <div className="flex gap-2">
                  <textarea
                    className="flex-1 text-sm p-2 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                    rows={2}
                    placeholder="Type a reply or generate AI draft..."
                    value={draftText ? replyText : ''}
                    onChange={(e) => {
                      setReplyText(e.target.value);
                      if (!draftText) setReplyText(e.target.value);
                    }}
                  />
                  <div className="flex flex-col gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        const lastInbound = [...messages].reverse().find((m: any) => m.direction === 'inbound');
                        if (lastInbound) draftMutation.mutate(lastInbound.id);
                      }}
                      disabled={draftMutation.isPending}
                      title="Generate AI reply"
                    >
                      <Sparkles size={16} />
                    </Button>
                    <Button
                      size="sm"
                      variant="primary"
                      onClick={() => {
                        const lastInbound = [...messages].reverse().find((m: any) => m.direction === 'inbound');
                        if (lastInbound && replyText) sendDraftMutation.mutate({ messageId: lastInbound.id, draftBody: replyText });
                      }}
                      disabled={!replyText || sendDraftMutation.isPending}
                    >
                      <Send size={16} />
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
