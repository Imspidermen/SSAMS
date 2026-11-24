/** GET /api/health - reports backend + CV microservice dependency status. */
import type { HealthStatus } from '@/types';
import { api } from './api';

export function getHealth(): Promise<HealthStatus> {
  return api.get<HealthStatus>('/health', { skipAuthRefresh: true, timeout: 8000 });
}
