import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Layout from './Layout';
import { useAppStore } from '../../store';

function renderLayout() {
  return render(
    <MemoryRouter>
      <Layout><div>Page Content</div></Layout>
    </MemoryRouter>,
  );
}

describe('Layout', () => {
  beforeEach(() => {
    useAppStore.setState({ sidebarCollapsed: false });
  });

  it('should render sidebar and children', () => {
    renderLayout();
    expect(screen.getByText('Page Content')).toBeInTheDocument();
  });

  it('should render main content area', () => {
    renderLayout();
    const main = document.querySelector('main');
    expect(main).toBeInTheDocument();
  });

  it('should show LeadGenius brand in sidebar when expanded', () => {
    useAppStore.setState({ sidebarCollapsed: false });
    renderLayout();
    expect(screen.getByText('LeadGenius')).toBeInTheDocument();
  });

  it('should adjust spacing based on sidebar state', () => {
    useAppStore.setState({ sidebarCollapsed: true });
    renderLayout();
    const sidebar = document.querySelector('aside');
    expect(sidebar?.className).toContain('w-16');
  });
});
