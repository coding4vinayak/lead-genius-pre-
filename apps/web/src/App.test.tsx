import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';

vi.mock('./pages/Dashboard', () => ({ default: () => <div>Dashboard Page</div> }));
vi.mock('./pages/Leads', () => ({ default: () => <div>Leads Page</div> }));
vi.mock('./pages/Campaigns', () => ({ default: () => <div>Campaigns Page</div> }));
vi.mock('./pages/Login', () => ({ default: () => <div>Login Page</div> }));
vi.mock('./pages/Signup', () => ({ default: () => <div>Signup Page</div> }));

const mockAuthStore = vi.hoisted(() => ({
  useAuthStore: vi.fn(),
}));

vi.mock('./store/auth', () => ({
  useAuthStore: mockAuthStore.useAuthStore,
}));

function renderApp(initialRoute = '/') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialRoute]}>
        <App />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('App routing', () => {
  beforeEach(() => {
    mockAuthStore.useAuthStore.mockImplementation((sel: any) => {
      const state = { isAuthenticated: true, user: { email: 'test@test.com', name: 'Test' }, token: 'abc' };
      return sel ? sel(state) : state;
    });
  });

  it('should render Dashboard at /', () => {
    renderApp('/');
    expect(screen.getByText('Dashboard Page')).toBeInTheDocument();
  });

  it('should render Leads at /leads', () => {
    renderApp('/leads');
    expect(screen.getByText('Leads Page')).toBeInTheDocument();
  });

  it('should render Campaigns at /campaigns', () => {
    renderApp('/campaigns');
    expect(screen.getByText('Campaigns Page')).toBeInTheDocument();
  });

  it('should redirect to / for unknown routes', () => {
    renderApp('/unknown-route');
    expect(screen.getByText('Dashboard Page')).toBeInTheDocument();
  });

  it('should render Login at /login', () => {
    renderApp('/login');
    expect(screen.getByText('Login Page')).toBeInTheDocument();
  });

  it('should render Signup at /signup', () => {
    renderApp('/signup');
    expect(screen.getByText('Signup Page')).toBeInTheDocument();
  });

  it('should redirect to /login when not authenticated', () => {
    mockAuthStore.useAuthStore.mockImplementation((sel: any) => {
      const state = { isAuthenticated: false, user: null, token: null };
      return sel ? sel(state) : state;
    });
    renderApp('/leads');
    expect(screen.getByText('Login Page')).toBeInTheDocument();
  });
});
