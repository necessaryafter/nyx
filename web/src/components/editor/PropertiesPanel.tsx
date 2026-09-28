import { AnimatePresence, motion } from "motion/react";
import { Check, ChevronDown, MousePointer2, Play, Search, Square, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useEditorStore } from "../../stores/editorStore";
import { useAssets } from "../../hooks/useAssets";
import { NODE_DEFINITIONS } from "../../lib/nodeDefaults";
import { cn } from "../../lib/cn";
import type {
  Asset,
  AssetSourceConfig,
  CameraEffectConfig,
  MusicSourceConfig,
  NarrationSourceConfig,
  NodeType,
  OnSilenceConfig,
  OnTimeConfig,
  OnWordConfig,
  PlaySfxConfig,
  SceneSourceConfig,
  SetMediaConfig,
  SetMusicConfig,
  SetSubtitleStyleConfig,
  ShowOverlayConfig,
  ShowTitleCardConfig,
  SubtitleStyle,
} from "../../lib/types";

// speed é um multiplicador (1 = normal); na tela aparece como % em relação ao normal (1.02 -> +2%).
function formatSpeedPct(speed = 1): string {
  const pct = Math.round((speed - 1) * 100);
  return pct === 0 ? "normal (0%)" : `${pct > 0 ? "+" : ""}${pct}%`;
}

const inputCls = "h-8 w-full rounded-lg border border-nyx-border bg-nyx-void px-2.5 text-xs text-nyx-text-primary focus:border-nyx-cyan-500 focus:outline-none";

// ---------------------------------------------------------------------------
// Custom Select
// ---------------------------------------------------------------------------

interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  className?: string;
}

