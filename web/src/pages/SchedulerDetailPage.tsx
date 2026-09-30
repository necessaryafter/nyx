import { useParams, Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, Play, Pause, Pencil, Trash2, CalendarClock } from "lucide-react";
import { Button } from "../components/ui/Button";
import { RunRow } from "../components/schedulers/RunRow";
import { formatSchedulerFormat, cadenceLabel, cronToCadence } from "../lib/scheduler";
import {
  useScheduler,
  useRunScheduler,
  usePauseScheduler,
  useResumeScheduler,
  useDeleteScheduler,
  useSchedulersWebSocket,
} from "../hooks/useSchedulers";

export function SchedulerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  useSchedulersWebSocket();

  const scheduler = useScheduler(id ?? "");
  const run = useRunScheduler(id ?? "");
  const pause = usePauseScheduler(id ?? "");
  const resume = useResumeScheduler(id ?? "");
  const del = useDeleteScheduler();

  async function handleDelete() {
    if (!id) return;
    if (!confirm("Excluir este scheduler? Os vídeos já gerados continuam em Jobs.")) return;
    await del.mutateAsync(id);
    navigate("/schedulers");
  }

  if (scheduler.isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-nyx-void">
        <Loader2 className="h-5 w-5 animate-spin text-nyx-text-muted" />
      </div>
    );
  }

  if (scheduler.isError || !scheduler.data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-nyx-void">
        <div className="text-center">
          <p className="text-sm text-nyx-text-primary">Scheduler não encontrado</p>
          <Link to="/schedulers" className="mt-3 inline-block text-xs text-nyx-cyan-500">Voltar</Link>
        </div>
      </div>
    );
  }

  const s = scheduler.data;
  const cadence = cadenceLabel(cronToCadence(s.cronPattern));

  return (
    <div className="min-h-screen bg-nyx-void text-nyx-text-primary">
      <div className="mx-auto max-w-3xl space-y-6 px-6 py-8">
        <Link to="/schedulers" className="inline-flex items-center gap-2 text-xs text-nyx-text-muted hover:text-nyx-text-primary">
          <ArrowLeft className="h-4 w-4" />
          Schedulers
        </Link>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-xl font-bold">{s.name}</h1>
            <p className="mt-1 text-sm text-nyx-text-muted">{s.templateName}</p>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-nyx-text-muted">
              <span>{formatSchedulerFormat(s)}</span>
              <span className="text-nyx-border">·</span>
              <span className="flex items-center gap-1">
                <CalendarClock className="h-3.5 w-3.5" />
                {!s.enabled ? "pausado" : s.nextRunAt ? `próximo em ${new Date(s.nextRunAt).toLocaleString("pt-BR")}` : cadence}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={() => run.mutate()} disabled={run.isPending}>
              <Play className="h-3.5 w-3.5" /> Rodar agora
            </Button>
            <Button variant="secondary" size="sm" onClick={() => (s.enabled ? pause.mutate() : resume.mutate())}>
              <Pause className="h-3.5 w-3.5" /> {s.enabled ? "Pausar" : "Retomar"}
            </Button>
            <Link to={`/schedulers/${s.id}/edit`}>
              <Button variant="secondary" size="sm">
                <Pencil className="h-3.5 w-3.5" /> Editar
              </Button>
            </Link>
            <Button variant="ghost" size="sm" onClick={handleDelete} className="text-red-400">
              <Trash2 className="h-3.5 w-3.5" /> Excluir
            </Button>
          </div>
        </div>

        <div className="h-px bg-nyx-border" />

        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-nyx-text-muted">Execuções</p>
          {s.runs.length === 0 ? (
            <p className="py-10 text-center text-sm text-nyx-text-muted">Nenhuma execução ainda. Clique em "Rodar agora".</p>
          ) : (
            <div className="space-y-2">
              {s.runs.map((run) => (
                <RunRow key={run.id} run={run} schedulerId={s.id} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
