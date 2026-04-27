import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import type { CreditsBalance } from "../lib/types";

export interface CreditTransaction {
  id: string;
  reason: "render" | "tts" | "purchase";
  amount: number;
  description: string | null;
  jobId: string | null;
  createdAt: string;
}

export function useCreditsBalance() {
  return useQuery({
    queryKey: ["credits", "balance"],
    queryFn: () => api.get<CreditsBalance>("/api/credits/balance"),
    staleTime: 10_000,
  });
}

export function useCreditHistory(
  page: number,
  reason?: "render" | "tts" | "purchase",
) {
  const limit = 20;
  const offset = page * limit;
  return useQuery({
    queryKey: ["credits", "history", page, reason],
    queryFn: () => {
      let url = `/api/credits/history?limit=${limit}&offset=${offset}`;
      if (reason) url += `&reason=${reason}`;
      return api.get<{ data: CreditTransaction[]; total: number }>(url);
    },
    staleTime: 30_000,
  });
}
