import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface Integration {
  id: string;
  name: string;
  description: string;
  connected: boolean;
  mode: 'live' | 'demo';
  lastSyncAt: string | null;
}

export function useIntegrations() {
  return useQuery<Integration[]>({
    queryKey: ['integrations'],
    queryFn: async () => {
      const response = await api.get<{ data: Integration[] }>('/api/integrations');
      return response.data;
    },
  });
}

export function useConnectIntegration() {
  const queryClient = useQueryClient();

  return useMutation<{ provider: string; status: string; message: string }, Error, string>({
    mutationFn: async (provider: string) => {
      const response = await api.post<{ data: { provider: string; status: string; message: string } }>(
        `/api/integrations/${provider}/connect`
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integrations'] });
    },
  });
}

export function useDisconnectIntegration() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: async (provider: string) => {
      await api.delete(`/api/integrations/${provider}/disconnect`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integrations'] });
    },
  });
}
