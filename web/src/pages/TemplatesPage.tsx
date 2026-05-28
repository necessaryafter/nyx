import { useState } from "react";
import { Plus, Search } from "lucide-react";
import { motion } from "motion/react";
import { Button } from "../components/ui/Button";
import { TemplateCard } from "../components/templates/TemplateCard";
import { TemplateCardSkeleton } from "../components/templates/TemplateCardSkeleton";
import { EmptyTemplates } from "../components/templates/EmptyTemplates";
import { CreateJobModal } from "../components/jobs/CreateJobModal";
import { TemplatePresetModal } from "../components/templates/TemplatePresetModal";
import {
  useTemplates,
  useDeleteTemplate,
  useDuplicateTemplate,
} from "../hooks/useTemplates";

const fade = (delay: number) => ({
  initial: { opacity: 0, y: 12 } as const,
  animate: { opacity: 1, y: 0 } as const,
  transition: { duration: 0.4, delay, ease: [0.16, 1, 0.3, 1] as const },
});

export function TemplatesPage() {
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [createJobTemplateId, setCreateJobTemplateId] = useState<string | null>(null);
  const [showPresetModal, setShowPresetModal] = useState(false);

  const templates = useTemplates(page, debouncedSearch || undefined);
  const deleteTemplate = useDeleteTemplate();
  const duplicateTemplate = useDuplicateTemplate();

  // Debounce search
  const handleSearch = (value: string) => {
    setSearch(value);
    setPage(0);
    clearTimeout((handleSearch as { timer?: ReturnType<typeof setTimeout> }).timer);
    (handleSearch as { timer?: ReturnType<typeof setTimeout> }).timer = setTimeout(
      () => setDebouncedSearch(value),
      300,
    );
  };

  const total = templates.data?.total ?? 0;
  const limit = 12;
  const totalPages = Math.ceil(total / limit);
  const hasData = (templates.data?.data.length ?? 0) > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
        {...fade(0)}
      >
        <h1 className="font-display text-xl font-bold text-nyx-text-primary">
          Templates
        </h1>

        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-nyx-text-muted" />
            <input
              type="text"
              placeholder="Buscar..."
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              className="h-9 w-48 rounded-lg border border-nyx-border bg-nyx-surface pl-9 pr-3 text-sm text-nyx-text-primary placeholder:text-nyx-text-muted focus:border-nyx-cyan-500 focus:outline-none"
            />
          </div>

          {/* New Template */}
          <Button variant="primary" size="sm" onClick={() => setShowPresetModal(true)}>
            <Plus className="h-4 w-4" />
            Novo Template
          </Button>
        </div>
      </motion.div>

      {/* Content */}
      {templates.isPending ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <TemplateCardSkeleton key={i} />
          ))}
        </div>
      ) : !hasData ? (
        <EmptyTemplates />
      ) : (
        <motion.div
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
          {...fade(0.05)}
        >
          {templates.data!.data.map((template) => (
            <TemplateCard
              key={template.id}
              template={template}
              onDelete={(id) => deleteTemplate.mutate(id)}
              onDuplicate={(id) => duplicateTemplate.mutate(id)}
              onCreateJob={(id) => setCreateJobTemplateId(id)}
              isDeleting={deleteTemplate.isPending}
            />
          ))}
        </motion.div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <motion.div
          className="flex items-center justify-center gap-4"
          {...fade(0.1)}
        >
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
          >
            Anterior
          </Button>
          <span className="font-mono text-xs text-nyx-text-muted">
            {page + 1} / {totalPages}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
          >
            Próxima
          </Button>
        </motion.div>
      )}
      {createJobTemplateId && (
        <CreateJobModal
          templateId={createJobTemplateId}
          onClose={() => setCreateJobTemplateId(null)}
        />
      )}
      {showPresetModal && (
        <TemplatePresetModal onClose={() => setShowPresetModal(false)} />
      )}
    </div>
  );
}
