/**
 * The office list, from /api/offices. One source for the hire modal, the
 * send-welcome dialog, the interview scheduler and the Offices admin card, so
 * an office HR adds shows up everywhere at once.
 */
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

export interface Office {
  id: string;
  key: string;
  label: string;
  address: string;
  meetPerson: string;
  enabled: boolean;
  sortOrder: number;
  updatedBy?: string | null;
  updatedAt?: string;
}

export const OFFICES_QUERY_KEY = ['/api/offices'] as const;
export const OFFICES_ADMIN_QUERY_KEY = ['/api/offices', 'all'] as const;

/** Active offices only — what pickers show. */
export function useOffices(enabled = true) {
  return useQuery<Office[]>({
    queryKey: OFFICES_QUERY_KEY,
    queryFn: () => apiRequest<Office[]>('/api/offices', 'GET'),
    enabled,
    staleTime: 60_000,
  });
}

/** Every office including turned-off ones — the admin card. */
export function useAllOffices() {
  return useQuery<Office[]>({
    queryKey: OFFICES_ADMIN_QUERY_KEY,
    queryFn: () => apiRequest<Office[]>('/api/offices?all=true', 'GET'),
  });
}
