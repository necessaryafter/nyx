import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";

export interface AiModel {
  id: string;
  label: string;
}

export function useAiModels() {
  return useQuery({
    queryKey: ["ai", "models"],
    queryFn: () => api.get<AiModel[]>("/api/ai/models"),
    staleTime: 60 * 60 * 1000, // 1h — a lista muda raramente
    retry: false, // 503 = sem chave configurada; tentar de novo não ajuda
  });
}
