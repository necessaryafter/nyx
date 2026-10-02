import { useState } from "react";
import { ChevronDown, Download, FolderDown, Loader2, RotateCcw, Copy, Check, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "../../lib/cn";
import { Button } from "../ui/Button";
import { RunStatusBadge } from "./RunStatusBadge";
import { useJobDownload, useRetryJob } from "../../hooks/useJobs";
import type { SchedulerRun, JobStatus } from "../../lib/types";

const PART_STATUS_LABEL: Record<JobStatus, string> = {
  draft: "Rascunho",
  audio_processing: "Gerando áudio",
  audio_ready: "Áudio pronto",
  ready: "Pronto p/ render",
  rendering: "Renderizando",
  done: "Concluído",
  failed: "Falhou",
};

function formatDuration(seconds: number | null): string {
  if (!seconds) return "—";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s.toString().padStart(2, "0")}s`;
}

function PartRow({ part }: { part: SchedulerRun["parts"][number] }) {
  const getDownload = useJobDownload();
  const retry = useRetryJob();
  const [downloading, setDownloading] = useState(false);

  async function handleDownload() {
    setDownloading(true);
    try {
      const url = await getDownload(part.jobId);
      const a = document.createElement("a");
      a.href = url;
      a.download = "";
      a.click();
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-nyx-border/60 bg-nyx-void/50 px-3 py-2">
      <div className="flex items-center gap-2 text-xs text-nyx-text-secondary">
        <span className="font-medium text-nyx-text-primary">Parte {part.partIndex}</span>
        <span className="text-nyx-text-muted">{PART_STATUS_LABEL[part.status]}</span>
        {part.durationSeconds != null && <span className="text-nyx-text-muted">· {formatDuration(part.durationSeconds)}</span>}
      </div>
      <div className="flex items-center gap-1.5">
        {part.status === "done" && part.hasVideo && (
          <Button variant="ghost" size="sm" onClick={handleDownload} disabled={downloading}>
            {downloading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            Baixar
          </Button>
        )}
        {part.status === "failed" && (
          <Button variant="ghost" size="sm" onClick={() => retry.mutate(part.jobId)} disabled={retry.isPending}>
            <RotateCcw className="h-3.5 w-3.5" /> Tentar novamente
          </Button>
        )}
        <Link to="/jobs" className="text-nyx-text-muted hover:text-nyx-text-primary" title="Ver na tela de Jobs">
          <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}

export function RunRow({ run, schedulerId }: { run: SchedulerRun; schedulerId: string }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const readyParts = run.parts.filter((p) => p.status === "done" && p.hasVideo).length;

  function copyError() {
    if (!run.error) return;
    navigator.clipboard.writeText(run.error);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="rounded-xl border border-nyx-border bg-nyx-surface">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <div className="flex min-w-0 items-center gap-3">
          <RunStatusBadge status={run.status} />
          <span className="truncate text-sm text-nyx-text-primary">{run.title ?? "Roteiro em geração..."}</span>
        </div>
        <div className="flex shrink-0 items-center gap-3 text-xs text-nyx-text-muted">
          <span>{run.partsDone}/{run.partsTotal} partes</span>
          <span>{run.triggeredBy === "manual" ? "manual" : "agendado"}</span>
          <span>{new Date(run.createdAt).toLocaleString("pt-BR")}</span>
          <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
        </div>
      </button>

      {open && (
        <div className="space-y-3 border-t border-nyx-border px-4 py-3">
          {run.error && (
            <div className="space-y-2">
              <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3">
                <p className="whitespace-pre-line font-mono text-xs text-red-300">{run.error}</p>
              </div>
              <Button variant="ghost" size="sm" onClick={copyError}>
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? "Copiado!" : "Copiar erro"}
              </Button>
            </div>
          )}

          {readyParts > 1 && (
            <a
              href={`/api/schedulers/${schedulerId}/runs/${run.id}/download`}
              download
              className="inline-flex items-center gap-1.5 text-xs text-nyx-cyan-500 hover:underline"
            >
              <FolderDown className="h-3.5 w-3.5" />
              Baixar lote (.zip) — parte_1.mp4, parte_2.mp4...
            </a>
          )}

          <div className="space-y-2">
            {run.parts.map((part) => (
              <PartRow key={part.jobId} part={part} />
            ))}
            {run.parts.length === 0 && <p className="text-xs text-nyx-text-muted">Nenhuma parte criada ainda.</p>}
          </div>
        </div>
      )}
    </div>
  );
}
