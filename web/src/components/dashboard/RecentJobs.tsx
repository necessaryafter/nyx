import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { Download, RotateCcw, Film, Trash2 } from "lucide-react";
import type { UseQueryResult } from "@tanstack/react-query";
import type { PaginatedResponse, Job, JobStatus } from "../../lib/types";
import { api } from "../../lib/api";
import { useDeleteJob, useRetryJob } from "../../hooks/useJobs";
import { Button } from "../ui/Button";
import { Skeleton } from "../ui/Skeleton";
import { cn } from "../../lib/cn";

/* ── Status config ──────────────────────────── */

const STATUS_CONFIG: Record<
  JobStatus,
  { label: string; dotClass: string; textClass: string }
> = {
  done: {
    label: "Concluído",
    dotClass: "bg-nyx-success",
    textClass: "text-nyx-success",
  },
  rendering: {
    label: "Renderizando",
    dotClass: "bg-nyx-orange-500 animate-pulse",
    textClass: "text-nyx-orange-500",
  },
  draft: {
    label: "Rascunho",
    dotClass: "bg-nyx-text-muted",
    textClass: "text-nyx-text-muted",
  },
  audio_processing: {
    label: "Processando áudio",
    dotClass: "bg-nyx-orange-500 animate-pulse",
    textClass: "text-nyx-orange-500",
  },
  audio_ready: {
    label: "Áudio pronto",
    dotClass: "bg-nyx-orange-500 animate-pulse",
    textClass: "text-nyx-orange-500",
  },
  ready: {
    label: "Pronto",
    dotClass: "bg-nyx-orange-500 animate-pulse",
    textClass: "text-nyx-orange-500",
  },
  failed: {
    label: "Falhou",
    dotClass: "bg-nyx-error",
    textClass: "text-nyx-error",
  },
};

/* ── Helpers ─────────────────────────────────── */

function formatDuration(seconds: number | null): string {
  if (!seconds) return "—";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s.toString().padStart(2, "0")}s`;
}

function formatTime(iso: string): string {
  const date = new Date(iso);
  const now = Date.now();
  const diff = now - date.getTime();

  if (diff < 60_000) return "agora";
  if (diff < 3_600_000) return `há ${Math.floor(diff / 60_000)}min`;
  if (diff < 86_400_000) return `há ${Math.floor(diff / 3_600_000)}h`;
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

async function handleDownload(jobId: string) {
  const { url } = await api.get<{ url: string }>(
    `/api/jobs/${jobId}/download`,
  );
  window.open(url, "_blank");
}

/* ── Job Row ─────────────────────────────────── */

function JobRow({ job, onDelete, onRetry }: { job: Job; onDelete: (id: string) => void; onRetry: (id: string) => void }) {
  const status = STATUS_CONFIG[job.status];

  return (
    <div className="flex items-center gap-4 rounded-lg px-4 py-3 transition-colors hover:bg-nyx-hover/50">
      {/* Status */}
      <div className="flex w-28 shrink-0 items-center gap-2">
        <div className={cn("h-2 w-2 shrink-0 rounded-full", status.dotClass)} />
        <span className={cn("text-xs font-medium", status.textClass)}>
          {status.label}
        </span>
      </div>

      {/* ID */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-nyx-text-primary">
          {job.id.slice(0, 8)}
        </p>
      </div>

      {/* Duration */}
      <span className="hidden font-mono text-xs text-nyx-text-secondary sm:block">
        {formatDuration(job.durationSeconds)}
      </span>

      {/* Time */}
      <span className="hidden text-xs text-nyx-text-muted md:block">
        {formatTime(job.createdAt)}
      </span>

      {/* Action */}
      <div className="w-24 shrink-0 text-right">
        {job.status === "done" && (
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              handleDownload(job.id);
            }}
          >
            <Download className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Download</span>
          </Button>
        )}
        {job.status === "failed" && (
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => { e.stopPropagation(); onRetry(job.id); }}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Retry</span>
          </Button>
        )}
        {job.status === "draft" && (
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(job.id);
            }}
            className="text-nyx-text-muted hover:text-red-400"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Apagar</span>
          </Button>
        )}
      </div>
    </div>
  );
}

/* ── Skeleton ────────────────────────────────── */

function JobRowSkeleton() {
  return (
    <div className="flex items-center gap-4 px-4 py-3">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-4 flex-1" />
      <Skeleton className="hidden h-4 w-16 sm:block" />
      <Skeleton className="h-4 w-20" />
    </div>
  );
}

/* ── Empty State ─────────────────────────────── */

function EmptyJobs() {
  return (
    <div className="flex flex-col items-center gap-3 py-12 text-center">
      <Film className="h-10 w-10 text-nyx-text-muted/30" />
      <div>
        <p className="text-sm font-medium text-nyx-text-secondary">
          Nenhum job ainda
        </p>
        <p className="mt-1 text-xs text-nyx-text-muted">
          Crie um template e renderize seu primeiro vídeo.
        </p>
      </div>
      <Link to="/templates/new">
        <Button variant="ghost" size="sm">
          Criar template →
        </Button>
      </Link>
    </div>
  );
}

/* ── Main ────────────────────────────────────── */

interface RecentJobsProps {
  jobs: UseQueryResult<PaginatedResponse<Job>>;
}

export function RecentJobs({ jobs }: RecentJobsProps) {
  const deleteJob = useDeleteJob();
  const retryJob = useRetryJob();

  return (
    <div className="rounded-xl border border-nyx-border bg-nyx-surface">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-nyx-border px-4 py-3">
        <h3 className="font-display text-sm font-semibold text-nyx-text-primary">
          Jobs recentes
        </h3>
        <Link
          to="/jobs"
          className="text-xs text-nyx-cyan-500 transition-colors hover:text-nyx-cyan-400"
        >
          Ver todos →
        </Link>
      </div>

      {/* Content */}
      <div className="divide-y divide-nyx-border/50">
        {jobs.isPending ? (
          Array.from({ length: 3 }, (_, i) => <JobRowSkeleton key={i} />)
        ) : !jobs.data?.data.length ? (
          <EmptyJobs />
        ) : (
          jobs.data.data.map((job, i) => (
            <motion.div
              key={job.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.25, delay: i * 0.06, ease: [0.16, 1, 0.3, 1] }}
            >
              <JobRow job={job} onDelete={deleteJob.mutate} onRetry={retryJob.mutate} />
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}
