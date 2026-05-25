import { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';
import { Card, Spinner, EmptyState, ErrorBanner, PageHeader } from '../components/ui';
import ConversationList from '../components/inbox/ConversationList';
import MessageThread from '../components/inbox/MessageThread';
import QuickReplyBox from '../components/inbox/QuickReplyBox';
import LeadContextSidebar from '../components/inbox/LeadContextSidebar';
import type { Conversation } from '../components/inbox/ConversationList';
import type { Message } from '../components/inbox/MessageThread';

export default function UnifiedInbox() {
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
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

  const starMutation = useMutation({
    mutationFn: (leadId: string) => api.post(`/inbox/${leadId}/star`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['inbox-conversations'] }),
  });

  const markReadMutation = useMutation({
    mutationFn: (leadId: string) => api.post(`/inbox/${leadId}/mark-read`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['inbox-conversations'] }),
  });

  const conversations: Conversation[] = (conversationsData?.data || []).map((c: Record<string, unknown>) => ({
    leadId: c.leadId as string,
    leadName: c.leadName as string,
    leadCompany: c.leadCompany as string | undefined,
    lastMessage: c.lastMessage as string,
    lastMessageAt: c.lastMessageAt as string,
    channel: (c.channel as string) || 'email',
    unread: c.unread !== false,
    starred: c.starred === true,
    assignedTo: c.assignedTo as string | undefined,
    intentCategory: c.intentCategory as string | undefined,
  }));

  const messages: Message[] = (conversationData?.data?.messages || []).map((m: Record<string, unknown>) => ({
    id: m.id as string,
    direction: m.direction as 'inbound' | 'outbound',
    channel: (m.channel as string) || 'email',
    subject: m.subject as string | undefined,
    body: m.body as string,
    createdAt: m.createdAt as string,
    isAiGenerated: m.isAiGenerated as boolean | undefined,
    readAt: m.readAt as string | undefined,
    intentAnalysis: m.intentAnalysis as { category?: string; sentiment?: string } | undefined,
  }));

  const lead = conversationData?.data?.lead || {};
  const lastInboundMessage = [...messages].reverse().find((m) => m.direction === 'inbound');

  // Use refs for keyboard handler to avoid re-registering on every poll cycle
  const conversationsRef = useRef(conversations);
  conversationsRef.current = conversations;

  const selectedLeadIdRef = useRef(selectedLeadId);
  selectedLeadIdRef.current = selectedLeadId;

  // Keyboard shortcuts
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') return;

    if (e.key === 'j' || e.key === 'k') {
      e.preventDefault();
      const convs = conversationsRef.current;
      const currentIdx = convs.findIndex((c) => c.leadId === selectedLeadIdRef.current);
      let newIdx: number;
      if (e.key === 'j') {
        newIdx = currentIdx < convs.length - 1 ? currentIdx + 1 : currentIdx;
      } else {
        newIdx = currentIdx > 0 ? currentIdx - 1 : 0;
      }
      if (convs[newIdx]) {
        setSelectedLeadId(convs[newIdx].leadId);
      }
    }

    if (e.key === 'r') {
      e.preventDefault();
      const textarea = document.querySelector('[data-testid="reply-textarea"]') as HTMLTextAreaElement | null;
      textarea?.focus();
    }

    if (e.key === 's' && selectedLeadIdRef.current) {
      e.preventDefault();
      starMutation.mutate(selectedLeadIdRef.current);
    }

    if (e.key === 'a' && selectedLeadIdRef.current) {
      e.preventDefault();
      markReadMutation.mutate(selectedLeadIdRef.current);
    }
  }, [starMutation, markReadMutation]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const handleStar = (leadId: string) => {
    starMutation.mutate(leadId);
  };

  const handleAssign = (_leadId: string, _userId: string) => {
    // Assignment handled by API
  };

  const handleSendSuccess = () => {
    if (selectedLeadId) {
      queryClient.invalidateQueries({ queryKey: ['inbox-conversation', selectedLeadId] });
    }
    queryClient.invalidateQueries({ queryKey: ['inbox-conversations'] });
  };

  if (convError) return <ErrorBanner message={(convError as Error).message} onRetry={() => refetchConvs()} />;

  return (
    <div data-testid="unified-inbox">
      <PageHeader title="Inbox" description="Unified conversations across all channels" />
      <div className="flex h-[calc(100vh-12rem)] rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden shadow-sm">
        {/* Left Panel - Conversation List */}
        <div className="w-80 shrink-0 border-r border-[var(--color-border)]">
          {convLoading ? (
            <Spinner />
          ) : conversations.length === 0 ? (
            <EmptyState title="No conversations" description="Inbound messages will appear here" />
          ) : (
            <ConversationList
              conversations={conversations}
              selectedId={selectedLeadId}
              onSelect={setSelectedLeadId}
              onStar={handleStar}
              onAssign={handleAssign}
            />
          )}
        </div>

        {/* Center Panel - Message Thread */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {!selectedLeadId ? (
            <div className="flex-1 flex items-center justify-center">
              <EmptyState title="Select a conversation" description="Choose a conversation from the left to view messages" />
            </div>
          ) : msgLoading ? (
            <Spinner />
          ) : (
            <>
              <div className="p-4 border-b border-[var(--color-border)]">
                <h2 className="font-semibold text-sm">{lead.name || lead.email || 'Unknown'}</h2>
                {lead.company && <p className="text-xs text-[var(--color-text-secondary)]">{lead.company}</p>}
              </div>
              <MessageThread messages={messages} leadName={lead.name || 'Lead'} />
              <QuickReplyBox
                leadId={selectedLeadId}
                lastInboundMessageId={lastInboundMessage?.id || null}
                onSendSuccess={handleSendSuccess}
              />
            </>
          )}
        </div>

        {/* Right Panel - Lead Context Sidebar */}
        {selectedLeadId && (
          <LeadContextSidebar
            leadId={selectedLeadId}
            lead={{
              name: lead.name || 'Unknown',
              email: lead.email,
              company: lead.company,
              score: lead.score,
              stage: lead.stage,
              tags: lead.tags || [],
              assignedTo: lead.assignedTo,
            }}
            collapsed={sidebarCollapsed}
            onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
          />
        )}
      </div>
    </div>
  );
}
