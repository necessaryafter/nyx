import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import type {
  CreditsBalance,
  PaginatedResponse,
  Job,
  Template,
  Asset,
} from "../lib/types";

export function useCreditsBalance() {
  return useQuery({
    queryKey: ["credits", "balance"],
    queryFn: () => api.get<CreditsBalance>("/api/credits/balance"),
  });
}

export function useRecentJobs(limit = 5) {
  return useQuery({
    queryKey: ["jobs", "recent", limit],
    queryFn: () =>
      api.get<PaginatedResponse<Job>>(`/api/jobs?limit=${limit}&offset=0`),
  });
}

export function useTemplatesCount() {
  return useQuery({
    queryKey: ["templates", "count"],
    queryFn: () =>
      api.get<PaginatedResponse<Template>>("/api/templates?limit=1&offset=0"),
    select: (data) => data.total,
  });
}

export function useAssetsCount() {
  return useQuery({
    queryKey: ["assets", "count"],
    queryFn: () =>
      api.get<PaginatedResponse<Asset>>("/api/assets?limit=1&offset=0"),
    select: (data) => data.total,
  });
}