function Select({ value, onChange, options, className }: SelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = options.find((o) => o.value === value) ?? options[0];

  useEffect(() => {
    if (!open) return;
    function handleDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleDown);
    return () => document.removeEventListener("mousedown", handleDown);
  }, [open]);

  return (
    <div ref={ref} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex h-8 w-full items-center justify-between rounded-lg border px-2.5 text-xs transition-colors",
          open
            ? "border-nyx-cyan-500 bg-nyx-void text-nyx-text-primary"
            : "border-nyx-border bg-nyx-void text-nyx-text-primary hover:border-nyx-border/80 hover:bg-nyx-elevated",
        )}
      >
        <span className="truncate">{selected?.label ?? value}</span>
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.15, ease: "easeOut" }}
          className="ml-1.5 shrink-0 text-nyx-text-muted"
        >
          <ChevronDown className="h-3.5 w-3.5" />
        </motion.span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scaleY: 0.92, y: -4 }}
            animate={{ opacity: 1, scaleY: 1, y: 0 }}
            exit={{ opacity: 0, scaleY: 0.92, y: -4 }}
            transition={{ duration: 0.12, ease: "easeOut" }}
            style={{ transformOrigin: "top" }}
            className="absolute left-0 right-0 top-[calc(100%+4px)] z-50 overflow-hidden rounded-lg border border-nyx-border bg-nyx-deep shadow-xl"
          >
            {options.map((opt) => {
              const active = opt.value === value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => { onChange(opt.value); setOpen(false); }}
                  className={cn(
                    "flex w-full items-center gap-2 border-b border-nyx-border/40 px-2.5 py-1.5 text-left text-xs last:border-b-0",
                    active
                      ? "bg-nyx-cyan-500/10 text-nyx-cyan-500"
                      : "text-nyx-text-secondary hover:bg-nyx-elevated hover:text-nyx-text-primary",
                  )}
                >
                  <span
                    className={cn(
                      "h-1.5 w-1.5 shrink-0 rounded-full",
                      active ? "bg-nyx-cyan-500" : "bg-transparent",
                    )}
                  />
                  {opt.label}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Panel primitives
// ---------------------------------------------------------------------------

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 py-2">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-nyx-text-muted">{children}</span>
      <div className="flex-1 border-t border-nyx-border" />
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="mb-1 block text-xs font-medium text-nyx-text-secondary">{children}</label>;
}

// ---------------------------------------------------------------------------
// Empty panel
// ---------------------------------------------------------------------------

function EmptyPanel() {
  const nodes = useEditorStore((s) => s.nodes);
  const edges = useEditorStore((s) => s.edges);

  if (nodes.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
        <MousePointer2 className="h-10 w-10 text-nyx-text-muted opacity-30" />
        <div>
          <p className="text-sm font-medium text-nyx-text-secondary">Canvas vazio</p>
          <p className="mt-1 text-xs text-nyx-text-muted">Arraste etapas da paleta para começar</p>
        </div>
      </div>
    );
  }

  const count = (kind: string) => nodes.filter((n) => n.data?.kind === kind).length;
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-nyx-border px-4 py-3">
        <p className="text-sm font-semibold text-nyx-text-primary">Resumo do pipeline</p>
        <p className="text-[10px] text-nyx-text-muted mt-0.5">Selecione uma etapa para editar</p>
      </div>
      <div className="grid grid-cols-2 gap-2 p-4">
        {[
          { key: "source", label: "entradas" },
          { key: "event", label: "gatilhos" },
          { key: "action", label: "ações" },
          { key: "output", label: "saída" },
        ].map((kind) => (
          <div key={kind.key} className="rounded-lg border border-nyx-border bg-nyx-void px-3 py-2">
            <p className="text-[10px] uppercase tracking-wider text-nyx-text-muted">{kind.label}</p>
            <p className="text-sm text-nyx-text-primary">{count(kind.key)}</p>
          </div>
        ))}
        <div className="col-span-2 rounded-lg border border-nyx-border bg-nyx-void px-3 py-2">
          <p className="text-[10px] uppercase tracking-wider text-nyx-text-muted">conexões</p>
          <p className="text-sm text-nyx-text-primary">{edges.length}</p>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Asset picker
// ---------------------------------------------------------------------------

function AssetPicker({
  type,
  selectedIds,
  onChange,
  multiple = true,
}: {
  type: "video" | "audio" | "text";
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  multiple?: boolean;
}) {
  const [search, setSearch] = useState("");
  const assets = useAssets(0, type, search || undefined);

  function toggle(asset: Asset) {
    if (multiple) {
      onChange(selectedIds.includes(asset.id) ? selectedIds.filter((id) => id !== asset.id) : [...selectedIds, asset.id]);
    } else {
      onChange(selectedIds.includes(asset.id) ? [] : [asset.id]);
    }
  }

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-nyx-text-muted" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar asset..."
          className="h-8 w-full rounded-lg border border-nyx-border bg-nyx-void pl-8 pr-2 text-xs text-nyx-text-primary focus:border-nyx-cyan-500 focus:outline-none"
        />
      </div>
      <div className="max-h-44 overflow-y-auto rounded-lg border border-nyx-border bg-nyx-void">
        {assets.isPending && <p className="p-3 text-center text-xs text-nyx-text-muted">Carregando...</p>}
        {!assets.isPending && (assets.data?.data.length ?? 0) === 0 && (
          <p className="p-3 text-center text-xs text-nyx-text-muted">Nenhum asset encontrado</p>
        )}
        {assets.data?.data.map((asset) => {
          const active = selectedIds.includes(asset.id);
          return (
            <button
              key={asset.id}
              onClick={() => toggle(asset)}
              className={cn(
                "flex w-full items-center gap-2 border-b border-nyx-border/60 px-2.5 py-2 text-left last:border-b-0 hover:bg-nyx-hover",
                active && "bg-nyx-cyan-500/10",
              )}
            >
              <span className={cn("flex h-4 w-4 shrink-0 items-center justify-center rounded border", active ? "border-nyx-cyan-500 bg-nyx-cyan-500" : "border-nyx-border")}>
                {active && <Check className="h-2.5 w-2.5 text-white" />}
              </span>
              <span className="min-w-0 flex-1 truncate text-xs text-nyx-text-secondary">{asset.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Node config panels
// ---------------------------------------------------------------------------

function NarrationProps({ nodeId, config }: { nodeId: string; config: NarrationSourceConfig }) {
  const update = useEditorStore((s) => s.updateNodeConfig);
  return (
    <div className="space-y-3">
      <SectionLabel>Narracao</SectionLabel>
      <div>
        <FieldLabel>Entrada</FieldLabel>
        <Select
          value={config.mode ?? "job-input"}
          onChange={(v) => update(nodeId, { mode: v })}
          options={[
            { value: "job-input", label: "Texto definido no job" },
            { value: "tts", label: "Texto fixo no template" },
            { value: "audio", label: "Audio enviado no job" },
          ]}
        />
      </div>
      <div>
        <FieldLabel>Provider</FieldLabel>
        <Select
          value={config.provider ?? "talkify"}
          onChange={(v) => update(nodeId, { provider: v })}
          options={[
            { value: "talkify", label: "Talkify" },
            { value: "edge", label: "Edge TTS (gratuito)" },
            { value: "custom", label: "Audio custom" },
          ]}
        />
      </div>
      {config.mode === "tts" && (
        <div>
          <FieldLabel>Texto fixo</FieldLabel>
          <textarea value={config.text ?? ""} onChange={(e) => update(nodeId, { text: e.target.value })} className="h-28 w-full resize-none rounded-lg border border-nyx-border bg-nyx-void p-2.5 text-xs text-nyx-text-primary focus:border-nyx-cyan-500 focus:outline-none" />
        </div>
      )}
      <div>
        <FieldLabel>Voz</FieldLabel>
        <input value={config.voice ?? ""} onChange={(e) => update(nodeId, { voice: e.target.value || undefined })} placeholder="Padrao do provider" className={inputCls} />
      </div>
      <div>
        <FieldLabel>Velocidade: {formatSpeedPct(config.speed)}</FieldLabel>
        <input type="range" min={0.5} max={2} step={0.01} value={config.speed ?? 1} onChange={(e) => update(nodeId, { speed: Number(e.target.value) })} className="w-full accent-nyx-cyan-500" />
      </div>
    </div>
  );
}

function AssetSourceProps({ nodeId, config }: { nodeId: string; config: AssetSourceConfig }) {
  const update = useEditorStore((s) => s.updateNodeConfig);
  const pickerType = config.assetType === "audio" ? "audio" : "video";
  return (
    <div className="space-y-3">
      <SectionLabel>Assets</SectionLabel>
      <div>
        <FieldLabel>Tipo</FieldLabel>
        <Select
          value={config.assetType ?? "video"}
          onChange={(v) => update(nodeId, { assetType: v, assetIds: [] })}
          options={[
            { value: "video", label: "Videos" },
            { value: "image", label: "Imagens" },
            { value: "audio", label: "Audios" },
          ]}
        />
      </div>
      <AssetPicker type={pickerType} selectedIds={config.assetIds ?? []} onChange={(ids) => update(nodeId, { assetIds: ids })} />
    </div>
  );
}

function SceneSourceProps({ nodeId, config }: { nodeId: string; config: SceneSourceConfig }) {
  const update = useEditorStore((s) => s.updateNodeConfig);
  return (
    <div className="space-y-3">
      <SectionLabel>Cenas</SectionLabel>
      <div>
        <FieldLabel>Segmentacao</FieldLabel>
        <Select
          value={config.strategy ?? "job-slots"}
          onChange={(v) => update(nodeId, { strategy: v })}
          options={[
            { value: "job-slots", label: "Slots do job" },
            { value: "paragraphs", label: "Paragrafos" },
            { value: "silence", label: "Pausas" },
            { value: "even", label: "Divisao igual" },
          ]}
        />
      </div>
      <div>
        <FieldLabel>Encaixe da midia</FieldLabel>
        <Select
          value={config.fit ?? "cover"}
          onChange={(v) => update(nodeId, { fit: v })}
          options={[
            { value: "cover", label: "Preencher tela" },
            { value: "contain", label: "Mostrar inteiro" },
          ]}
        />
      </div>
      <div>
        <FieldLabel>Transicao: {config.transitionMs ?? 0}ms</FieldLabel>
        <input type="range" min={0} max={1500} step={50} value={config.transitionMs ?? 0} onChange={(e) => update(nodeId, { transitionMs: Number(e.target.value) })} className="w-full accent-nyx-cyan-500" />
      </div>
    </div>
  );
}

function MusicSourceProps({ nodeId, config }: { nodeId: string; config: MusicSourceConfig }) {
  const update = useEditorStore((s) => s.updateNodeConfig);
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const volume = config.volume ?? 0.15;

  const stopAudio = () => {
    audioRef.current?.pause();
    audioRef.current = null;
    setPlaying(false);
  };

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  useEffect(() => stopAudio, []);

  const togglePreview = async () => {
    if (playing) { stopAudio(); return; }
    const ids = config.assetIds ?? [];
    if (ids.length === 0) return;
    const id = ids[Math.floor(Math.random() * ids.length)];
    const res = await fetch(`/api/assets/${id}/url`, { credentials: "include" });
    if (!res.ok) return;
    const { url } = await res.json() as { url: string };
    const audio = new Audio(url);
    audio.volume = volume;
    audio.onended = () => setPlaying(false);
    audioRef.current = audio;
    audio.play();
    setPlaying(true);
  };

  const hasAssets = (config.assetIds ?? []).length > 0;

  return (
    <div className="space-y-3">
      <SectionLabel>Musica</SectionLabel>
      <AssetPicker type="audio" selectedIds={config.assetIds ?? []} onChange={(ids) => update(nodeId, { assetIds: ids })} />
      <div>
        <FieldLabel>Modo</FieldLabel>
        <Select
          value={config.mode ?? "random-loop"}
          onChange={(v) => update(nodeId, { mode: v })}
          options={[
            { value: "random-loop", label: "Aleatorio em loop" },
            { value: "sequential", label: "Sequencial" },
          ]}
        />
      </div>
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <FieldLabel>Volume: {Math.round(volume * 100)}%</FieldLabel>
          <button
            onClick={togglePreview}
            disabled={!hasAssets}
            title={hasAssets ? (playing ? "Parar prévia" : "Ouvir prévia no volume atual") : "Adicione uma trilha para pré-visualizar"}
            className={cn(
              "flex items-center gap-1 text-xs px-2 py-0.5 rounded transition-colors",
              playing
                ? "bg-nyx-cyan-500/20 text-nyx-cyan-400 hover:bg-nyx-cyan-500/30"
                : "text-nyx-text-secondary hover:text-nyx-text-primary",
              "disabled:opacity-40 disabled:cursor-not-allowed",
            )}
          >
            {playing ? <Square className="h-3 w-3 fill-current" /> : <Play className="h-3 w-3 fill-current" />}
            {playing ? "Parar" : "Prévia"}
          </button>
        </div>
        <input type="range" min={0} max={1} step={0.01} value={volume} onChange={(e) => update(nodeId, { volume: Number(e.target.value) })} className="w-full accent-nyx-cyan-500" />
      </div>
      <div>
        <FieldLabel>Fade-in: {(config.fadeInMs ?? 0) / 1000}s</FieldLabel>
        <input type="range" min={0} max={5000} step={100} value={config.fadeInMs ?? 0} onChange={(e) => update(nodeId, { fadeInMs: Number(e.target.value) })} className="w-full accent-nyx-cyan-500" />
      </div>
      <div>
        <FieldLabel>Fade-out: {(config.fadeOutMs ?? 0) / 1000}s</FieldLabel>
        <input type="range" min={0} max={5000} step={100} value={config.fadeOutMs ?? 0} onChange={(e) => update(nodeId, { fadeOutMs: Number(e.target.value) })} className="w-full accent-nyx-cyan-500" />
      </div>
    </div>
  );
}

function EventProps({ nodeId, type, config }: { nodeId: string; type: NodeType; config: Record<string, unknown> }) {
  const update = useEditorStore((s) => s.updateNodeConfig);
  if (type === "OnTime") {
    const cfg = config as unknown as OnTimeConfig;
    return (
      <div className="space-y-3">
        <SectionLabel>Tempo</SectionLabel>
        <div><FieldLabel>Disparar em ms</FieldLabel><input type="number" value={cfg.atMs ?? 0} onChange={(e) => update(nodeId, { atMs: Number(e.target.value) })} className={inputCls} /></div>
        <div><FieldLabel>Duracao ms</FieldLabel><input type="number" value={cfg.durationMs ?? 1000} onChange={(e) => update(nodeId, { durationMs: Number(e.target.value) })} className={inputCls} /></div>
      </div>
    );
  }
  if (type === "OnWord") {
    const cfg = config as OnWordConfig;
    return (
      <div className="space-y-3">
        <SectionLabel>Palavra</SectionLabel>
        <div><FieldLabel>Palavra alvo</FieldLabel><input value={cfg.word ?? ""} onChange={(e) => update(nodeId, { word: e.target.value || undefined })} placeholder="Vazio = qualquer palavra" className={inputCls} /></div>
        <div>
          <FieldLabel>Comparacao</FieldLabel>
          <Select
            value={cfg.match ?? "contains"}
            onChange={(v) => update(nodeId, { match: v })}
            options={[
              { value: "contains", label: "Contem" },
              { value: "exact", label: "Exata" },
            ]}
          />
        </div>
        <label className="flex items-center gap-2 text-xs text-nyx-text-secondary">
          <input type="checkbox" checked={cfg.caseSensitive ?? false} onChange={(e) => update(nodeId, { caseSensitive: e.target.checked })} />
          Diferenciar maiusculas
        </label>
      </div>
    );
  }
  if (type === "OnSilence") {
    const cfg = config as OnSilenceConfig;
    return (
      <div className="space-y-3">
        <SectionLabel>Pausa</SectionLabel>
        <div><FieldLabel>Pausa minima: {cfg.minDurationMs ?? 500}ms</FieldLabel><input type="range" min={100} max={3000} step={100} value={cfg.minDurationMs ?? 500} onChange={(e) => update(nodeId, { minDurationMs: Number(e.target.value) })} className="w-full accent-nyx-orange-500" /></div>
      </div>
    );
  }
  return (
    <div className="rounded-lg border border-nyx-border bg-nyx-void p-3 text-xs text-nyx-text-muted">
      Este gatilho não precisa de configuração.
    </div>
  );
}

function SubtitleStyleFields({ value, onChange }: { value?: SubtitleStyle; onChange: (style: SubtitleStyle) => void }) {
  const style = value ?? {};
  const set = (patch: SubtitleStyle) => onChange({ ...style, ...patch });
  return (
    <div className="grid grid-cols-2 gap-2">
      <div><FieldLabel>Tamanho</FieldLabel><input type="number" value={style.fontSize ?? 72} onChange={(e) => set({ fontSize: Number(e.target.value) })} className={inputCls} /></div>
      <div>
        <FieldLabel>Posicao</FieldLabel>
        <Select
          value={style.position ?? "bottom"}
          onChange={(v) => set({ position: v as SubtitleStyle["position"] })}
          options={[
            { value: "top", label: "Topo" },
            { value: "center", label: "Centro" },
            { value: "bottom", label: "Rodape" },
          ]}
        />
      </div>
      <div><FieldLabel>Cor</FieldLabel><input type="color" value={style.color ?? "#ffffff"} onChange={(e) => set({ color: e.target.value })} className="h-8 w-full rounded border border-nyx-border bg-nyx-void" /></div>
      <div><FieldLabel>Destaque</FieldLabel><input type="color" value={style.highlightColor ?? "#ffdd00"} onChange={(e) => set({ highlightColor: e.target.value })} className="h-8 w-full rounded border border-nyx-border bg-nyx-void" /></div>
      <div><FieldLabel>Borda</FieldLabel><input type="color" value={style.strokeColor ?? "#000000"} onChange={(e) => set({ strokeColor: e.target.value })} className="h-8 w-full rounded border border-nyx-border bg-nyx-void" /></div>
      <div><FieldLabel>Espessura</FieldLabel><input type="number" value={style.strokeWidth ?? 4} onChange={(e) => set({ strokeWidth: Number(e.target.value) })} className={inputCls} /></div>
    </div>
  );
}

function ActionProps({ nodeId, type, config }: { nodeId: string; type: NodeType; config: Record<string, unknown> }) {
  const update = useEditorStore((s) => s.updateNodeConfig);
  if (type === "SetMedia") {
    const cfg = config as SetMediaConfig;
    return (
      <div className="space-y-3">
        <SectionLabel>Midia</SectionLabel>
        <div><FieldLabel>Alvo</FieldLabel><input value={cfg.target ?? "main"} onChange={(e) => update(nodeId, { target: e.target.value })} className={inputCls} /></div>
        <div>
          <FieldLabel>Encaixe</FieldLabel>
          <Select
            value={cfg.fit ?? "cover"}
            onChange={(v) => update(nodeId, { fit: v })}
            options={[
              { value: "cover", label: "Preencher tela" },
              { value: "contain", label: "Mostrar inteiro" },
            ]}
          />
        </div>
      </div>
    );
  }
  if (type === "ShowOverlay") {
    const cfg = config as ShowOverlayConfig;
    const pos = cfg.position ?? { x: 0, y: 0, width: 240, height: 240 };
    return (
      <div className="space-y-3">
        <SectionLabel>Overlay</SectionLabel>
        <AssetPicker type="video" selectedIds={cfg.assetId ? [cfg.assetId] : []} multiple={false} onChange={([assetId]) => update(nodeId, { assetId })} />
        <div className="grid grid-cols-2 gap-2">
          <div><FieldLabel>Atraso ms</FieldLabel><input type="number" value={cfg.startOffsetMs ?? 0} onChange={(e) => update(nodeId, { startOffsetMs: Number(e.target.value) })} className={inputCls} /></div>
          <div><FieldLabel>Duracao ms</FieldLabel><input type="number" value={cfg.durationMs ?? 1000} onChange={(e) => update(nodeId, { durationMs: Number(e.target.value) })} className={inputCls} /></div>
          {(["x", "y", "width", "height"] as const).map((key) => (
            <div key={key}><FieldLabel>{key}</FieldLabel><input type="number" value={pos[key]} onChange={(e) => update(nodeId, { position: { ...pos, [key]: Number(e.target.value) } })} className={inputCls} /></div>
          ))}
        </div>
      </div>
    );
  }
  if (type === "SetSubtitleStyle") {
    const cfg = config as SetSubtitleStyleConfig;
    return (
      <div className="space-y-3">
        <SectionLabel>Legenda</SectionLabel>
        <div><FieldLabel>Palavras por grupo</FieldLabel><input type="number" min={1} max={10} value={cfg.wordsPerGroup ?? 3} onChange={(e) => update(nodeId, { wordsPerGroup: Number(e.target.value) })} className={inputCls} /></div>
        <SubtitleStyleFields value={cfg.style} onChange={(style) => update(nodeId, { style })} />
      </div>
    );
  }
  if (type === "ShowTitleCard") {
    const cfg = config as ShowTitleCardConfig;
    const field = (label: string, key: keyof ShowTitleCardConfig, placeholder: string) => (
      <div key={key}>
        <FieldLabel>{label}</FieldLabel>
        <input value={cfg[key] ?? ""} onChange={(e) => update(nodeId, { [key]: e.target.value })} placeholder={placeholder} className={inputCls} />
      </div>
    );
    return (
      <div className="space-y-3">
        <SectionLabel>Card de título</SectionLabel>
        <p className="text-xs text-nyx-text-muted">O título é a primeira frase da narração. O card some quando ela termina e a legenda segue normal.</p>
        {field("Subreddit", "subreddit", "r/historias")}
        {field("Usuario", "username", "funcionario_revoltado")}
        {field("Tempo", "timeAgo", "há 5h")}
        {field("Tag (flair)", "flair", "Relato da firma")}
        {field("Upvotes", "upvotes", "18.4k")}
        {field("Comentarios", "comments", "1.2k")}
      </div>
    );
  }
  if (type === "PlaySfx") {
    const cfg = config as PlaySfxConfig;
    return (
      <div className="space-y-3">
        <SectionLabel>SFX</SectionLabel>
        <AssetPicker type="audio" selectedIds={cfg.assetId ? [cfg.assetId] : []} multiple={false} onChange={([assetId]) => update(nodeId, { assetId })} />
        <div><FieldLabel>Atraso ms</FieldLabel><input type="number" value={cfg.startOffsetMs ?? 0} onChange={(e) => update(nodeId, { startOffsetMs: Number(e.target.value) })} className={inputCls} /></div>
      </div>
    );
  }
  if (type === "SetMusic") {
    const cfg = config as SetMusicConfig;
    return <div><FieldLabel>Volume: {Math.round((cfg.volume ?? 0.15) * 100)}%</FieldLabel><input type="range" min={0} max={1} step={0.01} value={cfg.volume ?? 0.15} onChange={(e) => update(nodeId, { volume: Number(e.target.value) })} className="w-full accent-nyx-cyan-500" /></div>;
  }
  if (type === "CameraEffect") {
    const cfg = config as CameraEffectConfig;
    const zoom = cfg.zoom ?? { factor: 1.05, direction: "in" as const };
    const shake = cfg.shake ?? { intensity: 0 };
    return (
      <div className="space-y-3">
        <SectionLabel>Camera</SectionLabel>
        <div><FieldLabel>Zoom: {Math.round(((zoom.factor ?? 1.05) - 1) * 100)}%</FieldLabel><input type="range" min={1} max={1.3} step={0.01} value={zoom.factor ?? 1.05} onChange={(e) => update(nodeId, { zoom: { ...zoom, factor: Number(e.target.value) } })} className="w-full accent-nyx-cyan-500" /></div>
        <div>
          <FieldLabel>Direcao</FieldLabel>
          <Select
            value={zoom.direction ?? "in"}
            onChange={(v) => update(nodeId, { zoom: { ...zoom, direction: v } })}
            options={[
              { value: "in", label: "Aproximar" },
              { value: "out", label: "Afastar" },
              { value: "random", label: "Aleatorio" },
            ]}
          />
        </div>
        <div><FieldLabel>Shake: {shake.intensity ?? 0}/10</FieldLabel><input type="range" min={0} max={10} step={1} value={shake.intensity ?? 0} onChange={(e) => update(nodeId, { shake: { ...shake, intensity: Number(e.target.value) } })} className="w-full accent-nyx-cyan-500" /></div>
      </div>
    );
  }
  return null;
}

function NodeForm({ nodeId, type, config }: { nodeId: string; type: NodeType; config: Record<string, unknown> }) {
  if (type === "NarrationSource") return <NarrationProps nodeId={nodeId} config={config as unknown as NarrationSourceConfig} />;
  if (type === "AssetSource") return <AssetSourceProps nodeId={nodeId} config={config as unknown as AssetSourceConfig} />;
  if (type === "SceneSource") return <SceneSourceProps nodeId={nodeId} config={config as unknown as SceneSourceConfig} />;
  if (type === "MusicSource") return <MusicSourceProps nodeId={nodeId} config={config as unknown as MusicSourceConfig} />;
  if (type.startsWith("On")) return <EventProps nodeId={nodeId} type={type} config={config} />;
  if (type === "Render") return <div className="rounded-lg border border-nyx-border bg-nyx-void p-3 text-xs text-nyx-text-muted">A saída usa as configurações do template.</div>;
  return <ActionProps nodeId={nodeId} type={type} config={config} />;
}

// ---------------------------------------------------------------------------
// Root panel
// ---------------------------------------------------------------------------

export function PropertiesPanel() {
  const selectedNodeId = useEditorStore((s) => s.selectedNodeId);
  const nodes = useEditorStore((s) => s.nodes);
  const removeNode = useEditorStore((s) => s.removeNode);

  const selectedNode = nodes.find((n) => n.id === selectedNodeId);
  const nodeType = selectedNode?.data?.type as NodeType | undefined;
  const nodeKind = selectedNode?.data?.kind as string | undefined;
  const nodeConfig = (selectedNode?.data?.config ?? {}) as Record<string, unknown>;
  const definition = nodeType ? NODE_DEFINITIONS[nodeType] : undefined;
  const kindLabel = {
    source: "entrada",
    event: "gatilho",
    action: "ação",
    output: "saída",
  }[nodeKind ?? ""];

  return (
    <div className="flex w-full flex-col border border-nyx-border bg-nyx-deep rounded-xl overflow-hidden">
      <AnimatePresence mode="wait">
        {!selectedNode || !nodeType ? (
          <motion.div key="empty" className="h-full" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <EmptyPanel />
          </motion.div>
        ) : (
          <motion.div key={selectedNodeId} className="flex h-full flex-col" initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 8 }} transition={{ duration: 0.15 }}>
            <div className="flex items-center justify-between border-b border-nyx-border px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-nyx-text-primary">{definition?.label ?? nodeType}</p>
                <p className="text-xs text-nyx-text-muted">{kindLabel ?? nodeKind} · {nodeType}</p>
              </div>
              <button onClick={() => removeNode(selectedNodeId!)} className="rounded p-1 text-nyx-text-muted hover:bg-red-500/10 hover:text-red-400" title="Remover etapa. Use Desfazer para recuperar.">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <NodeForm nodeId={selectedNodeId!} type={nodeType} config={nodeConfig} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
