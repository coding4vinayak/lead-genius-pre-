import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Sidebar from './Sidebar';

const mockAuthStore = vi.hoisted(() => ({
  useAuthStore: vi.fn(),
}));

vi.mock('../../store/auth', () => ({
  useAuthStore: mockAuthStore.useAuthStore,
}));

function renderSidebar(collapsed = false, onToggle = vi.fn()) {
  return render(
    <MemoryRouter>
      <Sidebar collapsed={collapsed} onToggle={onToggle} />
    </MemoryRouter>,
  );
}

describe('Sidebar', () => {
  beforeEach(() => {
    mockAuthStore.useAuthStore.mockImplementation((sel: any) => {
      const state = { user: { email: 'test@test.com', name: 'Test User' }, logout: vi.fn() };
      return sel ? sel(state) : state;
    });
  });

  it('should render navigation items', () => {
    renderSidebar();
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Leads')).toBeInTheDocument();
    expect(screen.getByText('Campaigns')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  it('should show grouped navigation with section headers', () => {
    renderSidebar();
    expect(screen.getByText('Main')).toBeInTheDocument();
    expect(screen.getByText('Outreach')).toBeInTheDocument();
    expect(screen.getByText('Communication')).toBeInTheDocument();
    expect(screen.getByText('Intelligence')).toBeInTheDocument();
    expect(screen.getByText('System')).toBeInTheDocument();
  });

  it('should show all nav items', () => {
    renderSidebar();
    const items = ['Dashboard', 'Leads', 'Sequences', 'Campaigns', 'Templates',
      'AI Inbox', 'Messages', 'Analytics', 'AI Agent', 'Integrations', 'Groups', 'Settings'];
    items.forEach((item) => {
      expect(screen.getByText(item)).toBeInTheDocument();
    });
  });

  it('should hide labels when collapsed', () => {
    renderSidebar(true);
    expect(screen.queryByText('Dashboard')).not.toBeInTheDocument();
    expect(screen.queryByText('Leads')).not.toBeInTheDocument();
  });

  it('should call onToggle when collapse button clicked', () => {
    const onToggle = vi.fn();
    renderSidebar(false, onToggle);
    const buttons = screen.getAllByRole('button');
    const toggleBtn = buttons.find((b) => b.innerHTML.includes('chevron'));
    if (toggleBtn) fireEvent.click(toggleBtn);
    expect(onToggle).toHaveBeenCalledOnce();
  });

  it('should highlight active route', () => {
    render(
      <MemoryRouter initialEntries={['/leads']}>
        <Sidebar collapsed={false} onToggle={vi.fn()} />
      </MemoryRouter>,
    );
    const activeLink = screen.getByText('Leads').closest('a');
    expect(activeLink?.className).toContain('bg-white/15');
  });

  it('should render nav icons', () => {
    renderSidebar();
    const nav = document.querySelector('nav');
    expect(nav?.querySelectorAll('svg').length).toBeGreaterThan(0);
  });
});
