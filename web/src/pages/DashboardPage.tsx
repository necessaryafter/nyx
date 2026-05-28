import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import { ArrowUp, Film, LayoutTemplate, FolderOpen, Coins, Download, RotateCcw } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { authClient } from "../lib/auth";
import { useCreditsBalance, useRecentJobs } from "../hooks/useDashboardData";
import { useCreateDraftJob } from "../hooks/useJobs";
import { useTemplates } from "../hooks/useTemplates";
import { api } from "../lib/api";
import { cn } from "../lib/cn";
import { Skeleton } from "../components/ui/Skeleton";
import type { Job, JobStatus } from "../lib/types";

/* ── Status config ───────────────────────────────────────── */

const STATUS: Record<JobStatus, { label: string; color: string }> = {
  done:             { label: "Concluído",         color: "text-nyx-green" },
  rendering:        { label: "Renderizando",       color: "text-nyx-teal"  },
  processing:       { label: "Renderizando",       color: "text-nyx-teal"  },
  pending:          { label: "Pendente",           color: "text-nyx-3"     },
  draft:            { label: "Rascunho",           color: "text-nyx-3"     },
  audio_processing: { label: "Gerando áudio",      color: "text-nyx-amber" },
  audio_ready:      { label: "Áudio pronto",       color: "text-nyx-amber" },
  ready:            { label: "Pronto p/ render",   color: "text-nyx-amber" },
  failed:           { label: "Falhou",             color: "text-nyx-red"   },
};

