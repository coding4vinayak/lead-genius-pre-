import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { PreviewDevice } from '@leadgenius/shared';
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

export function useSpamCheck(templateId: string) {
  return useQuery({
    queryKey: ['spam-check', templateId],
    queryFn: () => api.post(`/templates/${templateId}/spam-check`).then((r) => r.data),
    enabled: !!templateId,
  });
}

export function useTemplatePreview(templateId: string, variables?: Record<string, string>, device?: PreviewDevice) {
  return useQuery({
    queryKey: ['template-preview', templateId, variables, device],
    queryFn: () => api.post(`/templates/${templateId}/preview`, { variables: variables || {}, device: device || 'desktop' }).then((r) => r.data),
    enabled: !!templateId,
  });
}

export function useEnrichLead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, providers }: { id: string; providers?: string[] }) =>
      api.post(`/leads/${id}/enrich`, { providers }).then((r) => r.data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['lead', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['enrichment-history', variables.id] });
    },
  });
}

export function useEnrichmentHistory(leadId: string) {
  return useQuery({
    queryKey: ['enrichment-history', leadId],
    queryFn: () => api.get(`/leads/${leadId}/enrichment-history`).then((r) => r.data),
    enabled: !!leadId,
  });
}

export function useFindEmail() {
  return useMutation({
    mutationFn: (body: { firstName: string; lastName: string; domain: string }) =>
      api.post('/leads/find-email', body).then((r) => r.data),
  });
}

export function useLinkedInProfile(leadId: string) {
  return useQuery({
    queryKey: ['linkedin-profile', leadId],
    queryFn: () => api.get(`/linkedin/profile/${leadId}`).then((r) => r.data),
    enabled: !!leadId,
  });
}

export function useLinkedInConnections(params?: Record<string, unknown>) {
  return useQuery({
    queryKey: ['linkedin-connections', params],
    queryFn: () => api.get('/linkedin/connections', { params }).then((r) => r.data),
  });
}

export function useSendConnectionRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ leadId, note, profileUrl }: { leadId: string; note?: string; profileUrl?: string }) =>
      api.post(`/linkedin/connect/${leadId}`, { note, profileUrl }).then((r) => r.data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['linkedin-profile', variables.leadId] });
      queryClient.invalidateQueries({ queryKey: ['linkedin-connections'] });
    },
  });
}

export function useSendLinkedInMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ leadId, body }: { leadId: string; body: string }) =>
      api.post(`/linkedin/message/${leadId}`, { body }).then((r) => r.data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['linkedin-profile', variables.leadId] });
    },
  });
}

export function useLeadNotes(leadId: string, params?: Record<string, unknown>) {
  return useQuery({
    queryKey: ['lead-notes', leadId, params],
    queryFn: () => api.get(`/leads/${leadId}/notes`, { params }).then((r) => r.data),
    enabled: !!leadId,
  });
}

export function useCreateNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ leadId, body }: { leadId: string; body: string }) =>
      api.post(`/leads/${leadId}/notes`, { body }).then((r) => r.data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['lead-notes', variables.leadId] });
      queryClient.invalidateQueries({ queryKey: ['lead-activity', variables.leadId] });
    },
  });
}

export function useLeadActivity(leadId: string, params?: Record<string, unknown>) {
  return useQuery({
    queryKey: ['lead-activity', leadId, params],
    queryFn: () => api.get(`/leads/${leadId}/activity`, { params }).then((r) => r.data),
    enabled: !!leadId,
  });
}

export function useAssignLead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ leadId, userId }: { leadId: string; userId: string }) =>
      api.post(`/leads/${leadId}/assign`, { userId }).then((r) => r.data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['lead', variables.leadId] });
      queryClient.invalidateQueries({ queryKey: ['lead-activity', variables.leadId] });
    },
  });
}

export function useAssignmentRules() {
  return useQuery({
    queryKey: ['assignment-rules'],
    queryFn: () => api.get('/assignment-rules').then((r) => r.data),
  });
}
