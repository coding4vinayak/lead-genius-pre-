import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Send, Sparkles, ChevronDown, FileText } from 'lucide-react';
import api from '../../lib/api';
import { Button, Spinner } from '../ui';

interface QuickReplyBoxProps {
  leadId: string;
  lastInboundMessageId: string | null;
  onSendSuccess: () => void;
}

export default function QuickReplyBox({ leadId, lastInboundMessageId, onSendSuccess }: QuickReplyBoxProps) {
  const [text, setText] = useState('');
  const [showTemplates, setShowTemplates] = useState(false);

  const { data: templatesData } = useQuery({
    queryKey: ['templates'],
    queryFn: () => api.get('/templates').then((r) => r.data),
  });

  const draftMutation = useMutation({
    mutationFn: (messageId: string) => api.post('/ai/generate-draft', { messageId }),
    onSuccess: (res) => {
      setText(res.data.data?.body || res.data.body || '');
    },
  });

  const sendMutation = useMutation({
    mutationFn: (body: { messageId: string; draftBody: string }) =>
      api.post(`/inbox/${body.messageId}/send-draft`, { draftBody: body.draftBody }),
    onSuccess: () => {
      setText('');
      onSendSuccess();
    },
  });

  const templates = templatesData?.data || [];

  const handleSend = () => {
    if (!text.trim() || !lastInboundMessageId) return;
    sendMutation.mutate({ messageId: lastInboundMessageId, draftBody: text });
  };

  const handleAiSuggest = () => {
    if (!lastInboundMessageId) return;
    draftMutation.mutate(lastInboundMessageId);
  };

  const handleTemplateSelect = (templateBody: string) => {
    setText(templateBody);
    setShowTemplates(false);
  };

  return (
    <div className="border-t border-[var(--color-border)] p-4" data-testid="quick-reply-box">
      <div className="flex items-center gap-2 mb-2">
        <div className="relative">
          <button
            onClick={() => setShowTemplates(!showTemplates)}
            className="flex items-center gap-1 text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text)] px-2 py-1 rounded hover:bg-[var(--color-surface-secondary)] border border-[var(--color-border)]"
            data-testid="template-picker"
          >
            <FileText size={12} /> Templates <ChevronDown size={10} />
          </button>
          {showTemplates && (
            <div className="absolute bottom-full left-0 mb-1 w-64 bg-[var(--color-surface)] rounded-lg shadow-lg border border-[var(--color-border)] py-1 z-50 max-h-48 overflow-y-auto" data-testid="template-dropdown">
              {templates.length === 0 ? (
                <p className="text-xs text-gray-400 p-2">No templates available</p>
              ) : (
                templates.map((t: { id: string; name: string; body: string }) => (
                  <button
                    key={t.id}
                    onClick={() => handleTemplateSelect(t.body)}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-[var(--color-surface-secondary)] truncate"
                  >
                    {t.name}
                  </button>
                ))
              )}
            </div>
          )}
        </div>
        <button
          onClick={handleAiSuggest}
          disabled={draftMutation.isPending || !lastInboundMessageId}
          className="flex items-center gap-1 text-xs text-purple-600 hover:text-purple-800 px-2 py-1 rounded hover:bg-purple-50 border border-purple-200 disabled:opacity-50"
          data-testid="ai-suggest-btn"
        >
          {draftMutation.isPending ? <Spinner /> : <Sparkles size={12} />} AI Suggest
        </button>
      </div>
      <div className="flex gap-2">
        <textarea
          className="flex-1 text-sm p-2 border border-[var(--color-border)] rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent bg-[var(--color-surface)]"
          rows={3}
          placeholder="Type your reply..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          data-testid="reply-textarea"
        />
        <Button
          variant="primary"
          size="sm"
          onClick={handleSend}
          disabled={!text.trim() || sendMutation.isPending || !lastInboundMessageId}
          className="self-end"
          data-testid="send-btn"
        >
          <Send size={16} />
        </Button>
      </div>
    </div>
  );
}
