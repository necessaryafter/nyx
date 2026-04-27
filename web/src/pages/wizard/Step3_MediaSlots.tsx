import { useState, useRef } from "react";
import { Loader2, ImagePlus, CheckCircle2, Clock, Upload } from "lucide-react";
import { useUpdateSlots } from "../../hooks/useJobs";
import { useAssets, useUploadAsset } from "../../hooks/useAssets";
import { Button } from "../../components/ui/Button";
import { cn } from "../../lib/cn";
import type { SceneSlot, Asset } from "../../lib/types";

function formatMs(ms: number) {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function AssetPicker({
  onSelect,
}: {
  onSelect: (asset: Asset) => void;
}) {
  const [search, setSearch] = useState("");
  const { data, isLoading } = useAssets(0, "image", search || undefined);
  const upload = useUploadAsset();
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    const asset = await upload.mutateAsync(file);
    onSelect(asset);
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="Buscar imagem..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-nyx-cyan-500/50"
        />
        <button
          onClick={() => fileRef.current?.click()}
          className="flex items-center gap-1.5 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white/60 hover:text-white hover:border-white/20 transition-colors"
        >
          {upload.isPending ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Upload className="w-3.5 h-3.5" />
          )}
          Upload
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
          }}
        />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-4">
          <Loader2 className="w-4 h-4 animate-spin text-white/40" />
        </div>
      ) : data?.data.length === 0 ? (
        <p className="text-sm text-white/40 text-center py-3">
          Nenhuma imagem. Faça upload acima.
        </p>
      ) : (
        <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto">
          {data?.data.map((asset) => (
            <button
              key={asset.id}
              onClick={() => onSelect(asset)}
              className="aspect-video rounded-lg bg-white/5 border border-white/10 hover:border-nyx-cyan-500/50 transition-colors flex items-center justify-center text-xs text-white/40 hover:text-white/70 p-1 truncate"
              title={asset.name}
            >
              <span className="truncate px-1">{asset.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function SlotCard({
  slot,
  index,
  onAssetSelected,
}: {
  slot: SceneSlot;
  index: number;
  onAssetSelected: (assetId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const filled = slot.assetId !== null;

  return (
    <div
      className={cn(
        "rounded-xl border p-4 transition-colors",
        filled ? "border-green-500/30 bg-green-500/5" : "border-white/10 bg-white/5",
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            {filled ? (
              <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
            ) : (
              <Clock className="w-4 h-4 text-white/30 shrink-0" />
            )}
            <span className="font-medium text-sm">Cena {index + 1}</span>
          </div>
          <p className="text-xs text-white/40">
            {formatMs(slot.startMs)} – {formatMs(slot.endMs)}
            {" "}({((slot.endMs - slot.startMs) / 1000).toFixed(1)}s)
          </p>
          {filled && (
            <p className="text-xs text-green-400/80 truncate max-w-[200px]">
              ✓ Imagem atribuída
            </p>
          )}
        </div>

        <button
          onClick={() => setOpen(!open)}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors shrink-0",
            filled
              ? "border-green-500/30 text-green-400 hover:bg-green-500/10"
              : "border-white/10 text-white/60 hover:border-nyx-cyan-500/50 hover:text-nyx-cyan-300",
          )}
        >
          <ImagePlus className="w-3.5 h-3.5" />
          {filled ? "Trocar" : "Escolher"}
        </button>
      </div>

      {open && (
        <div className="mt-4 border-t border-white/10 pt-4">
          <AssetPicker
            onSelect={(asset) => {
              onAssetSelected(asset.id);
              setOpen(false);
            }}
          />
        </div>
      )}
    </div>
  );
}

export function Step3_MediaSlots({
  jobId,
  slots,
}: {
  jobId: string;
  slots: SceneSlot[];
}) {
  const [localSlots, setLocalSlots] = useState<SceneSlot[]>(slots);
  const updateSlots = useUpdateSlots(jobId);

  const allFilled = localSlots.length > 0 && localSlots.every((s) => s.assetId !== null);

  async function handleAssetSelected(index: number, assetId: string) {
    const updated = localSlots.map((s) =>
      s.index === index ? { ...s, assetId } : s,
    );
    setLocalSlots(updated);

    // Salva no backend imediatamente
    await updateSlots.mutateAsync([{ index, assetId }]);
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Definir mídias por cena</h2>
        <p className="text-sm text-white/50 mt-1">
          Atribua uma imagem a cada cena da narração.{" "}
          {localSlots.length} cena{localSlots.length !== 1 ? "s" : ""} detectada
          {localSlots.length !== 1 ? "s" : ""}.
        </p>
      </div>

      {localSlots.length === 0 ? (
        <p className="text-sm text-white/40 py-6 text-center">
          Nenhum slot detectado. Verifique se o áudio foi gerado corretamente.
        </p>
      ) : (
        <div className="space-y-3">
          {localSlots.map((slot, i) => (
            <SlotCard
              key={slot.index}
              slot={slot}
              index={i}
              onAssetSelected={(assetId) => handleAssetSelected(slot.index, assetId)}
            />
          ))}
        </div>
      )}

      {updateSlots.isError && (
        <p className="text-sm text-red-400">
          Erro ao salvar. Tente novamente.
        </p>
      )}

      <div className="flex items-center justify-between pt-2">
        <p className="text-sm text-white/40">
          {localSlots.filter((s) => s.assetId !== null).length}/{localSlots.length} preenchidas
        </p>
        <Button disabled={!allFilled || updateSlots.isPending}>
          {updateSlots.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
          ) : null}
          Próximo
        </Button>
      </div>
    </div>
  );
}
