import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft, Loader2, Play } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Button } from "../components/ui/Button";
import { api } from "../lib/api";
import type { TemplateWithGraph } from "../lib/types";

export function RenderPage() {
  const { templateId } = useParams<{ templateId: string }>();
  const navigate = useNavigate();
  const [text, setText] = useState("");

  const templateQuery = useQuery({
    queryKey: ["templates", templateId],
    queryFn: () => api.get<TemplateWithGraph>(`/api/templates/${templateId}`),
    enabled: !!templateId,
  });

  const createJob = useMutation({
    mutationFn: async () => {
      const draft = await api.post<{ id: string }>("/api/jobs/draft", { templateId });
      // Usa o que o template define na Narração (provider, voz, velocidade) em vez de fixar Talkify.
      const cfg = templateQuery.data?.graph.nodes.find((n) => n.type === "NarrationSource")?.config as
        | { provider?: string; voice?: string; speed?: number }
        | undefined;
      await api.post(`/api/jobs/${draft.id}/audio`, {
        narration: {
          type: "tts",
          text,
          provider: cfg?.provider === "edge" ? "edge" : "talkify",
          voice: cfg?.voice,
          speed: cfg?.speed,
        },
      });
      return draft;
    },
    onSuccess: (draft) => navigate(`/jobs/${draft.id}/edit`),
  });

  if (templateQuery.isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-nyx-void text-nyx-text-muted">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (templateQuery.isError || !templateQuery.data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-nyx-void">
        <div className="text-center">
          <p className="text-sm text-nyx-text-primary">Template nao encontrado</p>
          <Link to="/templates" className="mt-3 inline-block text-xs text-nyx-cyan-500">Voltar</Link>
        </div>
      </div>
    );
  }

  const template = templateQuery.data;
  const graph = template.graph;
  const canRender = graph.version === 2 && text.trim().length > 0;

  return (
    <div className="min-h-screen bg-nyx-void text-nyx-text-primary">
      <div className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-8">
        <Link to="/templates" className="inline-flex items-center gap-2 text-xs text-nyx-text-muted hover:text-nyx-text-primary">
          <ArrowLeft className="h-4 w-4" />
          Templates
        </Link>

        <div>
          <p className="text-xs uppercase tracking-wider text-nyx-text-muted">Render V2</p>
          <h1 className="mt-1 text-2xl font-semibold">{template.name}</h1>
          <p className="mt-2 text-sm text-nyx-text-muted">
            {graph.nodes.length} nodes · {graph.edges.length} edges · {graph.settings.width}x{graph.settings.height}
          </p>
        </div>

        <div className="rounded-lg border border-nyx-border bg-nyx-deep p-4">
          <label className="mb-2 block text-sm font-medium">Narração</label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="h-52 w-full resize-none rounded-lg border border-nyx-border bg-nyx-void p-3 text-sm text-nyx-text-primary outline-none focus:border-nyx-cyan-500"
            placeholder="Cole o texto que será narrado..."
          />
        </div>

        {createJob.isError && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
            Erro ao criar job. Verifique o template e tente novamente.
          </div>
        )}

        <div className="flex justify-end">
          <Button disabled={!canRender || createJob.isPending} onClick={() => createJob.mutate()}>
            {createJob.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            Renderizar
          </Button>
        </div>
      </div>
    </div>
  );
}