function fmtTime(iso: string) {
  const d = Date.now() - new Date(iso).getTime();
  if (d < 60_000) return "agora";
  if (d < 3_600_000) return `${Math.floor(d / 60_000)}min`;
  if (d < 86_400_000) return `${Math.floor(d / 3_600_000)}h`;
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function fmtDur(s: number | null) {
  if (!s) return null;
  return `${Math.floor(s / 60)}m ${(s % 60).toString().padStart(2, "0")}s`;
}

/* ── Job row ─────────────────────────────────────────────── */

function JobRow({ job }: { job: Job }) {
  const s = STATUS[job.status];
  const isActive = ["rendering", "processing", "audio_processing"].includes(job.status);

  return (
    <div className="group flex items-center gap-3 px-4 py-2.5 border-b border-nyx-line last:border-b-0 hover:bg-nyx-raised transition-colors">
      {/* Status dot */}
      <span
        className="status-dot shrink-0"
        data-status={job.status}
      />

      {/* Status label */}
      <span className={cn("w-32 shrink-0 text-[11px] font-display font-semibold uppercase tracking-wide", s.color, isActive && "animate-pulse-teal")}>
        {s.label}
      </span>

      {/* Job ID */}
      <span className="flex-1 min-w-0 font-mono text-xs text-nyx-3 truncate">
        {job.id.slice(0, 8)}
      </span>

      {/* Duration */}
      {fmtDur(job.durationSeconds) && (
        <span className="hidden sm:block font-mono text-xs text-nyx-3 tabular-nums">
          {fmtDur(job.durationSeconds)}
        </span>
      )}

      {/* Time */}
      <span className="hidden md:block text-xs text-nyx-3 w-14 text-right shrink-0">
        {fmtTime(job.createdAt)}
      </span>

      {/* Actions */}
      <div className="w-20 shrink-0 flex justify-end">
        {job.status === "done" && (
          <button
            onClick={() => api.get<{ url: string }>(`/api/jobs/${job.id}/download`).then(r => window.open(r.url, "_blank"))}
            className="flex items-center gap-1 text-[11px] font-display font-semibold uppercase tracking-wide text-nyx-3 hover:text-nyx-teal transition-colors"
          >
            <Download className="h-3 w-3" />
            baixar
          </button>
        )}
        {job.status === "failed" && (
          <Link
            to={`/jobs/${job.id}/edit`}
            className="flex items-center gap-1 text-[11px] font-display font-semibold uppercase tracking-wide text-nyx-3 hover:text-nyx-red transition-colors"
          >
            <RotateCcw className="h-3 w-3" />
            retry
          </Link>
        )}
        {["draft", "audio_ready", "ready"].includes(job.status) && (
          <Link
            to={`/jobs/${job.id}/edit`}
            className="text-[11px] font-display font-semibold uppercase tracking-wide text-nyx-3 hover:text-nyx-1 transition-colors"
          >
            continuar →
          </Link>
        )}
      </div>
    </div>
  );
}

/* ── Shortcuts ───────────────────────────────────────────── */

const SHORTCUTS = [
  { icon: Film,           label: "Jobs",      href: "/jobs"      },
  { icon: LayoutTemplate, label: "Templates", href: "/templates" },
  { icon: FolderOpen,     label: "Assets",    href: "/assets"    },
  { icon: Coins,          label: "Créditos",  href: "/credits"   },
];

/* ── Dashboard ───────────────────────────────────────────── */

export function DashboardPage() {
  const { data: session } = authClient.useSession();
  const credits = useCreditsBalance();
  const jobs = useRecentJobs(8);
  const templates = useTemplates(0);
  const createDraft = useCreateDraftJob();
  const navigate = useNavigate();

  const [idea, setIdea] = useState("");
  const [sending, setSending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const firstName = session?.user.name?.split(" ")[0] ?? "";

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
  }, [idea]);

  const handleSubmit = useCallback(async () => {
    if (!idea.trim() || sending) return;
    setSending(true);
    try {
      const firstTemplate = templates.data?.data[0];
      if (firstTemplate) {
        const job = await createDraft.mutateAsync(firstTemplate.id);
        // Store idea for Step2 to pick up
        sessionStorage.setItem("nyx-idea", idea.trim());
        navigate(`/jobs/${job.id}/edit`);
      } else {
        // No templates — go create one first
        navigate("/templates/new");
      }
    } finally {
      setSending(false);
    }
  }, [idea, sending, templates.data, createDraft, navigate]);

  const hasJobs = (jobs.data?.total ?? 0) > 0;

  return (
    <div className="flex flex-col items-center min-h-[calc(100dvh-44px)] px-4 py-12">

      {/* ── Hero: chat ────────────────────────────────────── */}
      <motion.div
        className="w-full max-w-2xl"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      >
        {/* Greeting */}
        <div className="mb-8 text-center">
          <p className="font-logo text-sm tracking-[0.25em] uppercase text-nyx-3 mb-3">NYX</p>
          <h1 className="font-display text-2xl font-bold text-nyx-1">
            {firstName ? `Que vídeo você quer criar hoje, ${firstName}?` : "Que vídeo você quer criar hoje?"}
          </h1>
          {credits.data && (
            <p className="mt-2 text-xs text-nyx-3 font-mono">
              {credits.data.balance} créditos disponíveis
            </p>
          )}
        </div>

        {/* Input */}
        <div className="nyx-panel p-px overflow-hidden">
          <div className="bg-nyx-raised rounded-[2px]">
            <textarea
              ref={textareaRef}
              value={idea}
              onChange={e => setIdea(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSubmit(); }}
              placeholder="Descreva o vídeo: tema, tom, duração, público alvo..."
              rows={3}
              disabled={sending}
              className={cn(
                "w-full resize-none bg-transparent px-4 pt-4 pb-2",
                "text-sm text-nyx-1 placeholder:text-nyx-3",
                "outline-none font-body leading-relaxed",
                "disabled:opacity-50",
              )}
            />
            <div className="flex items-center justify-between px-3 pb-3">
              <span className="text-[11px] text-nyx-3 font-mono">
                {idea.length > 0 ? `${idea.length} chars · ` : ""}Ctrl+Enter para enviar
              </span>
              <button
                onClick={handleSubmit}
                disabled={!idea.trim() || sending}
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-[3px] transition-all",
                  idea.trim() && !sending
                    ? "bg-nyx-teal text-nyx-void hover:opacity-90"
                    : "bg-nyx-overlay text-nyx-3 cursor-not-allowed",
                )}
              >
                {sending
                  ? <span className="h-3.5 w-3.5 border border-current border-t-transparent rounded-full animate-spin" />
                  : <ArrowUp className="h-3.5 w-3.5" />
                }
              </button>
            </div>
          </div>
        </div>

        {/* Shortcuts */}
        <div className="mt-4 flex items-center justify-center gap-1">
          {SHORTCUTS.map((s) => (
            <Link
              key={s.href}
              to={s.href}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-[3px] text-xs font-display font-semibold uppercase tracking-wide text-nyx-3 hover:text-nyx-2 hover:bg-nyx-raised transition-colors"
            >
              <s.icon className="h-3 w-3" />
              {s.label}
            </Link>
          ))}
        </div>
      </motion.div>

      {/* ── Recent jobs ───────────────────────────────────── */}
      <AnimatePresence>
        {(hasJobs || jobs.isPending) && (
          <motion.div
            className="w-full max-w-2xl mt-12"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="flex items-center justify-between mb-3 px-1">
              <span className="label">Atividade recente</span>
              <Link to="/jobs" className="text-[11px] font-display font-semibold uppercase tracking-wide text-nyx-3 hover:text-nyx-teal transition-colors">
                Ver todos →
              </Link>
            </div>

            <div className="nyx-panel overflow-hidden">
              {jobs.isPending ? (
                <div className="p-4 space-y-3">
                  {Array.from({ length: 4 }, (_, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <Skeleton className="h-1.5 w-1.5 rounded-full shrink-0" />
                      <Skeleton className="h-3 w-24" />
                      <Skeleton className="h-3 flex-1" />
                      <Skeleton className="h-3 w-12" />
                    </div>
                  ))}
                </div>
              ) : (
                jobs.data?.data.map((job) => (
                  <JobRow key={job.id} job={job} />
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
