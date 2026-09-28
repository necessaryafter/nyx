import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import type { PaginatedResponse, Asset } from "../lib/types";

export function useAssets(
  page: number,
  type?: "video" | "audio" | "text" | "image",
  search?: string,
) {
  const limit = 20;
  const offset = page * limit;
  return useQuery({
    queryKey: ["assets", "list", page, type, search],
    queryFn: () => {
      let url = `/api/assets?limit=${limit}&offset=${offset}`;
      if (type) url += `&type=${type}`;
      if (search) url += `&search=${encodeURIComponent(search)}`;
      return api.get<PaginatedResponse<Asset>>(url);
    },
  });
}

export function useAssetCounts() {
  return useQuery({
    queryKey: ["assets", "counts"],
    queryFn: async () => {
      const [all, video, audio, text] = await Promise.all([
        api.get<PaginatedResponse<Asset>>("/api/assets?limit=1&offset=0"),
        api.get<PaginatedResponse<Asset>>("/api/assets?limit=1&offset=0&type=video"),
        api.get<PaginatedResponse<Asset>>("/api/assets?limit=1&offset=0&type=audio"),
        api.get<PaginatedResponse<Asset>>("/api/assets?limit=1&offset=0&type=text"),
      ]);
      return {
        all: all.total,
        video: video.total,
        audio: audio.total,
        text: text.total,
      };
    },
    staleTime: 30_000,
  });
}

export function useAssetUrl(id: string, enabled: boolean) {
  return useQuery({
    queryKey: ["assets", "url", id],
    queryFn: () => api.get<{ url: string }>(`/api/assets/${id}/url`),
    enabled,
    staleTime: 50 * 60 * 1000, // a URL presignada no backend dura 1h
  });
}

export function useDeleteAsset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.delete<{ deleted: boolean }>(`/api/assets/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["assets"] });
    },
  });
}

export function useRenameAsset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      api.put<Asset>(`/api/assets/${id}`, { name }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["assets"] });
    },
  });
}

const CHUNK_SIZE = 5 * 1024 * 1024; // 5 MB
const CHUNKED_THRESHOLD = 20 * 1024 * 1024; // use chunked for files >= 20 MB

// In dev the Vite proxy can't handle large binary bodies — go direct to the backend.
// CORS on the backend already allows localhost:5173 with credentials.
const UPLOAD_ORIGIN = import.meta.env.DEV ? "http://localhost:3000" : "";

function uploadAssetSingle(file: File, type: string, onProgress?: (pct: number) => void): Promise<Asset> {
  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("name", file.name);
    formData.append("type", type);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/assets/upload");
    xhr.withCredentials = true;

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        const pct = Math.round((e.loaded / e.total) * 100);
        onProgress?.(pct === 100 ? 99 : pct);
      }
    };

    xhr.upload.onloadend = () => onProgress?.(-1);

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(JSON.parse(xhr.responseText) as Asset);
      } else {
        let message = "Erro ao enviar arquivo";
        try { message = JSON.parse(xhr.responseText)?.message ?? message; } catch { /* ignore */ }
        reject(new Error(message));
      }
    };

    xhr.onerror = () => reject(new Error("Erro de rede ao enviar arquivo"));
    xhr.send(formData);
  });
}

const MAX_CHUNK_RETRIES = 3;

async function uploadChunkWithRetry(
  url: string,
  chunk: Blob,
  chunkIndex: number,
): Promise<void> {
  let lastError: Error | undefined;
  for (let attempt = 0; attempt <= MAX_CHUNK_RETRIES; attempt++) {
    if (attempt > 0) {
      await new Promise((r) => setTimeout(r, 500 * 2 ** (attempt - 1)));
    }
    try {
      const res = await fetch(url, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/octet-stream" },
        body: chunk,
      });
      if (res.ok) return;
      const err = await res.json().catch(() => ({})) as { error?: string };
      lastError = new Error(err.error ?? `Falha no chunk ${chunkIndex} (HTTP ${res.status})`);
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
    }
  }
  throw lastError;
}

async function uploadAssetChunked(file: File, type: string, onProgress?: (pct: number) => void): Promise<Asset> {
  const startRes = await fetch(`${UPLOAD_ORIGIN}/api/assets/upload/multipart/start`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: file.name, type }),
  });
  if (!startRes.ok) {
    const err = await startRes.json().catch(() => ({})) as { error?: string };
    throw new Error(err.error ?? "Falha ao iniciar upload");
  }
  const { assetId } = await startRes.json() as { assetId: string };

  const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

  for (let i = 0; i < totalChunks; i++) {
    const chunk = file.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
    await uploadChunkWithRetry(
      `${UPLOAD_ORIGIN}/api/assets/upload/multipart/${assetId}/chunk?index=${i}&total=${totalChunks}`,
      chunk,
      i,
    );
    onProgress?.(Math.round(((i + 1) / totalChunks) * 99));
  }

  const completeRes = await fetch(`${UPLOAD_ORIGIN}/api/assets/upload/multipart/${assetId}/complete`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ totalChunks, totalSize: file.size }),
  });
  if (!completeRes.ok) {
    const err = await completeRes.json().catch(() => ({})) as { error?: string };
    throw new Error(err.error ?? "Falha ao finalizar upload");
  }
  onProgress?.(-1);
  return completeRes.json() as Promise<Asset>;
}

function uploadAsset(file: File, onProgress?: (pct: number) => void): Promise<Asset> {
  let type: "video" | "audio" | "text" | "image" = "text";
  if (file.type.startsWith("video/")) type = "video";
  else if (file.type.startsWith("audio/")) type = "audio";
  else if (file.type.startsWith("image/")) type = "image";

  if (file.size >= CHUNKED_THRESHOLD) {
    return uploadAssetChunked(file, type, onProgress);
  }
  return uploadAssetSingle(file, type, onProgress);
}

export function useUploadAsset(onProgress?: (pct: number) => void) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => uploadAsset(file, onProgress),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["assets"] });
    },
  });
}
