import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';

export function useLeads(params?: Record<string, unknown>) {
  return useQuery({
    queryKey: ['leads', params],
    queryFn: () => api.get('/leads', { params }).then((r) => r.data),
  });
}

export function useLead(id: string) {
  return useQuery({
    queryKey: ['lead', id],
    queryFn: () => api.get(`/leads/${id}`).then((r) => r.data),
    enabled: !!id,
  });
}

export function useLeadMutations() {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['leads'] });

  const create = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.post('/leads', body),
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: ({ id, ...body }: { id: string; [key: string]: unknown }) => api.put(`/leads/${id}`, body),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/leads/${id}`),
    onSuccess: invalidate,
  });

  return { create, update, remove };
}

export function useCampaigns(params?: Record<string, unknown>) {
  return useQuery({
    queryKey: ['campaigns', params],
    queryFn: () => api.get('/campaigns', { params }).then((r) => r.data),
  });
}

export function useCampaign(id: string) {
  return useQuery({
    queryKey: ['campaign', id],
    queryFn: () => api.get(`/campaigns/${id}`).then((r) => r.data),
    enabled: !!id,
  });
}

export function useTemplates(params?: Record<string, unknown>) {
  return useQuery({
    queryKey: ['templates', params],
    queryFn: () => api.get('/templates', { params }).then((r) => r.data),
  });
}

export function useGroups(params?: Record<string, unknown>) {
  return useQuery({
    queryKey: ['groups', params],
    queryFn: () => api.get('/groups', { params }).then((r) => r.data),
  });
}

export function useMessages(params?: Record<string, unknown>) {
  return useQuery({
    queryKey: ['messages', params],
    queryFn: () => api.get('/messages', { params }).then((r) => r.data),
  });
}

export function useAnalyticsOverview() {
  return useQuery({
    queryKey: ['analytics', 'overview'],
    queryFn: () => api.get('/analytics/overview').then((r) => r.data),
  });
}

export function useExportLeads() {
  return useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api.post('/leads/export', body, { responseType: body.format === 'csv' ? 'blob' : 'json' }).then((r) => r.data),
  });
}
