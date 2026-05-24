import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import Sequences from './Sequences';

const mockApi = vi.hoisted(() => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

vi.mock('../lib/api', () => mockApi);

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <Sequences />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('Sequences', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render page header', async () => {
    mockApi.default.get.mockResolvedValue({ data: { data: [] } });
    renderPage();
    expect(screen.getByText('Sequences')).toBeInTheDocument();
    expect(screen.getByText('Automated multi-step outreach sequences')).toBeInTheDocument();
  });

  it('should show empty state when no sequences', async () => {
    mockApi.default.get.mockResolvedValue({ data: { data: [] } });
    renderPage();
    expect(await screen.findByText('No sequences')).toBeInTheDocument();
  });

  it('should render skeleton loaders while loading', () => {
    mockApi.default.get.mockReturnValue(new Promise(() => {}));
    const { container } = renderPage();
    expect(container.querySelectorAll('.animate-shimmer').length).toBeGreaterThan(0);
  });

  it('should show create sequence button', () => {
    mockApi.default.get.mockResolvedValue({ data: { data: [] } });
    renderPage();
    expect(screen.getByText('New Sequence')).toBeInTheDocument();
  });

  it('should render sequence list', async () => {
    mockApi.default.get.mockResolvedValue({
      data: {
        data: [
          { id: '1', name: 'Welcome Series', status: 'active', description: 'Onboarding flow', triggerType: 'manual', steps: [{ type: 'send_email' }], _count: { enrollments: 5 } },
          { id: '2', name: 'Follow-up', status: 'draft', description: '', triggerType: 'manual', steps: [], _count: { enrollments: 0 } },
        ],
      },
    });
    renderPage();
    expect(await screen.findByText('Welcome Series')).toBeInTheDocument();
    expect(screen.getByText('Follow-up')).toBeInTheDocument();
  });

  it('should show tab filters', () => {
    mockApi.default.get.mockResolvedValue({ data: { data: [] } });
    renderPage();
    expect(screen.getByText('All')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('Draft')).toBeInTheDocument();
  });
});
