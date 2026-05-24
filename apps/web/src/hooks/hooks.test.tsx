import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

const mockGet = vi.fn();
const mockPost = vi.fn();
const mockPut = vi.fn();
const mockDelete = vi.fn();

vi.mock('../lib/api', () => ({
  default: { get: mockGet, post: mockPost, put: mockPut, delete: mockDelete },
}));

function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('Hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('useLeads', () => {
    it('should fetch leads list', async () => {
      mockGet.mockResolvedValue({ data: { data: [{ id: '1', name: 'John' }], meta: { total: 1 } } });

      const { useLeads } = await import('./index');
      const { result } = renderHook(() => useLeads({ page: 1 }), { wrapper: createWrapper() });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data?.data[0].name).toBe('John');
      expect(mockGet).toHaveBeenCalledWith('/leads', { params: { page: 1 } });
    });
  });

  describe('useLead', () => {
    it('should fetch single lead', async () => {
      mockGet.mockResolvedValue({ data: { data: { id: '1', name: 'Alice' } } });

      const { useLead } = await import('./index');
      const { result } = renderHook(() => useLead('1'), { wrapper: createWrapper() });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data?.data.name).toBe('Alice');
    });

    it('should not fetch when id is empty', async () => {
      const { useLead } = await import('./index');
      const { result } = renderHook(() => useLead(''), { wrapper: createWrapper() });

      expect(result.current.isFetching).toBe(false);
    });
  });

  describe('useLeadMutations', () => {
    it('should create lead via mutation', async () => {
      mockPost.mockResolvedValue({ data: { data: { id: 'new', name: 'Jane' } } });

      const { useLeadMutations } = await import('./index');
      const { result } = renderHook(() => useLeadMutations(), { wrapper: createWrapper() });

      result.current.create.mutate({ name: 'Jane' });
      await waitFor(() => expect(result.current.create.isSuccess).toBe(true));
      expect(mockPost).toHaveBeenCalledWith('/leads', { name: 'Jane' });
    });

    it('should delete lead via mutation', async () => {
      mockDelete.mockResolvedValue({ data: {} });

      const { useLeadMutations } = await import('./index');
      const { result } = renderHook(() => useLeadMutations(), { wrapper: createWrapper() });

      result.current.remove.mutate('lead_1');
      await waitFor(() => expect(result.current.remove.isSuccess).toBe(true));
      expect(mockDelete).toHaveBeenCalledWith('/leads/lead_1');
    });
  });

  describe('useCampaigns', () => {
    it('should fetch campaigns', async () => {
      mockGet.mockResolvedValue({ data: { data: [{ id: 'c1', name: 'Camp 1' }] } });

      const { useCampaigns } = await import('./index');
      const { result } = renderHook(() => useCampaigns(), { wrapper: createWrapper() });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data?.data[0].name).toBe('Camp 1');
    });
  });

  describe('useCampaign', () => {
    it('should fetch single campaign', async () => {
      mockGet.mockResolvedValue({ data: { data: { id: 'c1', name: 'My Campaign' } } });

      const { useCampaign } = await import('./index');
      const { result } = renderHook(() => useCampaign('c1'), { wrapper: createWrapper() });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data?.data.name).toBe('My Campaign');
    });
  });

  describe('useTemplates', () => {
    it('should fetch templates', async () => {
      mockGet.mockResolvedValue({ data: { data: [{ id: 't1', name: 'Template 1' }] } });

      const { useTemplates } = await import('./index');
      const { result } = renderHook(() => useTemplates(), { wrapper: createWrapper() });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data?.data[0].name).toBe('Template 1');
    });
  });

  describe('useGroups', () => {
    it('should fetch groups', async () => {
      mockGet.mockResolvedValue({ data: { data: [{ id: 'g1', name: 'Group 1' }] } });

      const { useGroups } = await import('./index');
      const { result } = renderHook(() => useGroups(), { wrapper: createWrapper() });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data?.data[0].name).toBe('Group 1');
    });
  });

  describe('useMessages', () => {
    it('should fetch messages', async () => {
      mockGet.mockResolvedValue({ data: { data: [{ id: 'm1', body: 'Hello' }] } });

      const { useMessages } = await import('./index');
      const { result } = renderHook(() => useMessages(), { wrapper: createWrapper() });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data?.data[0].body).toBe('Hello');
    });
  });

  describe('useAnalyticsOverview', () => {
    it('should fetch analytics overview', async () => {
      mockGet.mockResolvedValue({ data: { data: { totalLeads: 100 } } });

      const { useAnalyticsOverview } = await import('./index');
      const { result } = renderHook(() => useAnalyticsOverview(), { wrapper: createWrapper() });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data?.data.totalLeads).toBe(100);
    });
  });

  describe('useExportLeads', () => {
    it('should export leads as JSON', async () => {
      mockPost.mockResolvedValue({ data: { data: [{ name: 'John' }] } });

      const { useExportLeads } = await import('./index');
      const { result } = renderHook(() => useExportLeads(), { wrapper: createWrapper() });

      result.current.mutate({ format: 'json' });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockPost).toHaveBeenCalledWith('/leads/export', { format: 'json' }, { responseType: 'json' });
    });

    it('should export leads as CSV response type', async () => {
      mockPost.mockResolvedValue({ data: 'csv,data' });

      const { useExportLeads } = await import('./index');
      const { result } = renderHook(() => useExportLeads(), { wrapper: createWrapper() });

      result.current.mutate({ format: 'csv' });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockPost).toHaveBeenCalledWith('/leads/export', { format: 'csv' }, { responseType: 'blob' });
    });
  });
});
