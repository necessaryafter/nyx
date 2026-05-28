import { useState, useEffect } from "react";
import { motion } from "motion/react";
import { X, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTemplates } from "../../hooks/useTemplates";
import { api } from "../../lib/api";
import type { Job } from "../../lib/types";

interface Props {
  templateId?: string;
  onClose: () => void;
}

export function CreateJobModal({ templateId: initialTemplateId, onClose }: Props) {
  const navigate = useNavigate();

  // If a template ID is already known, create draft and go straight to narration step
  useEffect(() => {
    if (!initialTemplateId) return;
    api.post<Job>("/api/jobs/draft", { templateId: initialTemplateId })
      .then((job) => { onClose(); navigate(`/jobs/${job.id}/edit`); })
      .catch(console.error);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const [search, setSearch] = useState("");
  const templates = useTemplates(0, search || undefined);

  const handleSelectTemplate = (id: string) => {
    api.post<Job>("/api/jobs/draft", { templateId: id })
      .then((job) => { onClose(); navigate(`/jobs/${job.id}/edit`); })
      .catch(console.error);
  };

  if (initialTemplateId) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        className="w-full max-w-lg overflow-hidden rounded-2xl border border-nyx-border bg-nyx-elevated shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        transition={{ duration: 0.2 }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-nyx-border px-5 py-4">
          <h2 className="font-display text-base font-semibold text-nyx-text-primary">
            Selecionar template
          </h2>
          <button
            onClick={onClose}
            className="rounded p-1 text-nyx-text-muted hover:bg-nyx-hover hover:text-nyx-text-primary"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Template list */}
        <div className="flex flex-col" style={{ maxHeight: "60vh" }}>
          <div className="relative border-b border-nyx-border px-4 py-3">
            <Search className="pointer-events-none absolute left-7 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-nyx-text-muted" />
            <input
              type="text"
              placeholder="Buscar template..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
              className="h-8 w-full rounded-lg border border-nyx-border bg-nyx-void pl-8 pr-3 text-xs text-nyx-text-primary placeholder:text-nyx-text-muted focus:border-nyx-cyan-500 focus:outline-none"
            />
          </div>
          <div className="overflow-y-auto p-3 space-y-1">
            {templates.isPending && (
              <p className="py-6 text-center text-xs text-nyx-text-muted">Carregando...</p>
            )}
            {!templates.isPending && (templates.data?.data.length ?? 0) === 0 && (
              <p className="py-6 text-center text-xs text-nyx-text-muted">
                Nenhum template encontrado
              </p>
            )}
            {templates.data?.data.map((t) => (
              <button
                key={t.id}
                onClick={() => handleSelectTemplate(t.id)}
                className="flex w-full items-center justify-between rounded-lg border border-nyx-border bg-nyx-void px-3 py-2.5 text-left transition-colors hover:border-nyx-cyan-500 hover:bg-nyx-cyan-500/5"
              >
                <span className="text-sm font-medium text-nyx-text-primary">{t.name}</span>
                <span className="text-xs text-nyx-text-muted">
                  {new Date(t.updatedAt).toLocaleDateString("pt-BR")}
                </span>
              </button>
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
