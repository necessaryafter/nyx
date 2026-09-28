import { Loader2, Clock, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { cn } from "../../lib/cn";
import type { SchedulerRunStatus } from "../../lib/types";

const MAP: Record<SchedulerRunStatus, { label: string; icon: React.ElementType; cls: string; spin?: boolean }> = {
  pending: { label: "Pendente", icon: Clock, cls: "text-white/50 bg-white/5" },
  scripting: { label: "Gerando roteiro", icon: Loader2, cls: "text-nyx-cyan-500 bg-nyx-cyan-500/10", spin: true },
  rendering: { label: "Renderizando", icon: Loader2, cls: "text-nyx-cyan-500 bg-nyx-cyan-500/10", spin: true },
  done: { label: "Concluído", icon: CheckCircle2, cls: "text-green-400 bg-green-500/10" },
  partial: { label: "Parcial", icon: AlertTriangle, cls: "text-yellow-400 bg-yellow-500/10" },
  failed: { label: "Falhou", icon: XCircle, cls: "text-red-400 bg-red-500/10" },
};

export function RunStatusBadge({ status }: { status: SchedulerRunStatus }) {
  const { label, icon: Icon, cls, spin } = MAP[status];
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium", cls)}>
      <Icon className={cn("h-3.5 w-3.5 shrink-0", spin && "animate-spin")} />
      {label}
    </span>
  );
}
