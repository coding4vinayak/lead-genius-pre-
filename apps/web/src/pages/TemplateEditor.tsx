import { useState, useRef, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Save } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../lib/api';
import { Button, Input, Select, Spinner } from '../components/ui';
import RichTextToolbar from '../components/templates/RichTextToolbar';
import VariableInsertMenu from '../components/templates/VariableInsertMenu';
import TemplatePreview from '../components/templates/TemplatePreview';
import SpamScoreIndicator from '../components/templates/SpamScoreIndicator';
import { checkSpam } from '../lib/spamChecker';
import type { FlaggedWord } from '../lib/spamChecker';

export default function TemplateEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isEdit = !!id;

  const [name, setName] = useState('');
  const [channel, setChannel] = useState('email');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [category, setCategory] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { isLoading } = useQuery({
    queryKey: ['template', id],
    queryFn: () => api.get(`/templates/${id}`).then((r) => r.data.data),
    enabled: isEdit,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    select: (data: any) => {
      if (data && !name && !body) {
        setName(data.name || '');
        setChannel(data.channel || 'email');
        setSubject(data.subject || '');
        setBody(data.body || '');
        setCategory(data.category || '');
      }
      return data;
    },
  });

  const saveMutation = useMutation({
    mutationFn: (payload: { name: string; channel: string; subject: string; body: string; category: string; status?: string }) =>
      isEdit ? api.put(`/templates/${id}`, payload) : api.post('/templates', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      toast.success(isEdit ? 'Template updated' : 'Template created');
      navigate('/templates');
    },
  });

  const spamResult = useMemo(() => checkSpam(body), [body]);

  const charCount = body.length;
  const wordCount = body.trim() ? body.trim().split(/\s+/).length : 0;

  const insertAtCursor = useCallback((text: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const newBody = body.slice(0, start) + text + body.slice(end);
    setBody(newBody);
    // Restore cursor position after insertion
    setTimeout(() => {
      textarea.focus();
      textarea.selectionStart = start + text.length;
      textarea.selectionEnd = start + text.length;
    }, 0);
  }, [body]);

  const handleToolbarAction = useCallback((action: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = body.slice(start, end);

    let replacement = '';
    switch (action) {
      case 'bold':
        replacement = `**${selected || 'text'}**`;
        break;
      case 'italic':
        replacement = `*${selected || 'text'}*`;
        break;
      case 'link':
        replacement = `[${selected || 'link text'}](url)`;
        break;
      case 'image':
        replacement = `![${selected || 'alt text'}](image_url)`;
        break;
      case 'align-left':
        replacement = selected || '';
        break;
      case 'align-center':
        replacement = `<center>${selected || 'text'}</center>`;
        break;
      case 'align-right':
        replacement = `<div style="text-align:right">${selected || 'text'}</div>`;
        break;
      default:
        return;
    }

    const newBody = body.slice(0, start) + replacement + body.slice(end);
    setBody(newBody);
    setTimeout(() => {
      textarea.focus();
      textarea.selectionStart = start + replacement.length;
      textarea.selectionEnd = start + replacement.length;
    }, 0);
  }, [body]);

  const handleSave = (status: string) => {
    if (!name.trim()) {
      toast.error('Template name is required');
      return;
    }
    if (!body.trim()) {
      toast.error('Template body is required');
      return;
    }
    saveMutation.mutate({
      name,
      channel,
      subject,
      body,
      category,
      status,
    });
  };

  const getHighlightedBody = (): React.ReactNode[] => {
    if (spamResult.flaggedWords.length === 0) return [];

    // Sort flagged words by position
    const sorted = [...spamResult.flaggedWords].sort((a, b) => a.index - b.index);

    // Remove overlapping entries
    const deduped: FlaggedWord[] = [];
    let lastEnd = -1;
    for (const fw of sorted) {
      if (fw.index >= lastEnd) {
        deduped.push(fw);
        lastEnd = fw.index + fw.length;
      }
    }

    return deduped.map((fw) => (
      <span
        key={`${fw.index}-${fw.word}`}
        className="absolute bg-red-100 border-b-2 border-red-400 pointer-events-none"
        style={{
          // Highlighting is informational only via the SpamScoreIndicator
        }}
        title={fw.reason}
      />
    ));
  };

  // We still call getHighlightedBody for potential use
  getHighlightedBody();

  if (isEdit && isLoading) return <Spinner />;

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Top bar */}
      <div className="flex items-center gap-3 p-4 border-b border-[var(--color-border)] bg-[var(--color-surface)] shrink-0">
        <Button variant="ghost" size="sm" onClick={() => navigate('/templates')} type="button">
          <ArrowLeft size={16} />
        </Button>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Template name..."
          className="text-lg font-semibold bg-transparent border-none outline-none flex-1 min-w-0"
        />
        <Select
          options={['email', 'whatsapp']}
          value={channel}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setChannel(e.target.value)}
        />
        <Button variant="secondary" size="sm" onClick={() => handleSave('draft')} type="button">
          <Save size={14} className="mr-1" />
          Save Draft
        </Button>
        <Button size="sm" onClick={() => handleSave('active')} type="button">
          <Save size={14} className="mr-1" />
          Save Template
        </Button>
      </div>

      {/* Split pane */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left pane - Editor */}
        <div className="flex-1 flex flex-col border-r border-[var(--color-border)] min-w-0">
          {/* Toolbar row */}
          <div className="flex items-center gap-2 px-4 pt-3">
            <VariableInsertMenu onInsert={insertAtCursor} />
          </div>

          {/* Subject (email only) */}
          {channel === 'email' && (
            <div className="px-4 pt-3">
              <Input
                label="Subject Line"
                value={subject}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSubject(e.target.value)}
                placeholder="Enter email subject..."
              />
            </div>
          )}

          {channel === 'email' && (
            <div className="px-4 pt-2">
              <Input
                label="Category"
                value={category}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCategory(e.target.value)}
                placeholder="e.g. festival, offer, followup"
              />
            </div>
          )}

          {/* Rich text toolbar + textarea */}
          <div className="flex-1 flex flex-col px-4 pt-3 pb-2 min-h-0">
            <RichTextToolbar onAction={handleToolbarAction} />
            <div className="relative flex-1 min-h-0">
              <textarea
                ref={textareaRef}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Write your template body here... Use {{variables}} for personalization."
                className="w-full h-full resize-none px-3 py-3 border border-t-0 border-[var(--color-border)] rounded-b-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent bg-[var(--color-surface)]"
                data-testid="template-body-input"
              />
            </div>
          </div>

          {/* Footer: word/char count + spam score */}
          <div className="px-4 pb-3 flex items-start gap-4 shrink-0">
            <div className="flex-1">
              <div className="text-xs text-[var(--color-text-secondary)] mb-2">
                {charCount} characters &middot; {wordCount} words
              </div>
              {/* Spam word highlights list */}
              {spamResult.flaggedWords.length > 0 && (
                <div className="text-xs text-red-600 space-y-0.5">
                  {[...new Set(spamResult.flaggedWords.map((fw) => fw.word.toLowerCase()))].map((word) => {
                    const fw = spamResult.flaggedWords.find((f) => f.word.toLowerCase() === word);
                    return (
                      <span key={word} className="inline-block mr-2 px-1.5 py-0.5 bg-red-50 border border-red-200 rounded text-red-700" title={fw?.reason}>
                        <span className="underline decoration-red-400">{word}</span>
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="w-56 shrink-0">
              <SpamScoreIndicator result={spamResult} />
            </div>
          </div>
        </div>

        {/* Right pane - Preview */}
        <div className="flex-1 flex flex-col min-w-0">
          <TemplatePreview content={body} subject={channel === 'email' ? subject : undefined} />
        </div>
      </div>
    </div>
  );
}
