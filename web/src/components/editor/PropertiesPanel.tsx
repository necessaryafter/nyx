import { AnimatePresence, motion } from "motion/react";
import { MousePointer2, X, Plus, Trash2, Search, Check, Video, Mic, Sparkles, Captions, Music, Clapperboard, Film, Play, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { useState, useRef } from "react";
import { useEditorStore } from "../../stores/editorStore";
import { useAssets } from "../../hooks/useAssets";
import { useVoices } from "../../hooks/useVoices";
import { cn } from "../../lib/cn";
import type {
  MediaPoolConfig,
  SceneSlotConfig,
  VideoFitConfig,
  TTSConfig,
  SubtitleConfig,
  SubtitleStyle,
  RenderConfig,
  OverlayConfig,
  TransitionConfig,
  TransitionType,
  ZoomConfig,
  ShakeConfig,
} from "../../lib/types";

// Asset picker modal
function AssetPickerModal({
  type,
  currentIds,
  onConfirm,
  onClose,
}: {
  type: "video" | "audio";
  currentIds: string[];
  onConfirm: (ids: string[]) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set(currentIds));
  const assets = useAssets(0, type, search || undefined);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-[480px] max-h-[70vh] flex flex-col rounded-2xl border border-nyx-border bg-nyx-surface shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-nyx-border px-5 py-4">
          <p className="text-sm font-semibold text-nyx-text-primary">
            Selecionar {type === "video" ? "Vídeos" : "Músicas"}
          </p>
          <button onClick={onClose} className="text-nyx-text-muted hover:text-nyx-text-primary">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Search */}
        <div className="relative border-b border-nyx-border px-5 py-3">
          <Search className="pointer-events-none absolute left-8 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-nyx-text-muted" />
          <input
            type="text"
            placeholder="Buscar..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 w-full rounded-lg border border-nyx-border bg-nyx-void pl-8 pr-3 text-xs text-nyx-text-primary placeholder:text-nyx-text-muted focus:border-nyx-cyan-500 focus:outline-none"
          />
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          {assets.isPending && (
            <p className="py-8 text-center text-xs text-nyx-text-muted">Carregando...</p>
          )}
          {!assets.isPending && (assets.data?.data.length ?? 0) === 0 && (
            <p className="py-8 text-center text-xs text-nyx-text-muted">
              Nenhum {type === "video" ? "vídeo" : "áudio"} encontrado
            </p>
          )}
          {assets.data?.data.filter((a) => a.type === type).map((asset) => {
            const isSelected = selected.has(asset.id);
            return (
              <button
                key={asset.id}
                onClick={() => toggle(asset.id)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors",
                  isSelected
                    ? "border-nyx-cyan-500 bg-nyx-cyan-500/10"
                    : "border-nyx-border bg-nyx-void hover:border-nyx-hover",
                )}
              >
                <div className={cn(
                  "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                  isSelected ? "border-nyx-cyan-500 bg-nyx-cyan-500" : "border-nyx-border",
                )}>
                  {isSelected && <Check className="h-2.5 w-2.5 text-white" />}
                </div>
                <span className="flex-1 truncate text-xs text-nyx-text-primary">{asset.name}</span>
                {asset.sizeBytes && (
                  <span className="text-[10px] text-nyx-text-muted shrink-0">
                    {(asset.sizeBytes / (1024 * 1024)).toFixed(1)} MB
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-nyx-border px-5 py-3">
          <span className="text-xs text-nyx-text-muted">{selected.size} selecionado(s)</span>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="rounded-lg px-3 py-1.5 text-xs text-nyx-text-secondary hover:bg-nyx-hover"
            >
              Cancelar
            </button>
            <button
              onClick={() => onConfirm(Array.from(selected))}
              className="rounded-lg bg-nyx-cyan-500 px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90"
            >
              Confirmar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 py-2">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-nyx-text-muted">
        {children}
      </span>
      <div className="flex-1 border-t border-nyx-border" />
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="mb-1 block text-xs font-medium text-nyx-text-secondary">
      {children}
    </label>
  );
}

const inputCls =
  "h-8 w-full rounded-lg border border-nyx-border bg-nyx-void px-2.5 text-xs text-nyx-text-primary focus:border-nyx-cyan-500 focus:outline-none";

const selectCls =
  "h-8 w-full rounded-lg border border-nyx-border bg-nyx-void px-2.5 text-xs text-nyx-text-primary focus:border-nyx-cyan-500 focus:outline-none";

const ASSET_TYPE_LABELS: Record<string, { plural: string; picker: "video" | "audio" }> = {
  video: { plural: "Vídeos", picker: "video" },
  audio: { plural: "Áudios", picker: "audio" },
  image: { plural: "Imagens", picker: "video" }, // images use video picker (no separate asset type yet)
};

// MediaPool properties
function MediaPoolProps({ config, nodeId }: { config: MediaPoolConfig; nodeId: string }) {
  const update = useEditorStore((s) => s.updateNodeConfig);
  const assetIds = config.assetIds ?? [];
  const assetType = config.assetType ?? "video";
  const [pickerOpen, setPickerOpen] = useState(false);
  const typeInfo = ASSET_TYPE_LABELS[assetType] ?? ASSET_TYPE_LABELS.video;

  const removeAsset = (id: string) => {
    update(nodeId, { assetIds: assetIds.filter((a) => a !== id) });
  };

  return (
    <div className="space-y-3">
      {pickerOpen && (
        <AssetPickerModal
          type={typeInfo.picker}
          currentIds={assetIds}
          onConfirm={(ids) => { update(nodeId, { assetIds: ids }); setPickerOpen(false); }}
          onClose={() => setPickerOpen(false)}
        />
      )}

      <SectionLabel>Tipo de mídia</SectionLabel>
      <div>
        <FieldLabel>Tipo do pool</FieldLabel>
        <select
          value={assetType}
          onChange={(e) => update(nodeId, { assetType: e.target.value as MediaPoolConfig["assetType"], assetIds: [] })}
          className={selectCls}
        >
          <option value="video">Vídeo</option>
          <option value="audio">Áudio</option>
          <option value="image">Imagem</option>
        </select>
      </div>

      <SectionLabel>{typeInfo.plural} no pool</SectionLabel>
      {assetIds.length === 0 ? (
        <p className="text-xs text-nyx-text-muted">Nenhum asset adicionado</p>
      ) : (
        <div className="space-y-1">
          {assetIds.map((id) => (
            <div
              key={id}
              className="flex items-center justify-between rounded-lg border border-nyx-border bg-nyx-void px-2.5 py-1.5"
            >
              <span className="font-mono text-xs text-nyx-text-secondary truncate">
                {id.slice(0, 12)}...
              </span>
              <button
                onClick={() => removeAsset(id)}
                className="ml-2 text-nyx-text-muted hover:text-red-400"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
      <button
        onClick={() => setPickerOpen(true)}
        className="flex items-center gap-1 text-xs text-nyx-cyan-500 hover:opacity-80"
      >
        <Plus className="h-3 w-3" />
        Adicionar {typeInfo.plural.toLowerCase()}
      </button>
    </div>
  );
}

// SceneSlot properties
function SceneSlotProps({ config, nodeId }: { config: SceneSlotConfig; nodeId: string }) {
  const update = useEditorStore((s) => s.updateNodeConfig);

  return (
    <div className="space-y-3">
      <SectionLabel>Identificação</SectionLabel>
      <div>
        <FieldLabel>Label do slot</FieldLabel>
        <input
          type="text"
          value={config.label ?? ""}
          onChange={(e) => update(nodeId, { label: e.target.value })}
          className={inputCls}
          placeholder="Ex: Cena principal"
        />
      </div>
      <div>
        <FieldLabel>Tipo de asset</FieldLabel>
        <select
          value={config.assetType ?? "video"}
          onChange={(e) => update(nodeId, { assetType: e.target.value as SceneSlotConfig["assetType"] })}
          className={selectCls}
        >
          <option value="video">Vídeo</option>
          <option value="audio">Áudio</option>
          <option value="image">Imagem</option>
        </select>
      </div>
      <div className="rounded-lg border border-nyx-cyan-500/20 bg-nyx-cyan-500/5 p-2.5">
        <p className="text-[10px] text-nyx-text-muted leading-relaxed">
          Este slot não tem assets fixos no template. O asset será escolhido pelo usuário na hora de renderizar.
        </p>
      </div>
    </div>
  );
}

// VideoFit properties
function VideoFitProps({ config, nodeId }: { config: VideoFitConfig; nodeId: string }) {
  const update = useEditorStore((s) => s.updateNodeConfig);

  return (
    <div className="space-y-3">
      <SectionLabel>Modo</SectionLabel>
      <div>
        <FieldLabel>Modo de montagem</FieldLabel>
        <select
          value={config.mode ?? "random-loop"}
          onChange={(e) => update(nodeId, { mode: e.target.value })}
          className={selectCls}
        >
          <option value="random-loop">Aleatório (loop)</option>
          <option value="sequential">Sequencial (loop)</option>
          <option value="once">Uma vez (sem loop)</option>
        </select>
      </div>
      <div className="rounded-lg border border-nyx-border bg-nyx-void/50 p-2.5">
        <p className="text-[10px] text-nyx-text-muted leading-relaxed">
          {config.mode === "sequential"
            ? "Vídeos usados em ordem. Reinicia do início quando o pool esgota."
            : config.mode === "once"
            ? "Vídeos usados em ordem uma única vez. O vídeo de saída pode ser mais curto que o áudio."
            : "Vídeos selecionados aleatoriamente e repetidos até cobrir a duração do áudio."}
        </p>
      </div>
    </div>
  );
}

// TTS properties
function TTSProps({ config, nodeId }: { config: TTSConfig; nodeId: string }) {
  const update = useEditorStore((s) => s.updateNodeConfig);
  const { data: voices, isLoading: voicesLoading } = useVoices();
  const [voiceSearch, setVoiceSearch] = useState("");
  const [showEffects, setShowEffects] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const effects = (config.providerConfig?.effects ?? {}) as Record<string, number>;

  const updateEffect = (key: string, value: number) => {
    update(nodeId, {
      providerConfig: {
        ...config.providerConfig,
        effects: { ...effects, [key]: value },
      },
    });
  };

  const filteredVoices = voices?.filter((v) =>
    v.name.toLowerCase().includes(voiceSearch.toLowerCase()),
  ) ?? [];

  const selectedVoice = voices?.find((v) => v.id === config.voice);

  const playPreview = (previewUrl: string) => {
    audioRef.current?.pause();
    audioRef.current = new Audio(previewUrl);
    audioRef.current.play();
  };

  return (
    <div className="space-y-3">
      <SectionLabel>Provider</SectionLabel>
      <div>
        <FieldLabel>Provider *</FieldLabel>
        <select
          value={config.provider ?? "talkify"}
          onChange={(e) => update(nodeId, { provider: e.target.value })}
          className={selectCls}
        >
          <option value="talkify">Talkify</option>
          <option value="custom">Custom (upload)</option>
        </select>
      </div>

      {config.provider !== "custom" && (
        <div className="space-y-1.5">
          <FieldLabel>Voz</FieldLabel>

          {/* Selected voice preview */}
          {selectedVoice && (
            <div className="flex items-center justify-between rounded-lg border border-nyx-cyan-500/40 bg-nyx-cyan-500/5 px-2.5 py-1.5">
              <div>
                <span className="text-xs text-nyx-text-primary">{selectedVoice.name}</span>
                <span className="ml-1.5 text-[10px] text-nyx-text-muted capitalize">{selectedVoice.gender}</span>
              </div>
              <button
                onClick={() => playPreview(selectedVoice.previewUrl)}
                className="flex h-5 w-5 items-center justify-center rounded-full bg-nyx-cyan-500/20 text-nyx-cyan-500 hover:bg-nyx-cyan-500/30"
                title="Ouvir prévia"
              >
                <Play className="h-2.5 w-2.5 fill-current" />
              </button>
            </div>
          )}

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-nyx-text-muted" />
            <input
              type="text"
              placeholder="Buscar voz..."
              value={voiceSearch}
              onChange={(e) => setVoiceSearch(e.target.value)}
              className="w-full rounded-lg border border-nyx-border bg-nyx-void py-1.5 pl-7 pr-3 text-xs text-nyx-text-primary placeholder:text-nyx-text-muted focus:border-nyx-cyan-500 focus:outline-none"
            />
          </div>

          {/* Voice list */}
          <div className="max-h-40 overflow-y-auto rounded-lg border border-nyx-border bg-nyx-void">
            {voicesLoading ? (
              <div className="flex items-center justify-center gap-2 py-4 text-xs text-nyx-text-muted">
                <Loader2 className="h-3 w-3 animate-spin" />
                Carregando vozes...
              </div>
            ) : filteredVoices.length === 0 ? (
              <p className="py-3 text-center text-xs text-nyx-text-muted">Nenhuma voz encontrada</p>
            ) : (
              filteredVoices.map((voice) => {
                const selected = config.voice === voice.id;
                return (
                  <div
                    key={voice.id}
                    className={cn(
                      "flex cursor-pointer items-center justify-between px-2.5 py-1.5 hover:bg-nyx-hover",
                      selected && "bg-nyx-cyan-500/10",
                    )}
                    onClick={() => update(nodeId, { voice: voice.id })}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {selected && <Check className="h-3 w-3 shrink-0 text-nyx-cyan-500" />}
                      {!selected && <span className="h-3 w-3 shrink-0" />}
                      <span className="truncate text-xs text-nyx-text-primary">{voice.name}</span>
                      <span className="shrink-0 text-[10px] text-nyx-text-muted capitalize">{voice.gender}</span>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); playPreview(voice.previewUrl); }}
                      className="ml-2 shrink-0 text-nyx-text-muted hover:text-nyx-cyan-500"
                      title="Ouvir prévia"
                    >
                      <Play className="h-3 w-3 fill-current" />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      <SectionLabel>Ajustes</SectionLabel>
      <div>
        <FieldLabel>Velocidade: {(config.speed ?? 1.0).toFixed(1)}x</FieldLabel>
        <input
          type="range"
          min={0.5}
          max={2.0}
          step={0.1}
          value={config.speed ?? 1.0}
          onChange={(e) => update(nodeId, { speed: parseFloat(e.target.value) })}
          className="w-full accent-nyx-cyan-500"
        />
      </div>

      {/* Advanced effects (Talkify only) */}
      {config.provider === "talkify" && (
        <div>
          <button
            onClick={() => setShowEffects((v) => !v)}
            className="flex w-full items-center justify-between text-[11px] font-medium text-nyx-text-secondary hover:text-nyx-text-primary"
          >
            <span>Efeitos avançados</span>
            {showEffects ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
          {showEffects && (
            <div className="mt-2 space-y-2 rounded-lg border border-nyx-border bg-nyx-void/50 p-2.5">
              {[
                { key: "pitch", label: "Pitch", min: -500, max: 500, step: 10, unit: "ct" },
                { key: "reverb", label: "Reverb", min: 0, max: 100, step: 1, unit: "%" },
                { key: "echo", label: "Echo", min: 0, max: 500, step: 10, unit: "ms" },
                { key: "gain", label: "Gain", min: 0.5, max: 2.0, step: 0.1, unit: "x" },
              ].map(({ key, label, min, max, step, unit }) => (
                <div key={key}>
                  <FieldLabel>
                    {label}: {(effects[key] ?? (key === "gain" ? 1.0 : 0)).toFixed(key === "gain" ? 1 : 0)}{unit}
                  </FieldLabel>
                  <input
                    type="range"
                    min={min}
                    max={max}
                    step={step}
                    value={effects[key] ?? (key === "gain" ? 1.0 : 0)}
                    onChange={(e) => updateEffect(key, parseFloat(e.target.value))}
                    className="w-full accent-nyx-cyan-500"
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <SectionLabel>Info</SectionLabel>
      <div className="rounded-lg border border-nyx-border bg-nyx-void/50 p-2.5">
        <p className="text-[10px] text-nyx-text-muted leading-relaxed">
          {config.provider === "custom"
            ? "O usuário fará upload do áudio na hora de renderizar. WhisperX fará alinhamento automático."
            : "O texto da narração será definido na hora de renderizar, não no template. O template configura apenas provider, voz e velocidade."}
        </p>
      </div>
    </div>
  );
}

// Subtitle properties
function SubtitleProps({ config, nodeId }: { config: SubtitleConfig; nodeId: string }) {
  const update = useEditorStore((s) => s.updateNodeConfig);
  const style: SubtitleStyle = config.style ?? {};

  const updateStyle = (patch: Partial<SubtitleStyle>) => {
    update(nodeId, { style: { ...style, ...patch } });
  };

  return (
    <div className="space-y-3">
      <SectionLabel>Configuração</SectionLabel>
      <div>
        <FieldLabel>Palavras por grupo</FieldLabel>
        <input
          type="number"
          min={2}
          max={6}
          value={config.wordsPerGroup ?? 3}
          onChange={(e) => update(nodeId, { wordsPerGroup: parseInt(e.target.value) })}
          className={inputCls}
        />
      </div>

      <SectionLabel>Janela de tempo (opcional)</SectionLabel>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <FieldLabel>Início (s)</FieldLabel>
          <input
            type="number"
            min={0}
            step={0.5}
            placeholder="0"
            value={config.startSeconds ?? ""}
            onChange={(e) => update(nodeId, { startSeconds: e.target.value ? parseFloat(e.target.value) : undefined })}
            className={inputCls}
          />
        </div>
        <div>
          <FieldLabel>Fim (s)</FieldLabel>
          <input
            type="number"
            min={0}
            step={0.5}
            placeholder="fim"
            value={config.endSeconds ?? ""}
            onChange={(e) => update(nodeId, { endSeconds: e.target.value ? parseFloat(e.target.value) : undefined })}
            className={inputCls}
          />
        </div>
      </div>
      <p className="text-[10px] text-nyx-text-muted">
        Deixe em branco para legendas no vídeo inteiro.
      </p>

      <SectionLabel>Estilo</SectionLabel>
      <div>
        <FieldLabel>Posição</FieldLabel>
        <select
          value={style.position ?? "bottom"}
          onChange={(e) => updateStyle({ position: e.target.value as SubtitleStyle["position"] })}
          className={selectCls}
        >
          <option value="top">Topo</option>
          <option value="center">Centro</option>
          <option value="bottom">Rodapé</option>
        </select>
      </div>
      <div>
        <FieldLabel>Tamanho da fonte</FieldLabel>
        <input
          type="number"
          value={style.fontSize ?? 36}
          onChange={(e) => updateStyle({ fontSize: parseInt(e.target.value) })}
          className={inputCls}
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <FieldLabel>Cor do texto</FieldLabel>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={style.color ?? "#ffffff"}
              onChange={(e) => updateStyle({ color: e.target.value })}
              className="h-8 w-8 cursor-pointer rounded border border-nyx-border bg-nyx-void"
            />
            <input
              type="text"
              value={style.color ?? "#ffffff"}
              onChange={(e) => updateStyle({ color: e.target.value })}
              className={cn(inputCls, "flex-1")}
            />
          </div>
        </div>
        <div>
          <FieldLabel>Cor do highlight</FieldLabel>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={style.highlightColor ?? "#ffdd00"}
              onChange={(e) => updateStyle({ highlightColor: e.target.value })}
              className="h-8 w-8 cursor-pointer rounded border border-nyx-border bg-nyx-void"
            />
            <input
              type="text"
              value={style.highlightColor ?? "#ffdd00"}
              onChange={(e) => updateStyle({ highlightColor: e.target.value })}
              className={cn(inputCls, "flex-1")}
            />
          </div>
        </div>
        <div>
          <FieldLabel>Cor do stroke</FieldLabel>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={style.strokeColor ?? "#000000"}
              onChange={(e) => updateStyle({ strokeColor: e.target.value })}
              className="h-8 w-8 cursor-pointer rounded border border-nyx-border bg-nyx-void"
            />
            <input
              type="text"
              value={style.strokeColor ?? "#000000"}
              onChange={(e) => updateStyle({ strokeColor: e.target.value })}
              className={cn(inputCls, "flex-1")}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// Overlay properties
function OverlayProps({ config, nodeId }: { config: OverlayConfig; nodeId: string }) {
  const update = useEditorStore((s) => s.updateNodeConfig);
  const [assetPickerOpen, setAssetPickerOpen] = useState(false);
  const [soundPickerOpen, setSoundPickerOpen] = useState(false);

  const pos = config.position ?? { x: 0, y: 0, width: 200, height: 200 };
  const updatePos = (patch: Partial<typeof pos>) =>
    update(nodeId, { position: { ...pos, ...patch } });

  return (
    <div className="space-y-3">
      {assetPickerOpen && (
        <AssetPickerModal
          type="video"
          currentIds={config.assetId ? [config.assetId] : []}
          onConfirm={(ids) => { update(nodeId, { assetId: ids[0] ?? "" }); setAssetPickerOpen(false); }}
          onClose={() => setAssetPickerOpen(false)}
        />
      )}
      {soundPickerOpen && (
        <AssetPickerModal
          type="audio"
          currentIds={config.soundAssetId ? [config.soundAssetId] : []}
          onConfirm={(ids) => { update(nodeId, { soundAssetId: ids[0] }); setSoundPickerOpen(false); }}
          onClose={() => setSoundPickerOpen(false)}
        />
      )}

      <SectionLabel>Assets</SectionLabel>
      <div>
        <FieldLabel>Imagem / Vídeo / Partículas *</FieldLabel>
        <button
          onClick={() => setAssetPickerOpen(true)}
          className={cn(
            "flex h-8 w-full items-center justify-between rounded-lg border px-2.5 text-xs transition-colors",
            config.assetId
              ? "border-nyx-cyan-500/40 bg-nyx-void text-nyx-text-primary"
              : "border-nyx-border bg-nyx-void text-nyx-text-muted hover:border-nyx-hover",
          )}
        >
          <span className="truncate">
            {config.assetId ? config.assetId.slice(0, 18) + "…" : "Selecionar asset…"}
          </span>
          <Plus className="h-3 w-3 shrink-0" />
        </button>
      </div>
      <div>
        <FieldLabel>Blend mode</FieldLabel>
        <select
          value={config.blendMode ?? "normal"}
          onChange={(e) => update(nodeId, { blendMode: e.target.value as OverlayConfig["blendMode"] })}
          className={selectCls}
        >
          <option value="normal">Normal</option>
          <option value="screen">Screen (partículas / fundo preto)</option>
        </select>
      </div>
      <div>
        <FieldLabel>Efeito sonoro (opcional)</FieldLabel>
        <button
          onClick={() => setSoundPickerOpen(true)}
          className={cn(
            "flex h-8 w-full items-center justify-between rounded-lg border px-2.5 text-xs transition-colors",
            config.soundAssetId
              ? "border-nyx-cyan-500/40 bg-nyx-void text-nyx-text-primary"
              : "border-nyx-border bg-nyx-void text-nyx-text-muted hover:border-nyx-hover",
          )}
        >
          <span className="truncate">
            {config.soundAssetId ? config.soundAssetId.slice(0, 18) + "…" : "Sem som"}
          </span>
          <Plus className="h-3 w-3 shrink-0" />
        </button>
        {config.soundAssetId && (
          <button
            onClick={() => update(nodeId, { soundAssetId: undefined })}
            className="mt-1 text-[10px] text-nyx-text-muted hover:text-red-400"
          >
            Remover som
          </button>
        )}
      </div>

      <SectionLabel>Timing</SectionLabel>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <FieldLabel>Início (s)</FieldLabel>
          <input
            type="number"
            min={0}
            step={0.5}
            value={config.startSeconds ?? 0}
            onChange={(e) => update(nodeId, { startSeconds: parseFloat(e.target.value) })}
            className={inputCls}
          />
        </div>
        <div>
          <FieldLabel>Duração (s)</FieldLabel>
          <input
            type="number"
            min={0.5}
            step={0.5}
            value={config.durationSeconds ?? 5}
            onChange={(e) => update(nodeId, { durationSeconds: parseFloat(e.target.value) })}
            className={inputCls}
          />
        </div>
      </div>

      <SectionLabel>Posição (px)</SectionLabel>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <FieldLabel>X</FieldLabel>
          <input type="number" value={pos.x} onChange={(e) => updatePos({ x: parseInt(e.target.value) })} className={inputCls} />
        </div>
        <div>
          <FieldLabel>Y</FieldLabel>
          <input type="number" value={pos.y} onChange={(e) => updatePos({ y: parseInt(e.target.value) })} className={inputCls} />
        </div>
        <div>
          <FieldLabel>Largura</FieldLabel>
          <input type="number" min={1} value={pos.width} onChange={(e) => updatePos({ width: parseInt(e.target.value) })} className={inputCls} />
        </div>
        <div>
          <FieldLabel>Altura</FieldLabel>
          <input type="number" min={1} value={pos.height} onChange={(e) => updatePos({ height: parseInt(e.target.value) })} className={inputCls} />
        </div>
      </div>

      <SectionLabel>Opacidade</SectionLabel>
      <div>
        <FieldLabel>Opacidade: {Math.round((config.opacity ?? 1) * 100)}%</FieldLabel>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={config.opacity ?? 1}
          onChange={(e) => update(nodeId, { opacity: parseFloat(e.target.value) })}
          className="w-full accent-nyx-cyan-500"
        />
      </div>
    </div>
  );
}

// Transition properties
const ALL_TRANSITION_TYPES: { type: TransitionType; label: string }[] = [
  { type: "fade", label: "Fade" },
  { type: "fadewhite", label: "Fade White" },
  { type: "fadegrays", label: "Fade Gray" },
  { type: "dissolve", label: "Dissolve" },
  { type: "distance", label: "Distance" },
  { type: "pixelize", label: "Pixelize" },
  { type: "hblur", label: "H.Blur" },
  { type: "wipeleft", label: "Wipe ←" },
  { type: "wipeup", label: "Wipe ↑" },
  { type: "wipetr", label: "Wipe ↗" },
  { type: "wipebl", label: "Wipe ↙" },
  { type: "wipebr", label: "Wipe ↘" },
  { type: "slideright", label: "Slide →" },
  { type: "slideup", label: "Slide ↑" },
  { type: "slidedown", label: "Slide ↓" },
  { type: "circleopen", label: "Circle Open" },
  { type: "circleclose", label: "Circle Close" },
  { type: "circlecrop", label: "Circle Crop" },
  { type: "rectcrop", label: "Rect Crop" },
  { type: "radial", label: "Radial" },
  { type: "smoothleft", label: "Smooth ←" },
  { type: "smoothright", label: "Smooth →" },
  { type: "smoothup", label: "Smooth ↑" },
  { type: "smoothdown", label: "Smooth ↓" },
  { type: "coverleft", label: "Cover ←" },
  { type: "coverright", label: "Cover →" },
  { type: "coverup", label: "Cover ↑" },
  { type: "coverdown", label: "Cover ↓" },
  { type: "revealleft", label: "Reveal ←" },
  { type: "revealright", label: "Reveal →" },
  { type: "revealup", label: "Reveal ↑" },
  { type: "revealdown", label: "Reveal ↓" },
  { type: "horzopen", label: "Horiz Open" },
  { type: "horzclose", label: "Horiz Close" },
  { type: "vertopen", label: "Vert Open" },
  { type: "vertclose", label: "Vert Close" },
  { type: "hlslice", label: "HL Slice" },
  { type: "hrslice", label: "HR Slice" },
  { type: "vuslice", label: "VU Slice" },
  { type: "vdslice", label: "VD Slice" },
  { type: "hlwind", label: "HL Wind" },
  { type: "hrwind", label: "HR Wind" },
  { type: "vuwind", label: "VU Wind" },
  { type: "squeezeh", label: "Squeeze H" },
  { type: "squeezev", label: "Squeeze V" },
  { type: "diagtl", label: "Diag ↖" },
  { type: "diagtr", label: "Diag ↗" },
  { type: "diagbl", label: "Diag ↙" },
  { type: "diagbr", label: "Diag ↘" },
  { type: "zoomin", label: "Zoom In" },
];

function TransitionProps({ config, nodeId }: { config: TransitionConfig; nodeId: string }) {
  const update = useEditorStore((s) => s.updateNodeConfig);
  const selected = new Set(config.types ?? []);
  const [preview, setPreview] = useState<{ type: TransitionType; x: number; y: number } | null>(null);
  const [imgFailed, setImgFailed] = useState(false);

  const toggle = (type: TransitionType) => {
    const next = new Set(selected);
    if (next.has(type)) next.delete(type);
    else next.add(type);
    update(nodeId, { types: Array.from(next) });
  };

  return (
    <div className="space-y-3">
      {preview && !imgFailed && (
        <div
          style={{
            position: "fixed",
            left: preview.x - 110,
            top: preview.y - 130,
            zIndex: 9999,
            pointerEvents: "none",
          }}
          className="rounded-lg border border-nyx-border bg-nyx-surface p-1.5 shadow-xl"
        >
          <img
            src={`/xfade/${preview.type}.gif`}
            alt={preview.type}
            onError={() => setImgFailed(true)}
            className="h-24 w-auto rounded"
          />
          <p className="mt-1 text-center text-[9px] text-nyx-text-muted">{preview.type}</p>
        </div>
      )}
      <SectionLabel>Tipos de transição</SectionLabel>
      <div className="flex flex-wrap gap-1.5">
        {ALL_TRANSITION_TYPES.map(({ type, label }) => {
          const active = selected.has(type);
          return (
            <button
              key={type}
              onClick={() => toggle(type)}
              onMouseEnter={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                setImgFailed(false);
                setPreview({ type, x: rect.left + rect.width / 2, y: rect.top });
              }}
              onMouseLeave={() => setPreview(null)}
              className={cn(
                "rounded-md border px-2 py-1 text-[10px] transition-colors",
                active
                  ? "border-nyx-orange-500 bg-nyx-orange-500/15 text-nyx-orange-400"
                  : "border-nyx-border bg-nyx-void text-nyx-text-muted hover:border-nyx-hover",
              )}
            >
              {label}
            </button>
          );
        })}
      </div>
      {selected.size === 0 && (
        <p className="text-[10px] text-red-400">Selecione ao menos uma transição.</p>
      )}

      <SectionLabel>Comportamento</SectionLabel>
      <div>
        <FieldLabel>Modo de seleção</FieldLabel>
        <select
          value={config.mode ?? "random"}
          onChange={(e) => update(nodeId, { mode: e.target.value as TransitionConfig["mode"] })}
          className={selectCls}
        >
          <option value="random">Aleatório (sorteia da lista)</option>
          <option value="sequential">Sequencial (cicla pela lista)</option>
        </select>
      </div>
      <div>
        <FieldLabel>Duração: {config.duration ?? 0.5}s</FieldLabel>
        <input
          type="range"
          min={0.1}
          max={2}
          step={0.1}
          value={config.duration ?? 0.5}
          onChange={(e) => update(nodeId, { duration: parseFloat(e.target.value) })}
          className="w-full accent-nyx-orange-500"
        />
      </div>
    </div>
  );
}

// Zoom properties
function ZoomProps({ config, nodeId }: { config: ZoomConfig; nodeId: string }) {
  const update = useEditorStore((s) => s.updateNodeConfig);
  const factor = config.factor ?? 1.05;
  const pct = Math.round((factor - 1) * 100);

  return (
    <div className="space-y-3">
      <SectionLabel>Zoom</SectionLabel>
      <div>
        <FieldLabel>Intensidade: +{pct}%</FieldLabel>
        <input
          type="range"
          min={1.0}
          max={1.3}
          step={0.01}
          value={factor}
          onChange={(e) => update(nodeId, { factor: parseFloat(e.target.value) })}
          className="w-full accent-nyx-orange-500"
        />
        <div className="mt-1 flex justify-between text-[9px] text-nyx-text-muted">
          <span>0%</span><span>15%</span><span>30%</span>
        </div>
      </div>
      <div>
        <FieldLabel>Direção</FieldLabel>
        <select
          value={config.direction ?? "in"}
          onChange={(e) => update(nodeId, { direction: e.target.value as ZoomConfig["direction"] })}
          className={selectCls}
        >
          <option value="in">Zoom In (aproxima)</option>
          <option value="out">Zoom Out (afasta)</option>
          <option value="random">Aleatório por clip</option>
        </select>
      </div>
      <div className="rounded-lg border border-nyx-border bg-nyx-void/50 p-2.5">
        <p className="text-[10px] text-nyx-text-muted leading-relaxed">
          Zoom uniforme aplicado a todos os clipes do VideoFit conectado. Requer re-encoding.
        </p>
      </div>
    </div>
  );
}

// Shake properties
function ShakeProps({ config, nodeId }: { config: ShakeConfig; nodeId: string }) {
  const update = useEditorStore((s) => s.updateNodeConfig);
  const intensity = config.intensity ?? 3;

  return (
    <div className="space-y-3">
      <SectionLabel>Camera Shake</SectionLabel>
      <div>
        <FieldLabel>Intensidade: {intensity}/10</FieldLabel>
        <input
          type="range"
          min={0}
          max={10}
          step={1}
          value={intensity}
          onChange={(e) => update(nodeId, { intensity: parseInt(e.target.value) })}
          className="w-full accent-nyx-orange-500"
        />
        <div className="mt-1 flex justify-between text-[9px] text-nyx-text-muted">
          <span>Suave</span><span>Médio</span><span>Intenso</span>
        </div>
      </div>
      <div className="rounded-lg border border-nyx-border bg-nyx-void/50 p-2.5">
        <p className="text-[10px] text-nyx-text-muted leading-relaxed">
          Simula tremido de câmera via deslocamento senoidal. Aplica zoom mínimo de 5% para ocultar bordas. Requer re-encoding.
        </p>
      </div>
    </div>
  );
}

// Render properties
function RenderProps({ config, nodeId }: { config: RenderConfig; nodeId: string }) {
  const update = useEditorStore((s) => s.updateNodeConfig);

  return (
    <div className="space-y-3">
      <SectionLabel>Resolução</SectionLabel>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <FieldLabel>Largura</FieldLabel>
          <input
            type="number"
            value={config.width ?? 1080}
            onChange={(e) => update(nodeId, { width: parseInt(e.target.value) })}
            className={inputCls}
          />
        </div>
        <div>
          <FieldLabel>Altura</FieldLabel>
          <input
            type="number"
            value={config.height ?? 1920}
            onChange={(e) => update(nodeId, { height: parseInt(e.target.value) })}
            className={inputCls}
          />
        </div>
      </div>

      <SectionLabel>Configuração</SectionLabel>
      <div>
        <FieldLabel>FPS</FieldLabel>
        <select
          value={config.fps ?? 30}
          onChange={(e) => update(nodeId, { fps: parseInt(e.target.value) })}
          className={selectCls}
        >
          <option value={24}>24 fps</option>
          <option value={30}>30 fps</option>
          <option value={60}>60 fps</option>
        </select>
      </div>
      <div>
        <FieldLabel>Formato</FieldLabel>
        <select
          value={config.format ?? "mp4"}
          onChange={(e) => update(nodeId, { format: e.target.value })}
          className={selectCls}
        >
          <option value="mp4">MP4</option>
          <option value="webm">WebM</option>
        </select>
      </div>
      <div>
        <FieldLabel>
          Volume da música: {Math.round((config.musicVolume ?? 0.15) * 100)}%
        </FieldLabel>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={config.musicVolume ?? 0.15}
          onChange={(e) => update(nodeId, { musicVolume: parseFloat(e.target.value) })}
          className="w-full accent-nyx-cyan-500"
        />
      </div>
    </div>
  );
}

// Graph summary — shown when no node is selected
function GraphSummary() {
  const nodes = useEditorStore((s) => s.nodes);
  const rawNodes = nodes.map((n) => ({ type: n.data?.type as string, config: n.data?.config as Record<string, unknown> }));

  const mediaPoolVideo = rawNodes.filter((n) => n.type === "MediaPool" && n.config?.assetType === "video");
  const mediaPoolAudio = rawNodes.filter((n) => n.type === "MediaPool" && n.config?.assetType === "audio");
  const sceneSlots    = rawNodes.filter((n) => n.type === "SceneSlot");
  const ttsNode       = rawNodes.find((n) => n.type === "TTS");
  const videoFitNode  = rawNodes.find((n) => n.type === "VideoFit");
  const subtitleNode  = rawNodes.find((n) => n.type === "Subtitle");
  const zoomNode      = rawNodes.find((n) => n.type === "Zoom");
  const shakeNode     = rawNodes.find((n) => n.type === "Shake");
  const transitionNode = rawNodes.find((n) => n.type === "Transition");
  const renderNode    = rawNodes.find((n) => n.type === "Render");

  if (rawNodes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 p-6 text-center h-full">
        <MousePointer2 className="h-10 w-10 text-nyx-text-muted opacity-30" />
        <div>
          <p className="text-sm font-medium text-nyx-text-secondary">Canvas vazio</p>
          <p className="mt-1 text-xs text-nyx-text-muted">Arraste nodes do painel esquerdo para começar</p>
        </div>
      </div>
    );
  }

  const videoClipCount = mediaPoolVideo.reduce((acc, n) => acc + ((n.config?.assetIds as string[])?.length ?? 0), 0);
  const musicCount     = mediaPoolAudio.reduce((acc, n) => acc + ((n.config?.assetIds as string[])?.length ?? 0), 0);
  const fitMode        = (videoFitNode?.config?.mode as string) ?? "random-loop";
  const fitModeLabel   = fitMode === "sequential" ? "sequencial" : fitMode === "once" ? "uma vez" : "aleatório";

  const ttsProvider = (ttsNode?.config?.provider as string) ?? "talkify";
  const ttsVoice    = (ttsNode?.config?.voice as string) || "padrão";
  const ttsSpeed    = (ttsNode?.config?.speed as number) ?? 1.0;

  const zoomFactor   = zoomNode ? Math.round(((zoomNode.config?.factor as number ?? 1.05) - 1) * 100) : null;
  const shakeInt     = shakeNode ? (shakeNode.config?.intensity as number ?? 3) : null;
  const tranTypes    = transitionNode ? (transitionNode.config?.types as string[]) ?? [] : null;

  const subWords     = subtitleNode ? (subtitleNode.config?.wordsPerGroup as number ?? 3) : null;
  const subPos       = (subtitleNode?.config?.style as Record<string,unknown>)?.position as string ?? "bottom";
  const subPosLabel  = subPos === "top" ? "topo" : subPos === "center" ? "centro" : "rodapé";

  const renderCfg    = renderNode?.config as Record<string,unknown> | undefined;
  const musicVolume  = renderCfg?.musicVolume != null ? Math.round((renderCfg.musicVolume as number) * 100) : 15;

  const SummaryRow = ({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) => (
    <div className="flex gap-3">
      <div className="mt-0.5 shrink-0 text-nyx-text-muted">{icon}</div>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-nyx-text-muted mb-0.5">{label}</p>
        <div className="text-xs text-nyx-text-secondary leading-relaxed">{children}</div>
      </div>
    </div>
  );

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-nyx-border px-4 py-3">
        <p className="text-sm font-semibold text-nyx-text-primary">Resumo do Template</p>
        <p className="text-[10px] text-nyx-text-muted mt-0.5">O que este template vai produzir</p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Vídeo */}
        {(mediaPoolVideo.length > 0 || sceneSlots.length > 0) && (
          <SummaryRow icon={<Video className="h-3.5 w-3.5" />} label="Vídeo">
            {sceneSlots.length > 0 && (
              <p>{sceneSlots.map((s) => (s.config?.label as string) || "Slot").join(", ")} como intro (escolhido por render)</p>
            )}
            {videoClipCount > 0
              ? <p>{videoClipCount} clip{videoClipCount !== 1 ? "s" : ""} no pool · {fitModeLabel}</p>
              : mediaPoolVideo.length > 0
              ? <p className="text-yellow-500">Pool vazio — adicione vídeos ao MediaPool</p>
              : null}
          </SummaryRow>
        )}

        {/* Narração */}
        {ttsNode && (
          <SummaryRow icon={<Mic className="h-3.5 w-3.5" />} label="Narração">
            {ttsProvider === "custom"
              ? <p>Áudio custom · usuário faz upload por render</p>
              : <p>TTS · {ttsProvider} · voz {ttsVoice} · {ttsSpeed.toFixed(1)}×</p>}
          </SummaryRow>
        )}

        {/* Efeitos */}
        {(zoomNode || shakeNode || transitionNode) && (
          <SummaryRow icon={<Sparkles className="h-3.5 w-3.5" />} label="Efeitos">
            {zoomFactor !== null && <p>Zoom +{zoomFactor}%{(zoomNode?.config?.direction as string) === "random" ? " (aleatório por clip)" : (zoomNode?.config?.direction as string) === "out" ? " (zoom out)" : " (zoom in)"}</p>}
            {shakeInt !== null && <p>Camera shake · intensidade {shakeInt}/10</p>}
            {tranTypes !== null && tranTypes.length > 0 && (
              <p>Transições: {tranTypes.slice(0, 3).join(", ")}{tranTypes.length > 3 ? ` +${tranTypes.length - 3}` : ""} · {(transitionNode?.config?.mode as string) === "sequential" ? "sequencial" : "aleatório"}</p>
            )}
          </SummaryRow>
        )}

        {/* Legenda */}
        {subtitleNode && (
          <SummaryRow icon={<Captions className="h-3.5 w-3.5" />} label="Legenda">
            <p>Karaokê · {subWords} palavras por grupo · {subPosLabel}</p>
          </SummaryRow>
        )}

        {/* Música */}
        {mediaPoolAudio.length > 0 && (
          <SummaryRow icon={<Music className="h-3.5 w-3.5" />} label="Música de fundo">
            {musicCount > 0
              ? <p>{musicCount} faixa{musicCount !== 1 ? "s" : ""} no pool · volume {musicVolume}%</p>
              : <p className="text-yellow-500">Pool vazio — adicione músicas ao MediaPool</p>}
          </SummaryRow>
        )}

        {/* SceneSlot extra info */}
        {sceneSlots.length > 0 && mediaPoolVideo.length === 0 && (
          <SummaryRow icon={<Film className="h-3.5 w-3.5" />} label="Cenas únicas">
            <p>{sceneSlots.length} slot{sceneSlots.length !== 1 ? "s" : ""} · asset definido por render</p>
          </SummaryRow>
        )}

        {/* Saída */}
        {renderNode && (
          <SummaryRow icon={<Clapperboard className="h-3.5 w-3.5" />} label="Saída">
            <p>{renderCfg?.width ?? 1080}×{renderCfg?.height ?? 1920} · {renderCfg?.fps ?? 30}fps · {(renderCfg?.format as string) ?? "mp4"}</p>
          </SummaryRow>
        )}

        {!renderNode && (
          <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3">
            <p className="text-[10px] text-red-400">Nenhum node Render encontrado — o template não pode ser usado para render.</p>
          </div>
        )}
      </div>

      <div className="border-t border-nyx-border px-4 py-3">
        <p className="text-[10px] text-nyx-text-muted text-center">Clique em um node para editar suas propriedades</p>
      </div>
    </div>
  );
}

export function PropertiesPanel() {
  const selectedNodeId = useEditorStore((s) => s.selectedNodeId);
  const nodes = useEditorStore((s) => s.nodes);
  const removeNode = useEditorStore((s) => s.removeNode);

  const selectedNode = nodes.find((n) => n.id === selectedNodeId);
  const nodeType = selectedNode?.data?.type as string | undefined;
  const nodeConfig = selectedNode?.data?.config;

  return (
    <div className="flex h-full w-full flex-col border-l border-nyx-border bg-nyx-deep">
      <AnimatePresence mode="wait">
        {!selectedNode ? (
          <motion.div
            key="empty"
            className="h-full"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <GraphSummary />
          </motion.div>
        ) : (
          <motion.div
            key={selectedNodeId}
            className="flex h-full flex-col"
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 8 }}
            transition={{ duration: 0.15 }}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-nyx-border px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-nyx-text-primary">
                  {nodeType}
                </p>
                <p className="text-xs text-nyx-text-muted">Configuração</p>
              </div>
              <button
                onClick={() => removeNode(selectedNodeId!)}
                className="rounded p-1 text-nyx-text-muted hover:bg-red-500/10 hover:text-red-400"
                title="Deletar node"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Config */}
            <div className="flex-1 overflow-y-auto p-4">
              {nodeType === "MediaPool" && (
                <MediaPoolProps
                  config={nodeConfig as unknown as MediaPoolConfig}
                  nodeId={selectedNodeId!}
                />
              )}
              {nodeType === "SceneSlot" && (
                <SceneSlotProps
                  config={nodeConfig as unknown as SceneSlotConfig}
                  nodeId={selectedNodeId!}
                />
              )}
              {nodeType === "VideoFit" && (
                <VideoFitProps
                  config={nodeConfig as unknown as VideoFitConfig}
                  nodeId={selectedNodeId!}
                />
              )}
              {nodeType === "TTS" && (
                <TTSProps
                  config={nodeConfig as unknown as TTSConfig}
                  nodeId={selectedNodeId!}
                />
              )}
              {nodeType === "Subtitle" && (
                <SubtitleProps
                  config={nodeConfig as unknown as SubtitleConfig}
                  nodeId={selectedNodeId!}
                />
              )}
              {nodeType === "Layer" && (
                <div className="text-xs text-nyx-text-muted">
                  Composição definida pelas edges de entrada (base + overlays).
                </div>
              )}
              {nodeType === "Overlay" && (
                <OverlayProps
                  config={nodeConfig as unknown as OverlayConfig}
                  nodeId={selectedNodeId!}
                />
              )}
              {nodeType === "Transition" && (
                <TransitionProps
                  config={nodeConfig as unknown as TransitionConfig}
                  nodeId={selectedNodeId!}
                />
              )}
              {nodeType === "Zoom" && (
                <ZoomProps
                  config={nodeConfig as unknown as ZoomConfig}
                  nodeId={selectedNodeId!}
                />
              )}
              {nodeType === "Shake" && (
                <ShakeProps
                  config={nodeConfig as unknown as ShakeConfig}
                  nodeId={selectedNodeId!}
                />
              )}
              {nodeType === "Render" && (
                <RenderProps
                  config={nodeConfig as unknown as RenderConfig}
                  nodeId={selectedNodeId!}
                />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
