import { Scissors, Film } from "lucide-react";
import { Button } from "../ui/Button";
import { useFallbackChoice, useDiscardImport } from "../../hooks/useAssetImports";

interface Props {
  batchId: string;
  sourceName: string;
}

export function FallbackChoiceModal({ batchId, sourceName }: Props) {
  const fallback = useFallbackChoice(batchId);
  const discard = useDiscardImport();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl border border-nyx-border bg-nyx-deep p-6 shadow-2xl">
        <h2 className="font-display text-base font-bold text-nyx-text-primary">
          Não encontramos cortes de cena em "{sourceName}"
        </h2>
        <p className="mt-1.5 text-sm text-nyx-text-muted">O que você quer fazer com esse vídeo?</p>

        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <button
            disabled={fallback.isPending}
            onClick={() => fallback.mutate("fixed")}
            className="flex flex-col items-center gap-2 rounded-xl border border-nyx-border bg-nyx-surface p-4 text-center transition-colors hover:border-nyx-cyan-500/50 hover:bg-nyx-hover disabled:opacity-50"
          >
            <Scissors className="h-6 w-6 text-nyx-cyan-500" />
            <span className="text-sm font-medium text-nyx-text-primary">Dividir em pedaços de 45s</span>
          </button>
          <button
            disabled={fallback.isPending}
            onClick={() => fallback.mutate("single")}
            className="flex flex-col items-center gap-2 rounded-xl border border-nyx-border bg-nyx-surface p-4 text-center transition-colors hover:border-nyx-cyan-500/50 hover:bg-nyx-hover disabled:opacity-50"
          >
            <Film className="h-6 w-6 text-nyx-cyan-500" />
            <span className="text-sm font-medium text-nyx-text-primary">Manter como 1 vídeo só</span>
          </button>
        </div>

        <div className="mt-4 flex justify-end">
          <Button variant="ghost" size="sm" disabled={discard.isPending} onClick={() => discard.mutate(batchId)}>
            Cancelar importação
          </Button>
        </div>
      </div>
    </div>
  );
}
