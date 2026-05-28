import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { api } from "../lib/api";
import type { Job, JobStatus, PaginatedResponse, SceneSlot } from "../lib/types";

export function useJobs(page: number, status?: JobStatus, search?: string) {
  const limit = 20;
  const offset = page * limit;
  return useQuery({
    queryKey: ["jobs", "list", page, status, search],
    queryFn: () => {
      let url = `/api/jobs?limit=${limit}&offset=${offset}`;
      if (status) url += `&status=${status}`;
      if (search) url += `&search=${encodeURIComponent(search)}`;
      return api.get<PaginatedResponse<Job>>(url);
    },
    staleTime: 10_000,
  });
}

export function useJob(id: string) {
  return useQuery({
    queryKey: ["jobs", "detail", id],
    queryFn: () => api.get<Job>(`/api/jobs/${id}`),
    enabled: !!id,
  });
}

export function useJobDownload() {
  return async (id: string): Promise<string> => {
    const res = await api.get<{ url: string }>(`/api/jobs/${id}/download`);
    return res.url;
  };
}

// ── Wizard mutations ──

export function useCreateDraftJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (templateId: string) =>
      api.post<Job>("/api/jobs/draft", { templateId }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["jobs"] }),
  });
}

export function useStartAudio(jobId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (narration: {
      type: "tts";
      text: string;
      provider: "talkify";
      voice?: string;
      speed?: number;
    } | { type: "audio"; assetId: string }) =>
      api.post<{ status: string }>(`/api/jobs/${jobId}/audio`, { narration }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["jobs"] }),
  });
}

export function useGenerateSlotImage(jobId: string) {
  return useMutation({
    mutationFn: ({ slotIndex, prompt }: { slotIndex: number; prompt: string }) =>
      api.post<{ assetId: string }>(`/api/jobs/${jobId}/slots/${slotIndex}/generate-image`, { prompt }),
  });
}

export function useGenerateSlotPrompts(jobId: string) {
  return useMutation({
    mutationFn: () =>
      api.post<{ prompts: string[] }>(`/api/jobs/${jobId}/slots/generate-prompts`, {}),
  });
}

export function useUpdateSlots(jobId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (slots: Array<{ index: number; assetId: string | null; startMs?: number; endMs?: number }>) =>
      api.patch<{ status: string; slots: SceneSlot[] }>(`/api/jobs/${jobId}/slots`, { slots }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["jobs", "detail", jobId] }),
  });
}

export function useRenderJob(jobId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api.post<{ status: string; creditsCharged: number }>(`/api/jobs/${jobId}/render`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["jobs"] }),
  });
}

export function useDeleteJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (jobId: string) => api.delete<void>(`/api/jobs/${jobId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["jobs"] }),
  });
}

// ── WebSocket ──

export type WsMessage =
  | { type: "job:status"; jobId: string; status: string }
  | { type: "job:audio_ready"; jobId: string; sceneSlots: SceneSlot[] }
  | { type: "connected"; userId: string }
  | { type: "error"; message: string };

/** WebSocket hook that invalidates job queries on status updates */
export function useJobsWebSocket(onAudioReady?: (jobId: string, sceneSlots: SceneSlot[]) => void) {
  const qc = useQueryClient();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const callbackRef = useRef(onAudioReady);
  callbackRef.current = onAudioReady;

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
            const msg = JSON.parse(event.data) as WsMessage;

            if (msg.type === "job:audio_ready") {
              qc.invalidateQueries({ queryKey: ["jobs", "detail", msg.jobId] });
              qc.invalidateQueries({ queryKey: ["jobs", "list"] });
              callbackRef.current?.(msg.jobId, msg.sceneSlots);
            } else if (msg.type === "job:status") {
              qc.invalidateQueries({ queryKey: ["jobs"] });
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
