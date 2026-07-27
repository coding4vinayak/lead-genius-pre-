import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import Integrations from './Integrations';

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
        <Integrations />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('Integrations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render page header', () => {
    mockApi.default.get.mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(screen.getByText('Integrations')).toBeInTheDocument();
    expect(screen.getByText('Manage channel connections and monitor delivery health')).toBeInTheDocument();
  });

  it('should show skeleton loaders while loading', () => {
    mockApi.default.get.mockReturnValue(new Promise(() => {}));
    const { container } = renderPage();
    expect(container.querySelectorAll('.animate-shimmer').length).toBeGreaterThan(0);
  });

  it('should show email and whatsapp channel cards', async () => {
    mockApi.default.get.mockImplementation((url: string) => {
      if (url === '/channel-health') {
        return Promise.resolve({
          data: {
            data: {
              email: { connected: true, deliveryRate: 95, sentToday: 120, dailyLimit: 500, bounceRate: 2, complaintRate: 0.1, spf: true, dkim: true, dmarc: false },
              whatsapp: { connected: true, deliveryRate: 98, sentToday: 50, dailyLimit: 1000 },
            },
          },
        });
      }
      if (url === '/whatsapp-templates') {
        return Promise.resolve({ data: { data: [{ id: '1', name: 'Welcome Template', status: 'approved', language: 'en' }] } });
      }
      return Promise.resolve({ data: { data: [] } });
    });
    renderPage();
    expect(await screen.findByText('Email')).toBeInTheDocument();
    expect(screen.getByText('WhatsApp')).toBeInTheDocument();
    expect(screen.getByText('SMTP / SendGrid')).toBeInTheDocument();
    expect(screen.getByText('Twilio Business API')).toBeInTheDocument();
  });

  it('should show channel health overview', async () => {
    mockApi.default.get.mockImplementation((url: string) => {
      if (url === '/channel-health') {
        return Promise.resolve({
          data: {
            data: {
              email: { connected: true, deliveryRate: 90, sentToday: 100, dailyLimit: 500, bounceRate: 3, complaintRate: 0.5, spf: true, dkim: true, dmarc: true },
              whatsapp: { connected: false, deliveryRate: 0, sentToday: 0, dailyLimit: 1000 },
            },
          },
        });
      }
      return Promise.resolve({ data: { data: [] } });
    });
    renderPage();
    expect(await screen.findByText('Channel Health Overview')).toBeInTheDocument();
  });

  it('should show test connection buttons', async () => {
    mockApi.default.get.mockImplementation((url: string) => {
      if (url === '/channel-health') {
        return Promise.resolve({
          data: {
            data: {
              email: { connected: true, deliveryRate: 95, sentToday: 0, dailyLimit: 500, bounceRate: 0, complaintRate: 0, spf: true, dkim: true, dmarc: true },
              whatsapp: { connected: true, deliveryRate: 98, sentToday: 0, dailyLimit: 1000 },
            },
          },
        });
      }
      return Promise.resolve({ data: { data: [] } });
    });
    renderPage();
    const buttons = await screen.findAllByText('Test Connection');
    expect(buttons.length).toBe(2);
  });

  it('should show error banner on error', async () => {
    mockApi.default.get.mockImplementation((url: string) => {
      if (url === '/channel-health') {
        return Promise.reject(new Error('Network error'));
      }
      return Promise.resolve({ data: { data: [] } });
    });
    renderPage();
    expect(await screen.findByText('Network error')).toBeInTheDocument();
  });
});
