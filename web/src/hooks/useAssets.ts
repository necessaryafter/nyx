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

function uploadAsset(file: File, onProgress?: (pct: number) => void): Promise<Asset> {
  return new Promise((resolve, reject) => {
    let type: "video" | "audio" | "text" | "image" = "text";
    if (file.type.startsWith("video/")) type = "video";
    else if (file.type.startsWith("audio/")) type = "audio";
    else if (file.type.startsWith("image/")) type = "image";

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

export function useUploadAsset(onProgress?: (pct: number) => void) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => uploadAsset(file, onProgress),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["assets"] });
    },
  });
}
