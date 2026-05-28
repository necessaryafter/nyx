import { useState, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, CheckCircle2, Clock, Upload, Sparkles, Library, Wand2 } from "lucide-react";
import { useUpdateSlots, useGenerateSlotImage, useGenerateSlotPrompts } from "../../hooks/useJobs";
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
          className="flex-1 bg-nyx-surface border border-nyx-border rounded-lg px-3 py-2 text-sm text-nyx-text-primary placeholder:text-nyx-text-muted focus:outline-none focus:border-nyx-cyan-500"
        />
        <button
          onClick={() => fileRef.current?.click()}
          className="flex items-center gap-1.5 px-3 py-2 bg-nyx-surface border border-nyx-border rounded-lg text-sm text-nyx-text-secondary hover:text-nyx-text-primary hover:border-nyx-hover transition-colors"
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
          <Loader2 className="w-4 h-4 animate-spin text-nyx-text-muted" />
        </div>
      ) : data?.data.length === 0 ? (
        <p className="text-sm text-nyx-text-muted text-center py-3">
          Nenhuma imagem. Faça upload acima.
        </p>
      ) : (
        <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto">
          {data?.data.map((asset) => (
            <button
              key={asset.id}
              onClick={() => onSelect(asset)}
              className="aspect-video rounded-lg bg-nyx-surface border border-nyx-border hover:border-nyx-cyan-500/50 transition-colors flex items-center justify-center text-xs text-nyx-text-muted hover:text-nyx-text-secondary p-1 truncate"
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

type SlotMode = "closed" | "library" | "ai";

function SlotCard({
  slot,
  index,
  jobId,
  onAssetSelected,
  externalPrompt,
}: {
  slot: SceneSlot;
  index: number;
  jobId: string;
  onAssetSelected: (assetId: string) => void;
  externalPrompt?: string;
}) {
  const [mode, setMode] = useState<SlotMode>("closed");
  const [aiPrompt, setAiPrompt] = useState(externalPrompt ?? slot.narrationText ?? "");
  const generateImage = useGenerateSlotImage(jobId);
  const filled = slot.assetId !== null;

  function toggle(next: SlotMode) {
    setMode((m) => (m === next ? "closed" : next));
  }

  async function handleGenerate() {
    if (!aiPrompt.trim()) return;
    const { assetId } = await generateImage.mutateAsync({ slotIndex: slot.index, prompt: aiPrompt });
    onAssetSelected(assetId);
    setMode("closed");
  }

  return (
    <div
      className={cn(
        "rounded-xl border p-4 transition-colors",
        filled ? "border-green-500/30 bg-green-500/5" : "border-nyx-border bg-nyx-surface",
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-2">
            {filled ? (
              <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
            ) : (
              <Clock className="w-4 h-4 text-nyx-text-muted shrink-0" />
            )}
            <span className="font-medium text-sm text-nyx-text-primary">Cena {index + 1}</span>
          </div>
          <p className="text-xs text-nyx-text-muted">
            {formatMs(slot.startMs)} – {formatMs(slot.endMs)}
            {" "}({((slot.endMs - slot.startMs) / 1000).toFixed(1)}s)
          </p>
          {slot.narrationText && (
            <p className="text-xs text-nyx-text-muted truncate max-w-[280px]" title={slot.narrationText}>
              "{slot.narrationText}"
            </p>
          )}
          {filled && (
            <p className="text-xs text-green-500">✓ Imagem atribuída</p>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => toggle("library")}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors",
              mode === "library"
                ? "border-nyx-cyan-500/50 bg-nyx-cyan-500/10 text-nyx-cyan-500"
                : "border-nyx-border text-nyx-text-muted hover:border-nyx-hover hover:text-nyx-text-secondary",
            )}
          >
            <Library className="w-3.5 h-3.5" />
            Biblioteca
          </button>
          <button
            onClick={() => toggle("ai")}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors",
              mode === "ai"
                ? "border-nyx-orange-500/50 bg-nyx-orange-500/10 text-nyx-orange-400"
                : "border-nyx-border text-nyx-text-muted hover:border-nyx-hover hover:text-nyx-text-secondary",
            )}
          >
            <Sparkles className="w-3.5 h-3.5" />
            Gerar com IA
          </button>
        </div>
      </div>

      {mode === "library" && (
        <div className="mt-4 border-t border-nyx-border pt-4">
          <AssetPicker
            onSelect={(asset) => {
              onAssetSelected(asset.id);
              setMode("closed");
            }}
          />
        </div>
      )}

      {mode === "ai" && (
        <div className="mt-4 border-t border-nyx-border pt-4 space-y-3">
          <label className="text-xs text-nyx-text-secondary">
            Descreva a cena para gerar a imagem
          </label>
          <textarea
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
            rows={3}
            disabled={generateImage.isPending}
            className="w-full resize-none bg-nyx-surface border border-nyx-border rounded-lg px-3 py-2 text-sm text-nyx-text-primary placeholder:text-nyx-text-muted focus:outline-none focus:border-nyx-orange-500 disabled:opacity-50"
          />
          {generateImage.isError && (
            <p className="text-xs text-red-500">Erro ao gerar imagem. Tente novamente.</p>
          )}
          <div className="flex justify-end">
            <button
              onClick={handleGenerate}
              disabled={!aiPrompt.trim() || generateImage.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-nyx-orange-500 text-white hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {generateImage.isPending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Sparkles className="w-3.5 h-3.5" />
              )}
              {generateImage.isPending ? "Gerando..." : "Gerar imagem"}
            </button>
          </div>
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
  const [generatedPrompts, setGeneratedPrompts] = useState<string[]>([]);
  const updateSlots = useUpdateSlots(jobId);
  const generatePrompts = useGenerateSlotPrompts(jobId);
  const qc = useQueryClient();

  const allFilled = localSlots.length > 0 && localSlots.every((s) => s.assetId !== null);

  async function handleGeneratePrompts() {
    const { prompts } = await generatePrompts.mutateAsync();
    setGeneratedPrompts(prompts);
  }

  async function handleAssetSelected(index: number, assetId: string) {
    const updated = localSlots.map((s) =>
      s.index === index ? { ...s, assetId } : s,
    );
    setLocalSlots(updated);

    await updateSlots.mutateAsync([{ index, assetId }]);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-nyx-text-primary">Definir mídias por cena</h2>
          <p className="text-sm text-nyx-text-secondary mt-1">
            Atribua uma imagem a cada cena da narração.{" "}
            {localSlots.length} cena{localSlots.length !== 1 ? "s" : ""} detectada
            {localSlots.length !== 1 ? "s" : ""}.
          </p>
        </div>
        {localSlots.length > 0 && (
          <button
            onClick={handleGeneratePrompts}
            disabled={generatePrompts.isPending}
            className="flex shrink-0 items-center gap-1.5 rounded-lg border border-nyx-orange-500/40 bg-nyx-orange-500/10 px-3 py-1.5 text-xs font-medium text-nyx-orange-400 transition-opacity hover:opacity-80 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {generatePrompts.isPending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Wand2 className="w-3.5 h-3.5" />
            )}
            {generatePrompts.isPending ? "Gerando prompts..." : "Gerar prompts com IA"}
          </button>
        )}
      </div>
      {generatePrompts.isError && (
        <p className="text-xs text-red-500">
          {(generatePrompts.error as Error)?.message ?? "Erro ao gerar prompts. Tente novamente."}
        </p>
      )}

      {localSlots.length === 0 ? (
        <p className="text-sm text-nyx-text-muted py-6 text-center">
          Nenhum slot detectado. Verifique se o áudio foi gerado corretamente.
        </p>
      ) : (
        <div className="space-y-3">
          {localSlots.map((slot, i) => (
            <SlotCard
              key={slot.index}
              slot={slot}
              index={i}
              jobId={jobId}
              onAssetSelected={(assetId) => handleAssetSelected(slot.index, assetId)}
              externalPrompt={generatedPrompts[i]}
            />
          ))}
        </div>
      )}

      {updateSlots.isError && (
        <p className="text-sm text-red-500">
          Erro ao salvar. Tente novamente.
        </p>
      )}

      <div className="flex items-center justify-between pt-2">
        <p className="text-sm text-nyx-text-muted">
          {localSlots.filter((s) => s.assetId !== null).length}/{localSlots.length} preenchidas
        </p>
        <Button
          disabled={!allFilled || updateSlots.isPending}
          onClick={() => qc.invalidateQueries({ queryKey: ["jobs", "detail", jobId] })}
        >
          {updateSlots.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
          ) : null}
          Próximo
        </Button>
      </div>
    </div>
  );
}
