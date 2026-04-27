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
          : "border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/8",
      )}
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
          <LayoutTemplate className="w-5 h-5 text-white/60" />
        </div>
        <div className="min-w-0">
          <p className="font-medium text-sm truncate">{template.name}</p>
          <p className="text-xs text-white/40 mt-0.5">
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
        <h2 className="text-lg font-semibold">Selecione um template</h2>
        <p className="text-sm text-white/50 mt-1">
          O template define a estrutura visual do vídeo.
        </p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
        <input
          type="text"
          placeholder="Buscar template..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-white/5 border border-white/10 rounded-lg pl-9 pr-4 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-nyx-cyan-500/50"
        />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-white/40" />
        </div>
      ) : data?.data.length === 0 ? (
        <p className="text-center text-white/40 py-8">Nenhum template encontrado</p>
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
