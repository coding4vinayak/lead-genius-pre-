import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore } from './index';

describe('useAppStore', () => {
  beforeEach(() => {
    useAppStore.setState({ sidebarCollapsed: false, activeFilters: {} });
  });

  it('should start with sidebar not collapsed', () => {
    expect(useAppStore.getState().sidebarCollapsed).toBe(false);
  });

  it('should toggle sidebar', () => {
    useAppStore.getState().toggleSidebar();
    expect(useAppStore.getState().sidebarCollapsed).toBe(true);

    useAppStore.getState().toggleSidebar();
    expect(useAppStore.getState().sidebarCollapsed).toBe(false);
  });

  it('should set sidebar collapsed', () => {
    useAppStore.getState().setSidebarCollapsed(true);
    expect(useAppStore.getState().sidebarCollapsed).toBe(true);
  });

  it('should set active filter for a page', () => {
    useAppStore.getState().setActiveFilter('leads', 'status', 'active');
    expect(useAppStore.getState().activeFilters.leads.status).toBe('active');
  });

  it('should clear filters for a page', () => {
    useAppStore.getState().setActiveFilter('leads', 'status', 'active');
    useAppStore.getState().setActiveFilter('leads', 'search', 'john');
    useAppStore.getState().clearFilters('leads');

    expect(useAppStore.getState().activeFilters.leads).toBeUndefined();
  });

  it('should keep filters for other pages when clearing one page', () => {
    useAppStore.getState().setActiveFilter('leads', 'status', 'active');
    useAppStore.getState().setActiveFilter('campaigns', 'status', 'running');
    useAppStore.getState().clearFilters('leads');

    expect(useAppStore.getState().activeFilters.leads).toBeUndefined();
    expect(useAppStore.getState().activeFilters.campaigns.status).toBe('running');
  });
});
