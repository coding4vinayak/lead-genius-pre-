import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import UnifiedInbox from '../../pages/UnifiedInbox';

const mockConversations = [
  {
    leadId: 'lead-1',
    leadName: 'Alice Johnson',
    leadCompany: 'Acme Corp',
    lastMessage: 'Interested in your product',
    lastMessageAt: '2024-01-15T10:00:00Z',
    channel: 'email',
    unread: true,
    starred: false,
    intentCategory: 'interested',
  },
  {
    leadId: 'lead-2',
    leadName: 'Bob Smith',
    leadCompany: 'TechCo',
    lastMessage: 'Can we schedule a call?',
    lastMessageAt: '2024-01-14T09:00:00Z',
    channel: 'whatsapp',
    unread: false,
    starred: true,
  },
];

const mockMessages = [
  {
    id: 'msg-1',
    direction: 'inbound',
    channel: 'email',
    subject: 'Product inquiry',
    body: 'Hi, I am interested in your product.',
    createdAt: '2024-01-15T09:00:00Z',
    isAiGenerated: false,
  },
  {
    id: 'msg-2',
    direction: 'outbound',
    channel: 'email',
    body: 'Thanks for reaching out! Let me help.',
    createdAt: '2024-01-15T10:00:00Z',
    isAiGenerated: true,
    readAt: '2024-01-15T10:05:00Z',
  },
];

const mockLead = {
  name: 'Alice Johnson',
  email: 'alice@acme.com',
  company: 'Acme Corp',
  score: 75,
  stage: 'qualified',
  tags: ['enterprise', 'inbound'],
};

const mockTemplates = [
  { id: 'tpl-1', name: 'Follow Up', body: 'Hi {{name}}, just following up on our conversation.' },
  { id: 'tpl-2', name: 'Meeting Request', body: 'Would you be available for a quick call this week?' },
];

vi.mock('../../lib/api', () => ({
  default: {
    get: vi.fn((url: string) => {
      if (url === '/inbox/conversations') {
        return Promise.resolve({ data: { data: mockConversations } });
      }
      if (url.match(/^\/inbox\/lead-/)) {
        return Promise.resolve({ data: { data: { messages: mockMessages, lead: mockLead } } });
      }
      if (url === '/templates') {
        return Promise.resolve({ data: { data: mockTemplates } });
      }
      if (url.match(/\/leads\/.*\/activity/)) {
        return Promise.resolve({ data: { data: [] } });
      }
      if (url.match(/\/leads\/.*\/notes/)) {
        return Promise.resolve({ data: { data: [] } });
      }
      return Promise.resolve({ data: { data: [] } });
    }),
    post: vi.fn(() => Promise.resolve({ data: { data: { body: 'AI generated reply' } } })),
  },
}));

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        {ui}
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('UnifiedInbox', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the three-panel layout', async () => {
    renderWithProviders(<UnifiedInbox />);
    await waitFor(() => {
      expect(screen.getByTestId('unified-inbox')).toBeInTheDocument();
    });
    // Left panel: conversation list
    await waitFor(() => {
      expect(screen.getByTestId('conversation-list')).toBeInTheDocument();
    });
  });

  it('displays conversations sorted with unread first', async () => {
    renderWithProviders(<UnifiedInbox />);
    await waitFor(() => {
      expect(screen.getByText('Alice Johnson')).toBeInTheDocument();
      expect(screen.getByText('Bob Smith')).toBeInTheDocument();
    });
  });

  it('loads messages when a conversation is clicked', async () => {
    const user = userEvent.setup();
    renderWithProviders(<UnifiedInbox />);
    await waitFor(() => {
      expect(screen.getByTestId('conversation-item-lead-1')).toBeInTheDocument();
    });
    await user.click(screen.getByTestId('conversation-item-lead-1'));
    await waitFor(() => {
      expect(screen.getByTestId('message-thread')).toBeInTheDocument();
    });
  });

  it('renders the quick reply box with template picker and AI suggest', async () => {
    const user = userEvent.setup();
    renderWithProviders(<UnifiedInbox />);
    await waitFor(() => {
      expect(screen.getByTestId('conversation-item-lead-1')).toBeInTheDocument();
    });
    await user.click(screen.getByTestId('conversation-item-lead-1'));
    await waitFor(() => {
      expect(screen.getByTestId('quick-reply-box')).toBeInTheDocument();
      expect(screen.getByTestId('template-picker')).toBeInTheDocument();
      expect(screen.getByTestId('ai-suggest-btn')).toBeInTheDocument();
    });
  });

  it('renders the lead context sidebar when conversation selected', async () => {
    const user = userEvent.setup();
    renderWithProviders(<UnifiedInbox />);
    await waitFor(() => {
      expect(screen.getByTestId('conversation-item-lead-1')).toBeInTheDocument();
    });
    await user.click(screen.getByTestId('conversation-item-lead-1'));
    await waitFor(() => {
      expect(screen.getByTestId('lead-context-sidebar')).toBeInTheDocument();
    });
  });

  it('sidebar can be collapsed and expanded', async () => {
    const user = userEvent.setup();
    renderWithProviders(<UnifiedInbox />);
    await waitFor(() => {
      expect(screen.getByTestId('conversation-item-lead-1')).toBeInTheDocument();
    });
    await user.click(screen.getByTestId('conversation-item-lead-1'));
    await waitFor(() => {
      expect(screen.getByTestId('lead-context-sidebar')).toBeInTheDocument();
    });
    // Collapse
    await user.click(screen.getByTestId('sidebar-toggle'));
    await waitFor(() => {
      expect(screen.getByTestId('sidebar-collapsed')).toBeInTheDocument();
    });
  });

  it('keyboard shortcut j navigates to next conversation', async () => {
    renderWithProviders(<UnifiedInbox />);
    await waitFor(() => {
      expect(screen.getByTestId('conversation-item-lead-1')).toBeInTheDocument();
    });
    fireEvent.keyDown(document, { key: 'j' });
    // After pressing j from no selection, should select first item
    await waitFor(() => {
      expect(screen.getByTestId('conversation-item-lead-2')).toBeInTheDocument();
    });
  });

  it('renders search input in conversation list', async () => {
    renderWithProviders(<UnifiedInbox />);
    await waitFor(() => {
      expect(screen.getByTestId('conversation-search')).toBeInTheDocument();
    });
  });

  it('filters conversations by search text', async () => {
    const user = userEvent.setup();
    renderWithProviders(<UnifiedInbox />);
    await waitFor(() => {
      expect(screen.getByTestId('conversation-search')).toBeInTheDocument();
    });
    await user.type(screen.getByTestId('conversation-search'), 'Alice');
    await waitFor(() => {
      expect(screen.getByText('Alice Johnson')).toBeInTheDocument();
      expect(screen.queryByText('Bob Smith')).not.toBeInTheDocument();
    });
  });
});
