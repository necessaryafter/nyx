import { useState } from "react";
import { Check, X } from "lucide-react";
import { Button } from "../ui/Button";
import { Skeleton } from "../ui/Skeleton";
import { cn } from "../../lib/cn";
import { useImportBatch, useConfirmImport, useDiscardImport } from "../../hooks/useAssetImports";

interface Props {
  batchId: string;
  onClose: () => void;
}

function formatDuration(ms: number) {
  return `${Math.round(ms / 1000)}s`;
}

export function ImportReviewModal({ batchId, onClose }: Props) {
  const { data: batch, isPending } = useImportBatch(batchId);
  const confirmImport = useConfirmImport(batchId);
  const discardImport = useDiscardImport();
  const [selected, setSelected] = useState<Set<number> | null>(null);
  const [names, setNames] = useState<Record<number, string>>({});

  const segments = batch?.segments ?? [];
  const activeSelected = selected ?? new Set(segments.filter((s) => s.selected).map((s) => s.index));
  const stillProcessing = batch?.status === "detecting";

  const toggle = (index: number) => {
    const next = new Set(activeSelected);
    if (next.has(index)) next.delete(index);
    else next.add(index);
    setSelected(next);
  };

  const handleConfirm = async () => {
    const result = await confirmImport.mutateAsync({ selectedIndexes: [...activeSelected], names });
    // Parcial (lote continua "detecting"): fecha o modal, mas segue processando — dá pra
    // confirmar de novo depois. Final: não sobra nada pra revisar, fecha de vez.
    if (result.status === "done" || !stillProcessing) onClose();
    else setSelected(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="flex max-h-[85vh] w-full max-w-4xl flex-col rounded-2xl border border-nyx-border bg-nyx-deep shadow-2xl">
        <div className="flex items-center justify-between border-b border-nyx-border px-6 py-4">
          <div>
            <h2 className="font-display text-base font-bold text-nyx-text-primary">Revisar cortes</h2>
            <p className="mt-0.5 text-xs text-nyx-text-muted">
              {batch ? `${batch.sourceName} · ${segments.length} trechos prontos` : "Carregando..."}
              {stillProcessing && <span className="ml-1 text-nyx-cyan-500">· ainda processando outros cortes...</span>}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-nyx-text-muted hover:bg-nyx-hover hover:text-nyx-text-primary transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {isPending ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {Array.from({ length: 6 }, (_, i) => (
                <Skeleton key={i} className="aspect-[9/16] w-full rounded-xl" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {segments.map((seg) => {
                const isSelected = activeSelected.has(seg.index);
                return (
                  <div
                    key={seg.index}
                    className={cn(
                      "overflow-hidden rounded-xl border bg-nyx-surface transition-colors",
                      isSelected ? "border-nyx-cyan-500" : "border-nyx-border opacity-60",
                    )}
                  >
                    <button onClick={() => toggle(seg.index)} className="relative block aspect-[9/16] w-full">
                      <img src={seg.thumbnailUrl} alt={`Trecho ${seg.index}`} className="h-full w-full object-cover" />
                      <span
                        className={cn(
                          "absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full border-2",
                          isSelected ? "border-nyx-cyan-500 bg-nyx-cyan-500 text-nyx-void" : "border-white/70 bg-black/30",
                        )}
                      >
                        {isSelected && <Check className="h-3.5 w-3.5" />}
                      </span>
                      <span className="absolute bottom-2 right-2 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white">
                        {formatDuration(seg.endMs - seg.startMs)}
                      </span>
                    </button>
                    <input
                      value={names[seg.index] ?? seg.name ?? `Parte ${seg.index}`}
                      onChange={(e) => setNames((prev) => ({ ...prev, [seg.index]: e.target.value }))}
                      className="w-full border-t border-nyx-border bg-transparent px-2 py-1.5 text-xs text-nyx-text-secondary focus:outline-none"
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-nyx-border px-6 py-4">
          <Button
            variant="ghost"
            size="sm"
            disabled={discardImport.isPending}
            onClick={() => discardImport.mutate(batchId, { onSuccess: onClose })}
          >
            Cancelar importação
          </Button>
          <Button
            variant="primary"
            size="sm"
            disabled={activeSelected.size === 0 || confirmImport.isPending}
            onClick={handleConfirm}
          >
            {stillProcessing ? "Salvar" : "Confirmar"} ({activeSelected.size} selecionados)
          </Button>
        </div>
      </div>
    </div>
  );
}
