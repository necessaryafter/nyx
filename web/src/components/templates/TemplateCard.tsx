import { useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import {
  Pencil,
  Copy,
  Trash2,
  Globe,
  Lock,
  MoreVertical,
  Play,
} from "lucide-react";
import { cn } from "../../lib/cn";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import type { Template } from "../../lib/types";

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return "agora";
  if (diff < 3_600_000) return `há ${Math.floor(diff / 60_000)}min`;
  if (diff < 86_400_000) return `há ${Math.floor(diff / 3_600_000)}h`;
  if (diff < 604_800_000) return `há ${Math.floor(diff / 86_400_000)}d`;
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  });
}

interface TemplateCardProps {
  template: Template;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  onCreateJob: (id: string) => void;
  isDeleting?: boolean;
}

export function TemplateCard({
  template,
  onDelete,
  onDuplicate,
  onCreateJob,
  isDeleting,
}: TemplateCardProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  return (
    <>
      <div
        className={cn(
          "group relative flex flex-col rounded-xl border border-nyx-border bg-nyx-surface transition-all duration-200",
          "hover:-translate-y-0.5 hover:border-nyx-hover hover:shadow-lg hover:shadow-nyx-cyan-500/5",
        )}
      >
        {/* Gradient top bar */}
        <div className="h-[3px] rounded-t-xl bg-gradient-to-r from-nyx-cyan-500 to-nyx-orange-500" />

        {/* Body */}
        <div className="flex flex-1 flex-col p-4">
          {/* Header row */}
          <div className="flex items-start justify-between gap-2">
            <Link
              to={`/templates/${template.id}/edit`}
              className="min-w-0 flex-1"
            >
              <h3 className="truncate font-display text-sm font-semibold text-nyx-text-primary transition-colors group-hover:text-nyx-cyan-500">
                {template.name}
              </h3>
            </Link>

            {/* Menu */}
            <div className="relative">
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="rounded-md p-1 text-nyx-text-muted transition-colors hover:bg-nyx-hover hover:text-nyx-text-primary"
              >
                <MoreVertical className="h-4 w-4" />
              </button>

              {showMenu && (
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowMenu(false)}
                />
              )}
              <AnimatePresence>
                {showMenu && (
                  <motion.div
                    className="absolute right-0 top-full z-20 mt-1 w-36 overflow-hidden rounded-lg border border-nyx-border bg-nyx-elevated shadow-xl"
                    initial={{ opacity: 0, scale: 0.92, y: -4 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.92, y: -4 }}
                    transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
                    style={{ transformOrigin: "top right" }}
                  >
                    <Link
                      to={`/templates/${template.id}/edit`}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-nyx-text-secondary transition-colors hover:bg-nyx-hover hover:text-nyx-text-primary"
                      onClick={() => setShowMenu(false)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Editar
                    </Link>
                    <button
                      onClick={() => {
                        onDuplicate(template.id);
                        setShowMenu(false);
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-nyx-text-secondary transition-colors hover:bg-nyx-hover hover:text-nyx-text-primary"
                    >
                      <Copy className="h-3.5 w-3.5" />
                      Duplicar
                    </button>
                    <button
                      onClick={() => {
                        setShowDeleteConfirm(true);
                        setShowMenu(false);
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-nyx-error transition-colors hover:bg-nyx-error/10"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Excluir
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Meta */}
          <div className="mt-3 flex items-center gap-3 text-xs text-nyx-text-muted">
            {template.isPublic ? (
              <span className="flex items-center gap-1">
                <Globe className="h-3 w-3" />
                Público
              </span>
            ) : (
              <span className="flex items-center gap-1">
                <Lock className="h-3 w-3" />
                Privado
              </span>
            )}
            <span>{formatRelativeTime(template.updatedAt)}</span>
          </div>

          {/* Actions */}
          <div className="mt-4 pt-3 border-t border-nyx-border/50">
            <button
              onClick={() => onCreateJob(template.id)}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-nyx-orange-600 px-3 py-1.5 text-xs font-bold uppercase tracking-tight text-white transition-all hover:bg-nyx-orange-500 shadow-sm shadow-nyx-orange-900/20"
            >
              <Play className="h-3 w-3 fill-current" />
              Criar vídeo
            </button>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={() => {
          onDelete(template.id);
          setShowDeleteConfirm(false);
        }}
        title="Excluir template"
        description={`Tem certeza que deseja excluir "${template.name}"? Esta ação não pode ser desfeita.`}
        confirmLabel="Excluir"
        destructive
        loading={isDeleting}
      />
    </>
  );
}
