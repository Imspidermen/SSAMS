import { useQuery } from '@tanstack/react-query';
import * as healthService from '@/services/health.service';
import { queryKeys } from '@/services/queryKeys';

/** Backend + CV microservice dependency health (GET /api/health). */
export function useHealth(enabled = true) {
  return useQuery({
    queryKey: queryKeys.health,
    queryFn: healthService.getHealth,
    enabled,
    staleTime: 30_000,
    retry: 1,
  });
}
