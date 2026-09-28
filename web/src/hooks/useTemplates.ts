import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import type {
  PaginatedResponse,
  Template,
  TemplateWithGraph,
} from "../lib/types";

export function useTemplates(page: number, search?: string) {
  const limit = 12;
  const offset = page * limit;
  return useQuery({
    queryKey: ["templates", "list", page, search],
    queryFn: () => {
      let url = `/api/templates?limit=${limit}&offset=${offset}`;
      if (search) url += `&search=${encodeURIComponent(search)}`;
      return api.get<PaginatedResponse<Template>>(url);
    },
  });
}

export function useTemplate(id: string) {
  return useQuery({
    queryKey: ["templates", "detail", id],
    queryFn: () => api.get<TemplateWithGraph>(`/api/templates/${id}`),
    enabled: !!id,
  });
}

export function useDeleteTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.delete<{ deleted: boolean }>(`/api/templates/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["templates"] });
    },
  });
}

export function useDuplicateTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const template = await api.get<TemplateWithGraph>(
        `/api/templates/${id}`,
      );
      return api.post<Template>("/api/templates", {
        name: `${template.name} (cópia)`,
        graph: template.graph,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["templates"] });
    },
  });
}
