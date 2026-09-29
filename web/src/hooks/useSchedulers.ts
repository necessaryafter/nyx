import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { api } from "../lib/api";
import type {
  PaginatedResponse,
  Scheduler,
  SchedulerListItem,
  SchedulerDetail,
  SchedulerEstimate,
  SeriesScript,
} from "../lib/types";

export interface SchedulerInput {
  name: string;
  templateId: string;
  theme: string;
  assetIds?: string[];
  musicAssetIds?: string[];
  mode: "single" | "parts";
  totalMinutes?: number;
  partsCount?: number;
  minutesPerPart?: number;
  noRepeatAssetsAcrossParts?: boolean;
  randomizeAssetOrder?: boolean;
  ctaTemplate?: string;
  finalCtaTemplate?: string;
  finalPartEnabled?: boolean;
  aiModel: string;
  cronPattern?: string | null;
  timezone?: string;
  runOnCreate?: boolean;
}

export function useSchedulers(page: number, search?: string) {
  const limit = 20;
  const offset = page * limit;
  return useQuery({
    queryKey: ["schedulers", "list", page, search],
    queryFn: () => {
      let url = `/api/schedulers?limit=${limit}&offset=${offset}`;
      if (search) url += `&search=${encodeURIComponent(search)}`;
      return api.get<PaginatedResponse<SchedulerListItem>>(url);
    },
    staleTime: 10_000,
  });
}

export function useScheduler(id: string) {
  return useQuery({
    queryKey: ["schedulers", "detail", id],
    queryFn: () => api.get<SchedulerDetail>(`/api/schedulers/${id}`),
    enabled: !!id,
  });
}

export function useCreateScheduler() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: SchedulerInput) => api.post<Scheduler>("/api/schedulers", input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["schedulers"] }),
  });
}

export function useUpdateScheduler(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<SchedulerInput>) => api.put<Scheduler>(`/api/schedulers/${id}`, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["schedulers"] }),
  });
}

export function useRunScheduler(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<{ runQueued: true }>(`/api/schedulers/${id}/run`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["schedulers"] }),
  });
}

export function usePauseScheduler(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<Scheduler>(`/api/schedulers/${id}/pause`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["schedulers"] }),
  });
}

export function useResumeScheduler(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<Scheduler>(`/api/schedulers/${id}/resume`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["schedulers"] }),
  });
}

export function useDeleteScheduler() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<void>(`/api/schedulers/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["schedulers"] }),
  });
}

export interface EstimateParams {
  mode: "single" | "parts";
  totalMinutes?: number;
  partsCount?: number;
  minutesPerPart?: number;
}

function estimateReady(p: EstimateParams): boolean {
  return p.mode === "single" ? p.totalMinutes != null : p.partsCount != null && p.minutesPerPart != null;
}

export function useSchedulerEstimate(params: EstimateParams) {
  return useQuery({
    queryKey: ["schedulers", "estimate", params],
    queryFn: () => {
      const q = new URLSearchParams({ mode: params.mode });
      if (params.totalMinutes != null) q.set("totalMinutes", String(params.totalMinutes));
      if (params.partsCount != null) q.set("partsCount", String(params.partsCount));
      if (params.minutesPerPart != null) q.set("minutesPerPart", String(params.minutesPerPart));
      return api.get<SchedulerEstimate>(`/api/schedulers/estimate?${q.toString()}`);
    },
    enabled: estimateReady(params),
  });
}

export function usePreviewSeriesScript() {
  return useMutation({
    mutationFn: (input: {
      model: string;
      theme: string;
      parts: number;
      minutesPerPart: number;
      ctaTemplate?: string;
      finalCtaTemplate?: string;
      finalPartEnabled?: boolean;
    }) => api.post<SeriesScript>("/api/ai/series-script", input),
  });
}

// ── WebSocket ──
// Espelha useJobsWebSocket (useJobs.ts): mesma conexão, invalida queries de
// scheduler em vez de job. "run:status" é o evento novo; "job:status" também
// interessa porque cada parte é um job normal.

type SchedulerWsMessage = { type: "run:status" | "job:status" | string; [key: string]: unknown };

export function useSchedulersWebSocket() {
  const qc = useQueryClient();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const apiUrl = import.meta.env.VITE_API_URL ?? "";
    const wsBase = apiUrl.replace(/^http/, "ws");
    const wsUrl = `${wsBase}/api/ws`;

    function connect() {
      try {
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data) as SchedulerWsMessage;
            if (msg.type === "run:status" || msg.type === "job:status") {
              qc.invalidateQueries({ queryKey: ["schedulers"] });
            }
          } catch {}
        };

        ws.onclose = () => {
          reconnectTimer.current = setTimeout(connect, 30_000);
        };
      } catch {}
    }

    connect();

    return () => {
      wsRef.current?.close();
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
    };
  }, [qc]);
}
