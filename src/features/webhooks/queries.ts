import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/client';
import type { Webhook, WebhookListQuery, WebhookUpdate } from '../../api/types';

export const webhookKeys = {
  all: ['webhooks'] as const,
  lists: () => [...webhookKeys.all, 'list'] as const,
  list: (query: WebhookListQuery) => [...webhookKeys.lists(), query] as const,
  detail: (id: number) => [...webhookKeys.all, 'detail', id] as const,
};

export function useWebhookList(query: WebhookListQuery) {
  return useQuery({
    queryKey: webhookKeys.list(query),
    queryFn: ({ signal }) => api.webhooks.list(query, signal),
    // Keep the current page on screen while the next one loads — no table flicker.
    placeholderData: keepPreviousData,
  });
}

export function useWebhook(id: number) {
  return useQuery({
    queryKey: webhookKeys.detail(id),
    queryFn: ({ signal }) => api.webhooks.get(id, signal),
  });
}

export function useUpdateWebhook(id: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: WebhookUpdate) => api.webhooks.update(id, data),
    onSuccess: (updated: Webhook) => {
      queryClient.setQueryData(webhookKeys.detail(id), updated);
      // A rename can move the webhook in or out of a search result.
      return queryClient.invalidateQueries({ queryKey: webhookKeys.lists() });
    },
  });
}
