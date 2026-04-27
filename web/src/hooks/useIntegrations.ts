import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";

export interface Integration {
  provider: string;
  maskedKey: string;
  createdAt: string;
  updatedAt: string;
}

export function useIntegrations() {
  return useQuery({
    queryKey: ["integrations"],
    queryFn: () => api.get<Integration[]>("/api/integrations"),
  });
}

export function useUpsertIntegration() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ provider, apiKey }: { provider: string; apiKey: string }) =>
      api.put(`/api/integrations/${provider}`, { apiKey }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["integrations"] }),
  });
}

export function useDeleteIntegration() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (provider: string) => api.delete(`/api/integrations/${provider}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["integrations"] }),
  });
}
