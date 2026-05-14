import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { ActivityEntry } from './useProperties';

/**
 * Recent activity across the authenticated user's organization.
 * Uses the global /api/activity endpoint backed by the activity_feed table.
 */
export function useRecentActivity(limit = 15) {
  const query = useQuery<ActivityEntry[]>({
    queryKey: ['activity', 'recent', limit],
    queryFn: async () => {
      const response = await api.get<{ data: ActivityEntry[] }>(`/api/activity?limit=${limit}`);
      return response.data;
    },
    staleTime: 30_000,
  });

  return {
    data: query.data ?? [],
    isLoading: query.isLoading,
    isEmpty: (query.data?.length ?? 0) === 0 && !query.isLoading,
  };
}
