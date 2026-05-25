import { Mail, MessageSquare, Linkedin, User, Bot, CheckCheck } from 'lucide-react';
import { Badge } from '../ui';

export interface Message {
  id: string;
  direction: 'inbound' | 'outbound';
  channel: 'email' | 'whatsapp' | 'linkedin';
  subject?: string;
  body: string;
  createdAt: string;
  isAiGenerated?: boolean;
  readAt?: string;
  intentAnalysis?: {
    category?: string;
    sentiment?: string;
  };
}

interface MessageThreadProps {
  messages: Message[];
  leadName: string;
}

const CHANNEL_ICONS = {
  email: Mail,
  whatsapp: MessageSquare,
  linkedin: Linkedin,
};

const CHANNEL_COLORS = {
  email: 'text-blue-500',
  whatsapp: 'text-green-500',
  linkedin: 'text-[#0A66C2]',
};

export default function MessageThread({ messages, leadName }: MessageThreadProps) {
  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4" data-testid="message-thread">
      {messages.map((msg) => {
        const isInbound = msg.direction === 'inbound';
        const ChannelIcon = CHANNEL_ICONS[msg.channel] || Mail;
        const channelColor = CHANNEL_COLORS[msg.channel] || 'text-gray-400';

        return (
          <div key={msg.id} className={`flex ${isInbound ? 'justify-start' : 'justify-end'}`} data-testid={`message-${msg.id}`}>
            <div className={`max-w-[70%] rounded-lg p-3 ${isInbound ? 'bg-[var(--color-surface-tertiary)]' : 'bg-blue-500 text-white'}`}>
              <div className="flex items-center gap-2 mb-1">
                {isInbound ? <User size={14} /> : <Bot size={14} />}
                <span className="text-xs font-medium">{isInbound ? leadName : 'You'}</span>
                <ChannelIcon size={12} className={isInbound ? channelColor : 'text-blue-200'} />
                {msg.isAiGenerated && <Badge variant="info">AI</Badge>}
              </div>
              {msg.subject && (
                <p className={`text-xs mb-1 ${isInbound ? 'text-gray-500' : 'text-blue-200'}`}>
                  {msg.subject}
                </p>
              )}
              <p className="text-sm whitespace-pre-wrap">{msg.body}</p>
              <div className="flex items-center justify-between mt-2">
                <span className={`text-xs ${isInbound ? 'text-gray-400' : 'text-blue-200'}`}>
                  {new Date(msg.createdAt).toLocaleString()}
                </span>
                {!isInbound && msg.readAt && (
                  <CheckCheck size={12} className="text-blue-200" />
                )}
              </div>
              {msg.intentAnalysis?.category && (
                <div className="mt-2 flex gap-1">
                  <Badge variant="default">{msg.intentAnalysis.category}</Badge>
                  {msg.intentAnalysis.sentiment && (
                    <Badge variant={msg.intentAnalysis.sentiment === 'positive' ? 'success' : msg.intentAnalysis.sentiment === 'negative' ? 'danger' : 'default'}>
                      {msg.intentAnalysis.sentiment}
                    </Badge>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
