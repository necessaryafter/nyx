import { useState } from "react";
import type React from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import {
  Clock,
  Loader2,
  CheckCircle2,
  XCircle,
  Download,
  MoreVertical,
  Clapperboard,
  X,
  Copy,
  Check,
  ExternalLink,
  Play,
  ArrowRight,
} from "lucide-react";
import { Button } from "../components/ui/Button";
import { Skeleton } from "../components/ui/Skeleton";
import { CreateJobModal } from "../components/jobs/CreateJobModal";
import { cn } from "../lib/cn";
import { useJobs, useJobDownload, useJobsWebSocket } from "../hooks/useJobs";
import type { Job, JobStatus } from "../lib/types";

const IN_PROGRESS_STATUSES = new Set(["draft", "audio_processing", "audio_ready", "ready"]);

const fade = (delay = 0) => ({
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.35, delay, ease: [0.16, 1, 0.3, 1] as const },
});

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "agora";
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d`;
}

function formatDuration(seconds: number | null) {
  if (!seconds) return null;
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function StatusBadge({ status }: { status: JobStatus }) {
  const map: Record<string, { label: string; icon: React.ElementType; cls: string; spin?: boolean }> = {
    draft: { label: "Rascunho", icon: Clock, cls: "text-white/50 bg-white/5" },
    audio_processing: { label: "Gerando áudio", icon: Loader2, cls: "text-nyx-cyan-500 bg-nyx-cyan-500/10", spin: true },
    audio_ready: { label: "Aguardando mídias", icon: Clock, cls: "text-yellow-400 bg-yellow-500/10" },
    ready: { label: "Pronto p/ render", icon: CheckCircle2, cls: "text-nyx-cyan-400 bg-nyx-cyan-500/10" },
    rendering: { label: "Renderizando", icon: Loader2, cls: "text-nyx-cyan-500 bg-nyx-cyan-500/10", spin: true },
    pending: { label: "Pendente", icon: Clock, cls: "text-orange-400 bg-orange-500/10" },
    processing: { label: "Processando", icon: Loader2, cls: "text-nyx-cyan-500 bg-nyx-cyan-500/10", spin: true },
    done: { label: "Concluído", icon: CheckCircle2, cls: "text-green-400 bg-green-500/10" },
    failed: { label: "Falhou", icon: XCircle, cls: "text-red-400 bg-red-500/10" },
  };

  const { label, icon: Icon, cls, spin } = map[status] ?? map["pending"]!;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
        cls,
      )}
    >
      <Icon className={cn("h-3.5 w-3.5 shrink-0", spin && "animate-spin")} />
      {label}
    </span>
  );
}

// Job detail drawer
function JobDrawer({
  job,
  onClose,
}: {
  job: Job | null;
  onClose: () => void;
}) {
  const getDownload = useJobDownload();
  const [downloading, setDownloading] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleDownload = async () => {
    if (!job) return;
    setDownloading(true);
    try {
      const url = await getDownload(job.id);
      const a = document.createElement("a");
      a.href = url;
      a.download = "";
      a.click();
    } finally {
      setDownloading(false);
    }
  };

  const copyError = () => {
    if (job?.error) {
      navigator.clipboard.writeText(job.error);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <AnimatePresence>
      {job && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 z-40 bg-black/50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Drawer */}
          <motion.aside
            className="fixed inset-y-0 right-0 z-50 w-full max-w-sm overflow-y-auto border-l border-nyx-border bg-nyx-elevated shadow-2xl"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="flex h-14 items-center justify-between border-b border-nyx-border px-5">
              <span className="font-mono text-sm text-nyx-text-muted">
                Job #{job.id.slice(0, 8)}...
              </span>
              <button
                onClick={onClose}
                className="rounded p-1 text-nyx-text-muted transition-colors hover:bg-nyx-hover hover:text-nyx-text-primary"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-6 p-5">
              {/* Status */}
              <section>
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-nyx-text-muted">
                  Status
                </p>
                <StatusBadge status={job.status} />
                <div className="mt-3 space-y-1 text-sm text-nyx-text-secondary">
                  <p>Criado: {new Date(job.createdAt).toLocaleString("pt-BR")}</p>
                  {job.completedAt && (
                    <p>Concluído: {new Date(job.completedAt).toLocaleString("pt-BR")}</p>
                  )}
                </div>
              </section>

              <div className="h-px bg-nyx-border" />

              {/* Costs */}
              <section>
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-nyx-text-muted">
                  Custos
                </p>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-nyx-text-secondary">Total debitado</span>
                  <span className="font-mono text-nyx-text-primary">
                    {job.creditsCharged ?? "—"} cr
                  </span>
                </div>
              </section>

              {/* Video info */}
              {job.durationSeconds && (
                <>
                  <div className="h-px bg-nyx-border" />
                  <section>
                    <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-nyx-text-muted">
                      Vídeo
                    </p>
                    <div className="space-y-1 text-sm text-nyx-text-secondary">
                      <p>Duração: {formatDuration(job.durationSeconds)}</p>
                    </div>
                    {job.status === "done" && (
                      <Button
                        variant="primary"
                        size="md"
                        className="mt-3 w-full"
                        onClick={handleDownload}
                        disabled={downloading}
                      >
                        {downloading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Download className="h-4 w-4" />
                        )}
                        Download do vídeo
                      </Button>
                    )}
                  </section>
                </>
              )}

              {/* Error */}
              {job.status === "failed" && job.error && (
                <>
                  <div className="h-px bg-nyx-border" />
                  <section>
                    <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-red-400">
                      Erro
                    </p>
                    <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3">
                      <p className="font-mono text-xs text-red-300">{job.error}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-2"
                      onClick={copyError}
                    >
                      {copied ? (
                        <Check className="h-3.5 w-3.5" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                      {copied ? "Copiado!" : "Copiar erro"}
                    </Button>
                  </section>
                </>
              )}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

// Mobile card layout
function JobCard({ job, onDetail }: { job: Job; onDetail: () => void }) {
  const getDownload = useJobDownload();
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setDownloading(true);
    try {
      const url = await getDownload(job.id);
      const a = document.createElement("a");
      a.href = url;
      a.download = "";
      a.click();
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div
      className="cursor-pointer rounded-xl border border-nyx-border bg-nyx-surface p-4 transition-colors hover:border-nyx-hover"
      onClick={onDetail}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <StatusBadge status={job.status} />
            <span className="text-xs text-nyx-text-muted">{timeAgo(job.createdAt)}</span>
          </div>
          <p className="mt-1.5 truncate text-sm font-medium text-nyx-text-primary">
            {job.templateName ?? job.templateId}
          </p>
          <p className="mt-0.5 font-mono text-xs text-nyx-text-muted">
            {job.creditsCharged != null && `${job.creditsCharged} cr`}
            {job.durationSeconds && ` · ${formatDuration(job.durationSeconds)}`}
          </p>
          {job.status === "failed" && job.error && (
            <p className="mt-1 text-xs text-red-400 line-clamp-1">{job.error}</p>
          )}
        </div>
        <div className="flex items-center gap-1">
          {IN_PROGRESS_STATUSES.has(job.status) && (
            <Link
              to={`/jobs/${job.id}/edit`}
              onClick={(e) => e.stopPropagation()}
              className="rounded p-1.5 text-nyx-cyan-400 transition-colors hover:bg-nyx-cyan-500/10"
              title="Retomar"
            >
              <ArrowRight className="h-4 w-4" />
            </Link>
          )}
          {job.status === "done" && (
            <button
              onClick={handleDownload}
              className="rounded p-1.5 text-nyx-cyan-500 transition-colors hover:bg-nyx-cyan-500/10"
            >
              {downloading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
            </button>
          )}
          <button className="rounded p-1.5 text-nyx-text-muted transition-colors hover:bg-nyx-hover">
            <MoreVertical className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

const STATUS_FILTERS: { label: string; value: JobStatus | "all" }[] = [
  { label: "Todos", value: "all" },
  { label: "Pendente", value: "pending" },
  { label: "Processando", value: "processing" },
  { label: "Concluído", value: "done" },
  { label: "Falhou", value: "failed" },
];

export function JobsPage() {
  const [page, setPage] = useState(0);
  const [statusFilter, setStatusFilter] = useState<JobStatus | "all">("all");
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [showCreateJob, setShowCreateJob] = useState(false);

  useJobsWebSocket();

  const jobs = useJobs(
    page,
    statusFilter === "all" ? undefined : statusFilter,
  );
  const getDownload = useJobDownload();

  const total = jobs.data?.total ?? 0;
  const limit = 20;
  const totalPages = Math.ceil(total / limit);
  const hasData = (jobs.data?.data.length ?? 0) > 0;

  const handleDownload = async (job: Job, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const url = await getDownload(job.id);
      const a = document.createElement("a");
      a.href = url;
      a.download = "";
      a.click();
    } catch {}
  };

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <motion.div
          className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
          {...fade(0)}
        >
          <h1 className="font-display text-xl font-bold text-nyx-text-primary">
            Jobs
          </h1>
          <button
            onClick={() => setShowCreateJob(true)}
            className="flex items-center gap-2 rounded-lg bg-nyx-orange-600 px-4 py-2 text-sm font-bold uppercase tracking-tight text-white transition-all hover:bg-nyx-orange-500 shadow-lg shadow-nyx-orange-900/20"
          >
            <Play className="h-3.5 w-3.5 fill-current" />
            Criar vídeo
          </button>
        </motion.div>

        {/* Status tabs */}
        <motion.div
          className="flex gap-1 border-b border-nyx-border"
          {...fade(0.05)}
        >
          {STATUS_FILTERS.map((f) => {
            const active = statusFilter === f.value;
            return (
              <button
                key={f.value}
                onClick={() => {
                  setStatusFilter(f.value);
                  setPage(0);
                }}
                className={cn(
                  "relative px-4 py-2.5 text-sm transition-colors duration-150",
                  active
                    ? "text-nyx-text-primary"
                    : "text-nyx-text-secondary hover:text-nyx-text-primary",
                )}
              >
                {f.label}
                {active && (
                  <motion.span
                    layoutId="jobs-tab-indicator"
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-nyx-cyan-500"
                  />
                )}
              </button>
            );
          })}
        </motion.div>

        {/* Table — Desktop */}
        {jobs.isPending ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-14 w-full rounded-xl" />
            ))}
          </div>
        ) : !hasData ? (
          <motion.div
            className="flex flex-col items-center justify-center gap-4 py-20 text-center"
            {...fade(0.1)}
          >
            <Clapperboard className="h-16 w-16 text-nyx-text-muted opacity-40" />
            <div>
              <p className="text-lg font-medium text-nyx-text-primary">
                Nenhum render ainda
              </p>
              <p className="mt-1 text-sm text-nyx-text-muted">
                Crie um template e inicie seu primeiro render
              </p>
            </div>
            <Link to="/templates">
              <Button variant="secondary" size="sm">
                <ExternalLink className="h-4 w-4" />
                Ir para Templates
              </Button>
            </Link>
          </motion.div>
        ) : (
          <>
            {/* Desktop table */}
            <motion.div
              className="hidden overflow-hidden rounded-xl border border-nyx-border sm:block"
              {...fade(0.05)}
            >
              <table className="w-full">
                <thead>
                  <tr className="border-b border-nyx-border bg-nyx-surface">
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-nyx-text-muted">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-nyx-text-muted">
                      Template
                    </th>
                    <th className="hidden px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-nyx-text-muted lg:table-cell">
                      Créditos
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-nyx-text-muted">
                      Data
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-nyx-text-muted">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-nyx-border bg-nyx-deep">
                  {jobs.data!.data.map((job, i) => (
                    <motion.tr
                      key={job.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.03 }}
                      className="cursor-pointer transition-colors hover:bg-nyx-surface/50"
                      onClick={() => setSelectedJob(job)}
                    >
                      <td className="px-4 py-3.5">
                        <StatusBadge status={job.status} />
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="text-sm text-nyx-text-primary">
                          {job.templateName ?? job.templateId}
                        </span>
                      </td>
                      <td className="hidden px-4 py-3.5 text-right lg:table-cell">
                        <span className="font-mono text-sm text-nyx-text-secondary">
                          {job.creditsCharged != null ? `${job.creditsCharged} cr` : "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <span className="font-mono text-sm text-nyx-text-muted">
                          {timeAgo(job.createdAt)}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {job.status === "done" && (
                            <button
                              onClick={(e) => handleDownload(job, e)}
                              className="rounded p-1.5 text-nyx-cyan-500 transition-colors hover:bg-nyx-cyan-500/10"
                              title="Baixar vídeo"
                            >
                              <Download className="h-4 w-4" />
                            </button>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedJob(job);
                            }}
                            className="rounded p-1.5 text-nyx-text-muted transition-colors hover:bg-nyx-hover hover:text-nyx-text-primary"
                          >
                            <MoreVertical className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </motion.div>

            {/* Mobile cards */}
            <div className="space-y-3 sm:hidden">
              {jobs.data!.data.map((job, i) => (
                <motion.div
                  key={job.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                >
                  <JobCard job={job} onDetail={() => setSelectedJob(job)} />
                </motion.div>
              ))}
            </div>

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
          </>
        )}
      </div>

      {/* Job detail drawer */}
      <JobDrawer job={selectedJob} onClose={() => setSelectedJob(null)} />

      {showCreateJob && (
        <CreateJobModal onClose={() => setShowCreateJob(false)} />
      )}
    </>
  );
}
