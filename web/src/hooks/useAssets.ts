import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import type { PaginatedResponse, Asset } from "../lib/types";

export function useAssets(
  page: number,
  type?: "video" | "audio" | "text",
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

export function useUploadAsset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("name", file.name);

      let type: "video" | "audio" | "text" = "text";
      if (file.type.startsWith("video/")) type = "video";
      else if (file.type.startsWith("audio/")) type = "audio";
      formData.append("type", type);

      const res = await fetch("/api/assets/upload", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.message ?? "Erro ao enviar arquivo");
      }
      return res.json() as Promise<Asset>;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["assets"] });
    },
  });
}
