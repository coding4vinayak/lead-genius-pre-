import { useState } from 'react';
import { Mail, MessageSquare, Linkedin, Star, Search, Filter, ChevronDown } from 'lucide-react';
import { Badge } from '../ui';

export interface Conversation {
  leadId: string;
  leadName: string;
  leadCompany?: string;
  lastMessage: string;
  lastMessageAt: string;
  channel: 'email' | 'whatsapp' | 'linkedin';
  unread: boolean;
  starred: boolean;
  assignedTo?: string;
  intentCategory?: string;
}

interface ConversationListProps {
  conversations: Conversation[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onStar: (id: string) => void;
  onAssign: (id: string, userId: string) => void;
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

export default function ConversationList({ conversations, selectedId, onSelect, onStar, onAssign }: ConversationListProps) {
  const [search, setSearch] = useState('');
  const [filterChannel, setFilterChannel] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);

  const filtered = conversations
    .filter((c) => {
      if (search && !c.leadName.toLowerCase().includes(search.toLowerCase()) && !c.lastMessage.toLowerCase().includes(search.toLowerCase())) {
        return false;
      }
      if (filterChannel !== 'all' && c.channel !== filterChannel) return false;
      return true;
    })
    .sort((a, b) => {
      if (a.unread && !b.unread) return -1;
      if (!a.unread && b.unread) return 1;
      return new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime();
    });

  return (
    <div className="flex flex-col h-full" data-testid="conversation-list">
      <div className="p-3 border-b border-gray-200 space-y-2">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-2.5 text-gray-400" />
          <input
            type="text"
            placeholder="Search conversations..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent"
            data-testid="conversation-search"
          />
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-100"
            data-testid="filter-toggle"
          >
            <Filter size={12} /> Filters <ChevronDown size={10} />
          </button>
        </div>
        {showFilters && (
          <div className="flex gap-2" data-testid="filter-dropdown">
            <select
              value={filterChannel}
              onChange={(e) => setFilterChannel(e.target.value)}
              className="text-xs border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
            >
              <option value="all">All Channels</option>
              <option value="email">Email</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="linkedin">LinkedIn</option>
            </select>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
        {filtered.map((conv) => {
          const ChannelIcon = CHANNEL_ICONS[conv.channel] || Mail;
          const channelColor = CHANNEL_COLORS[conv.channel] || 'text-gray-400';

          return (
            <div
              key={conv.leadId}
              onClick={() => onSelect(conv.leadId)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onSelect(conv.leadId); }}
              className={`w-full text-left p-3 hover:bg-gray-50 transition-colors relative cursor-pointer ${
                selectedId === conv.leadId ? 'bg-blue-50' : ''
              }`}
              data-testid={`conversation-item-${conv.leadId}`}
            >
              <div className="flex items-start gap-2">
                {conv.unread && (
                  <div className="w-2 h-2 rounded-full bg-blue-500 mt-2 shrink-0" data-testid="unread-dot" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className={`text-sm truncate ${conv.unread ? 'font-semibold' : 'font-medium'}`}>
                      {conv.leadName}
                    </span>
                    <div className="flex items-center gap-1 shrink-0 ml-2">
                      <ChannelIcon size={12} className={channelColor} />
                      <button
                        onClick={(e) => { e.stopPropagation(); onStar(conv.leadId); }}
                        className="hover:text-yellow-500 transition-colors"
                        data-testid={`star-btn-${conv.leadId}`}
                      >
                        <Star size={12} className={conv.starred ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'} />
                      </button>
                    </div>
                  </div>
                  {conv.leadCompany && (
                    <p className="text-xs text-gray-500 truncate">{conv.leadCompany}</p>
                  )}
                  <p className="text-xs text-gray-400 truncate mt-0.5">{conv.lastMessage}</p>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-xs text-gray-400">
                      {conv.lastMessageAt ? new Date(conv.lastMessageAt).toLocaleString() : ''}
                    </span>
                    {conv.intentCategory && (
                      <Badge variant="default">{conv.intentCategory}</Badge>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
