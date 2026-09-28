import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { api } from "../lib/api";
import type { ImportBatch } from "../lib/types";

const IN_PROGRESS = ["detecting", "awaiting_fallback_choice", "awaiting_review"];

// Mesmo esquema de upload em chunks de useAssets.ts (uploadAssetChunked), só
// mudando o endpoint de destino pro lote de import.
const CHUNK_SIZE = 5 * 1024 * 1024; // 5 MB
const UPLOAD_ORIGIN = import.meta.env.DEV ? "http://localhost:3000" : "";
const MAX_CHUNK_RETRIES = 3;

async function uploadChunkWithRetry(url: string, chunk: Blob, chunkIndex: number): Promise<void> {
  let lastError: Error | undefined;
  for (let attempt = 0; attempt <= MAX_CHUNK_RETRIES; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 500 * 2 ** (attempt - 1)));
    try {
      const res = await fetch(url, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/octet-stream" },
        body: chunk,
      });
      if (res.ok) return;
      const err = (await res.json().catch(() => ({}))) as { error?: string };
      lastError = new Error(err.error ?? `Falha no chunk ${chunkIndex} (HTTP ${res.status})`);
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
    }
  }
  throw lastError;
}

async function uploadImportChunked(file: File, onProgress?: (pct: number) => void): Promise<{ batchId: string }> {
  const startRes = await fetch(`${UPLOAD_ORIGIN}/api/asset-imports/upload/start`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: file.name }),
  });
  if (!startRes.ok) {
    const err = (await startRes.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? "Falha ao iniciar importação");
  }
  const { batchId } = (await startRes.json()) as { batchId: string };

  const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
  for (let i = 0; i < totalChunks; i++) {
    const chunk = file.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
    await uploadChunkWithRetry(`${UPLOAD_ORIGIN}/api/asset-imports/upload/${batchId}/chunk?index=${i}`, chunk, i);
    onProgress?.(Math.round(((i + 1) / totalChunks) * 99));
  }

  const completeRes = await fetch(`${UPLOAD_ORIGIN}/api/asset-imports/upload/${batchId}/complete`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ totalChunks, totalSize: file.size }),
  });
  if (!completeRes.ok) {
    const err = (await completeRes.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? "Falha ao finalizar importação");
  }
  onProgress?.(-1);
  return { batchId };
}

export function useStartImport(onProgress?: (pct: number) => void) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => uploadImportChunked(file, onProgress),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["asset-imports"] }),
  });
}

// Lotes ainda em andamento — alimenta o item "processando" no topo da grid
// e decide quando os modais de fallback/revisão devem aparecer.
export function usePendingImports() {
  return useQuery({
    queryKey: ["asset-imports", "list"],
    queryFn: () => api.get<{ data: ImportBatch[] }>("/api/asset-imports"),
    refetchInterval: (query) => ((query.state.data?.data.length ?? 0) > 0 ? 4000 : false),
  });
}

export function useImportBatch(batchId: string | undefined) {
  return useQuery({
    queryKey: ["asset-imports", "detail", batchId],
    queryFn: () => api.get<ImportBatch>(`/api/asset-imports/${batchId}`),
    enabled: !!batchId,
    refetchInterval: (query) => (IN_PROGRESS.includes(query.state.data?.status ?? "") ? 3000 : false),
  });
}

export function useConfirmImport(batchId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { selectedIndexes: number[]; names?: Record<number, string> }) =>
      api.post<{ status: string; imported: number }>(`/api/asset-imports/${batchId}/confirm`, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["asset-imports"] });
      qc.invalidateQueries({ queryKey: ["assets"] });
    },
  });
}

export function useDeleteSegment(batchId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (index: number) => api.delete<{ deleted: boolean }>(`/api/asset-imports/${batchId}/segments/${index}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["asset-imports"] }),
  });
}

export function useFallbackChoice(batchId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (mode: "fixed" | "single") =>
      api.post<{ status: string }>(`/api/asset-imports/${batchId}/fallback`, { mode }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["asset-imports"] }),
  });
}

export function useDiscardImport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (batchId: string) => api.delete<{ deleted: boolean }>(`/api/asset-imports/${batchId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["asset-imports"] }),
  });
}

// Espelha useSchedulersWebSocket (useSchedulers.ts): mesma conexão, invalida
// as queries de import em vez de scheduler; "done" também mexe em assets.
type ImportWsMessage = { type: "import:status" | string; [key: string]: unknown };

export function useAssetImportsWebSocket() {
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
            const msg = JSON.parse(event.data) as ImportWsMessage;
            if (msg.type === "import:status") {
              qc.invalidateQueries({ queryKey: ["asset-imports"] });
              if (msg.status === "done") qc.invalidateQueries({ queryKey: ["assets"] });
            }
          } catch { /* ignore */ }
        };

        ws.onclose = () => {
          reconnectTimer.current = setTimeout(connect, 30_000);
        };
      } catch { /* ignore */ }
    }

    connect();

    return () => {
      wsRef.current?.close();
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
    };
  }, [qc]);
}
