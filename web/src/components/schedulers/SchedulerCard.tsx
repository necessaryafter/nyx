import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { MoreVertical, Play, Pause, Pencil, Trash2, CalendarClock } from "lucide-react";
import { cn } from "../../lib/cn";
import { formatSchedulerFormat, cadenceLabel, cronToCadence } from "../../lib/scheduler";
import { RunStatusBadge } from "./RunStatusBadge";
import { useRunScheduler, usePauseScheduler, useResumeScheduler, useDeleteScheduler } from "../../hooks/useSchedulers";
import type { SchedulerListItem } from "../../lib/types";

function timeUntil(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) return "agora";
  const hours = Math.round(diff / 3_600_000);
  if (hours < 24) return `em ${hours}h`;
  return `em ${Math.round(hours / 24)}d`;
}

export function SchedulerCard({ scheduler }: { scheduler: SchedulerListItem }) {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const run = useRunScheduler(scheduler.id);
  const pause = usePauseScheduler(scheduler.id);
  const resume = useResumeScheduler(scheduler.id);
  const del = useDeleteScheduler();

  const cadence = cadenceLabel(cronToCadence(scheduler.cronPattern));

  async function handleDelete(e: React.MouseEvent) {
    e.stopPropagation();
    setMenuOpen(false);
    if (!confirm("Excluir este scheduler? Os vídeos já gerados continuam em Jobs.")) return;
    await del.mutateAsync(scheduler.id);
  }

  return (
    <div
      onClick={() => navigate(`/schedulers/${scheduler.id}`)}
      className="group relative cursor-pointer rounded-xl border border-nyx-border bg-nyx-surface p-4 transition-colors hover:border-nyx-cyan-500/40"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-nyx-text-primary">{scheduler.name}</p>
          <p className="mt-0.5 truncate text-xs text-nyx-text-muted">{scheduler.templateName}</p>
        </div>

        <div className="relative shrink-0" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="rounded-lg p-1.5 text-nyx-text-muted hover:bg-nyx-hover hover:text-nyx-text-primary"
          >
            <MoreVertical className="h-4 w-4" />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-full z-10 mt-1 w-44 overflow-hidden rounded-xl border border-nyx-border bg-nyx-elevated shadow-xl">
              <button
                onClick={() => { setMenuOpen(false); run.mutate(); }}
                disabled={run.isPending}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-nyx-text-secondary hover:bg-nyx-hover disabled:opacity-50"
              >
                <Play className="h-3.5 w-3.5" /> Rodar agora
              </button>
              <button
                onClick={() => { setMenuOpen(false); scheduler.enabled ? pause.mutate() : resume.mutate(); }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-nyx-text-secondary hover:bg-nyx-hover"
              >
                <Pause className="h-3.5 w-3.5" /> {scheduler.enabled ? "Pausar" : "Retomar"}
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setMenuOpen(false); navigate(`/schedulers/${scheduler.id}/edit`); }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-nyx-text-secondary hover:bg-nyx-hover"
              >
                <Pencil className="h-3.5 w-3.5" /> Editar
              </button>
              <button
                onClick={handleDelete}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-red-400 hover:bg-nyx-hover"
              >
                <Trash2 className="h-3.5 w-3.5" /> Excluir
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-nyx-text-muted">
        <span>{formatSchedulerFormat(scheduler)}</span>
        <span className="text-nyx-border">·</span>
        <span className={cn("flex items-center gap-1", !scheduler.enabled && "text-yellow-500")}>
          <CalendarClock className="h-3.5 w-3.5" />
          {!scheduler.enabled ? "pausado" : scheduler.nextRunAt ? `próximo ${timeUntil(scheduler.nextRunAt)}` : cadence}
        </span>
      </div>

      {scheduler.lastRun && (
        <div className="mt-3 flex items-center gap-2">
          <RunStatusBadge status={scheduler.lastRun.status} />
          <span className="text-xs text-nyx-text-muted">
            {scheduler.lastRun.partsDone}/{scheduler.lastRun.partsTotal} partes
          </span>
        </div>
      )}
    </div>
  );
}
