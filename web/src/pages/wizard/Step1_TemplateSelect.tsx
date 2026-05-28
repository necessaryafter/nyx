import { useState } from "react";
import { Loader2, Search, LayoutTemplate } from "lucide-react";
import { useTemplates } from "../../hooks/useTemplates";
import { useCreateDraftJob } from "../../hooks/useJobs";
import { Button } from "../../components/ui/Button";
import type { Job, Template } from "../../lib/types";
import { cn } from "../../lib/cn";

function TemplateCard({
  template,
  selected,
  onClick,
}: {
  template: Template;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left rounded-xl border p-4 transition-all",
        selected
          ? "border-nyx-cyan-500 bg-nyx-cyan-500/10"
          : "border-nyx-border bg-nyx-surface hover:border-nyx-hover hover:bg-nyx-elevated",
      )}
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-nyx-elevated flex items-center justify-center shrink-0">
          <LayoutTemplate className="w-5 h-5 text-nyx-text-muted" />
        </div>
        <div className="min-w-0">
          <p className="font-medium text-sm truncate text-nyx-text-primary">{template.name}</p>
          <p className="text-xs text-nyx-text-muted mt-0.5">
            Criado em {new Date(template.createdAt).toLocaleDateString("pt-BR")}
          </p>
        </div>
      </div>
    </button>
  );
}

export function Step1_TemplateSelect({ onCreated }: { onCreated: (job: Job) => void }) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(null);

  const { data, isLoading } = useTemplates(0, search || undefined);
  const createDraft = useCreateDraftJob();

  async function handleNext() {
    if (!selected) return;
    const job = await createDraft.mutateAsync(selected);
    onCreated(job);
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-nyx-text-primary">Selecione um template</h2>
        <p className="text-sm text-nyx-text-secondary mt-1">
          O template define a estrutura visual do vídeo.
        </p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-nyx-text-muted" />
        <input
          type="text"
          placeholder="Buscar template..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-nyx-surface border border-nyx-border rounded-lg pl-9 pr-4 py-2.5 text-sm text-nyx-text-primary placeholder:text-nyx-text-muted focus:outline-none focus:border-nyx-cyan-500"
        />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-nyx-text-muted" />
        </div>
      ) : data?.data.length === 0 ? (
        <p className="text-center text-nyx-text-muted py-8">Nenhum template encontrado</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {data?.data.map((t) => (
            <TemplateCard
              key={t.id}
              template={t}
              selected={selected === t.id}
              onClick={() => setSelected(t.id)}
            />
          ))}
        </div>
      )}

      <div className="flex justify-end pt-2">
        <Button
          disabled={!selected || createDraft.isPending}
          onClick={handleNext}
        >
          {createDraft.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
          ) : null}
          Próximo
        </Button>
      </div>
    </div>
  );
}
