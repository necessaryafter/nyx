import { Loader2, Film, Layers, Coins, AlertCircle } from "lucide-react";
import { useRenderJob } from "../../hooks/useJobs";
import { Button } from "../../components/ui/Button";
import type { Job } from "../../lib/types";

function formatMs(ms: number) {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function Step4_Confirm({
  job,
  onRendering,
}: {
  job: Job;
  onRendering: () => void;
}) {
  const renderJob = useRenderJob(job.id);

  const slots = job.sceneSlots ?? [];
  const totalDurationMs = slots.length > 0
    ? slots[slots.length - 1]!.endMs - slots[0]!.startMs
    : 0;
  const estimatedDurationSec = Math.ceil(totalDurationMs / 1000);
  const renderCredits = Math.max(1, Math.ceil(estimatedDurationSec / 60)) * 10;

  async function handleRender() {
    await renderJob.mutateAsync();
    onRendering();
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Confirmar e renderizar</h2>
        <p className="text-sm text-white/50 mt-1">
          Revise os detalhes antes de renderizar.
        </p>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/5 divide-y divide-white/10">
        <div className="flex items-center gap-3 px-4 py-3">
          <Layers className="w-4 h-4 text-white/40 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-white/40">Cenas</p>
            <p className="text-sm font-medium">{slots.length} cena{slots.length !== 1 ? "s" : ""}</p>
          </div>
        </div>

        <div className="flex items-center gap-3 px-4 py-3">
          <Film className="w-4 h-4 text-white/40 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-white/40">Duração estimada</p>
            <p className="text-sm font-medium">
              {slots.length > 0
                ? `${estimatedDurationSec}s (${formatMs(totalDurationMs)})`
                : "—"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 px-4 py-3">
          <Coins className="w-4 h-4 text-white/40 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-white/40">Créditos de renderização</p>
            <p className="text-sm font-medium">{renderCredits} créditos</p>
          </div>
        </div>
      </div>

      {renderJob.isError && (
        <div className="flex items-center gap-2 px-3 py-2.5 bg-red-500/10 border border-red-500/20 rounded-lg">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
          <p className="text-sm text-red-300">
            {(renderJob.error as { body?: { error?: string } })?.body?.error === "insufficient credits"
              ? "Créditos insuficientes para renderizar."
              : "Erro ao iniciar renderização. Tente novamente."}
          </p>
        </div>
      )}

      <div className="flex justify-end pt-2">
        <Button
          disabled={renderJob.isPending}
          onClick={handleRender}
          className="bg-nyx-cyan-500 hover:bg-nyx-cyan-400 text-nyx-900"
        >
          {renderJob.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
          ) : null}
          Renderizar
        </Button>
      </div>
    </div>
  );
}
