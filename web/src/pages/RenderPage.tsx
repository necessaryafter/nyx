import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useQueries, useMutation } from "@tanstack/react-query";
import {
  ArrowLeft,
  Clapperboard,
  Loader2,
  AlertCircle,
  Play,
  X,
  Search,
  Check,
} from "lucide-react";
import { api } from "../lib/api";
import { cn } from "../lib/cn";
import { ClipPlayer } from "../components/render/ClipPlayer";
import { useCreditsBalance } from "../hooks/useCredits";
import { useAssets } from "../hooks/useAssets";
import type { TemplateWithGraph, GraphNode } from "../lib/types";

const RENDER_CREDITS = 20;
const TTS_CREDITS = 10;

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 border-t border-nyx-border pt-3 mt-3">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-nyx-text-muted whitespace-nowrap">
        {children}
      </span>
      <div className="flex-1 border-t border-nyx-border" />
    </div>
  );
}

function SingleAssetPickerModal({
  type,
  currentId,
  onConfirm,
  onClose,
}: {
  type: "video" | "audio";
  currentId: string | null;
  onConfirm: (id: string, name: string) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(currentId);
  const [selectedName, setSelectedName] = useState("");
  const assets = useAssets(0, type, search || undefined);

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex w-[480px] max-h-[70vh] flex-col rounded-2xl border border-nyx-border bg-nyx-surface shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-nyx-border px-5 py-4">
          <p className="text-sm font-semibold text-nyx-text-primary">
            Selecionar {type === "audio" ? "áudio" : "vídeo"}
          </p>
          <button onClick={onClose}>
            <X className="h-4 w-4 text-nyx-text-muted hover:text-nyx-text-primary" />
          </button>
        </div>
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
        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          {assets.isPending && (
            <p className="py-8 text-center text-xs text-nyx-text-muted">Carregando...</p>
          )}
          {!assets.isPending && (assets.data?.data.length ?? 0) === 0 && (
            <p className="py-8 text-center text-xs text-nyx-text-muted">
              Nenhum asset encontrado
            </p>
          )}
          {assets.data?.data.map((asset) => {
            const isSelected = selectedId === asset.id;
            return (
              <button
                key={asset.id}
                onClick={() => { setSelectedId(asset.id); setSelectedName(asset.name); }}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors",
                  isSelected
                    ? "border-nyx-cyan-500 bg-nyx-cyan-500/10"
                    : "border-nyx-border bg-nyx-void hover:border-nyx-hover",
                )}
              >
                <div className={cn(
                  "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
                  isSelected ? "border-nyx-cyan-500 bg-nyx-cyan-500" : "border-nyx-border",
                )}>
                  {isSelected && <Check className="h-2.5 w-2.5 text-white" />}
                </div>
                <span className="flex-1 truncate text-xs text-nyx-text-primary">{asset.name}</span>
                {asset.sizeBytes && (
                  <span className="shrink-0 text-[10px] text-nyx-text-muted">
                    {(asset.sizeBytes / (1024 * 1024)).toFixed(1)} MB
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <div className="flex items-center justify-between border-t border-nyx-border px-5 py-3">
          <button
            onClick={onClose}
            className="rounded-lg px-3 py-1.5 text-xs text-nyx-text-secondary hover:bg-nyx-hover"
          >
            Cancelar
          </button>
          <button
            onClick={() => selectedId && onConfirm(selectedId, selectedName)}
            disabled={!selectedId}
            className="rounded-lg bg-nyx-cyan-500 px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-40"
          >
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
}

export function RenderPage() {
  const { templateId } = useParams<{ templateId: string }>();
  const navigate = useNavigate();

  const templateQuery = useQuery({
    queryKey: ["templates", templateId],
    queryFn: () => api.get<TemplateWithGraph>(`/api/templates/${templateId}`),
    enabled: !!templateId,
  });

  const balance = useCreditsBalance();
  const nodes = templateQuery.data?.graph.nodes ?? [];

  const ttsNode = nodes.find((n): n is Extract<GraphNode, { type: "TTS" }> => n.type === "TTS");
  const transitionNode = nodes.find((n): n is Extract<GraphNode, { type: "Transition" }> => n.type === "Transition");
  const zoomNode = nodes.find((n): n is Extract<GraphNode, { type: "Zoom" }> => n.type === "Zoom");
  const shakeNode = nodes.find((n): n is Extract<GraphNode, { type: "Shake" }> => n.type === "Shake");
  const videoMediaPools = nodes.filter((n): n is Extract<GraphNode, { type: "MediaPool" }> => n.type === "MediaPool" && n.config.assetType === "video");
  const audioMediaPools = nodes.filter((n): n is Extract<GraphNode, { type: "MediaPool" }> => n.type === "MediaPool" && n.config.assetType === "audio");
  const sceneSlots = nodes.filter((n): n is Extract<GraphNode, { type: "SceneSlot" }> => n.type === "SceneSlot");

  const videoAssetIds = videoMediaPools.flatMap((n) => n.config.assetIds);
  const audioAssetIds = audioMediaPools.flatMap((n) => n.config.assetIds);
  const allAssetIds = [...videoAssetIds, ...audioAssetIds];

  const assetUrlQueries = useQueries({
    queries: allAssetIds.map((id) => ({
      queryKey: ["assets", id, "url"],
      queryFn: () => api.get<{ url: string }>(`/api/assets/${id}/url`),
      staleTime: 50 * 60 * 1000,
    })),
  });

  const assetUrlMap: Record<string, string> = {};
  allAssetIds.forEach((id, i) => {
    const url = assetUrlQueries[i]?.data?.url;
    if (url) assetUrlMap[id] = url;
  });

  const clipUrls = videoAssetIds.map((id) => assetUrlMap[id]).filter(Boolean) as string[];
  const firstAudioUrl = audioAssetIds.map((id) => assetUrlMap[id]).find(Boolean);

  // Form state
  const [narrationMode, setNarrationMode] = useState<"tts" | "audio">("tts");
  const [ttsText, setTtsText] = useState("");
  const [audioAssetId, setAudioAssetId] = useState<string | null>(null);
  const [audioAssetName, setAudioAssetName] = useState<string | null>(null);
  const [audioPickerOpen, setAudioPickerOpen] = useState(false);
  const [sceneOverrides, setSceneOverrides] = useState<Record<string, { assetId: string; assetName: string }>>({});
  const [pickerNodeId, setPickerNodeId] = useState<string | null>(null);

  const hasTTS = !!ttsNode && ttsNode.config.provider !== "custom";
  const ttsCredits = hasTTS && narrationMode === "tts" ? TTS_CREDITS : 0;
  const totalCredits = RENDER_CREDITS + ttsCredits;
  const currentBalance = balance.data?.balance ?? 0;
  const balanceAfter = currentBalance - totalCredits;
  const hasEnoughCredits = currentBalance >= totalCredits;

  const createJob = useMutation({
    mutationFn: () => {
      const narration =
        narrationMode === "tts"
          ? { type: "tts" as const, text: ttsText }
          : { type: "audio" as const, assetId: audioAssetId! };
      const overrides = Object.entries(sceneOverrides).map(([nodeId, { assetId }]) => ({ nodeId, assetId }));
      return api.post<{ id: string }>("/api/jobs", {
        templateId,
        narration,
        ...(overrides.length > 0 ? { sceneOverrides: overrides } : {}),
      });
    },
    onSuccess: () => navigate("/jobs"),
  });

  const canSubmit =
    hasEnoughCredits &&
    !createJob.isPending &&
    (narrationMode === "audio" ? !!audioAssetId : ttsText.trim().length > 0) &&
    sceneSlots.every((slot) => !!sceneOverrides[slot.id]);

  const activePickerSlot = sceneSlots.find((s) => s.id === pickerNodeId);

  if (templateQuery.isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-nyx-void">
        <Loader2 className="h-6 w-6 animate-spin text-nyx-text-muted" />
      </div>
    );
  }

  if (templateQuery.isError || !templateQuery.data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-nyx-void">
        <p className="text-sm text-nyx-error">Template não encontrado.</p>
      </div>
    );
  }

  const template = templateQuery.data;

  return (
    <div className="flex h-screen flex-col bg-nyx-void overflow-hidden">
      {/* Modals */}
      {activePickerSlot && (
        <SingleAssetPickerModal
          type={activePickerSlot.config.assetType === "image" ? "video" : activePickerSlot.config.assetType}
          currentId={sceneOverrides[activePickerSlot.id]?.assetId ?? null}
          onConfirm={(id, name) => {
            setSceneOverrides((prev) => ({ ...prev, [activePickerSlot.id]: { assetId: id, assetName: name } }));
            setPickerNodeId(null);
          }}
          onClose={() => setPickerNodeId(null)}
        />
      )}
      {audioPickerOpen && (
        <SingleAssetPickerModal
          type="audio"
          currentId={audioAssetId}
          onConfirm={(id, name) => { setAudioAssetId(id); setAudioAssetName(name); setAudioPickerOpen(false); }}
          onClose={() => setAudioPickerOpen(false)}
        />
      )}

      {/* Top bar */}
      <div className="flex h-14 shrink-0 items-center gap-4 border-b border-nyx-border bg-nyx-deep px-4">
        <Link
          to="/templates"
          className="flex items-center gap-1.5 text-xs font-medium text-nyx-cyan-500 hover:opacity-80"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Link>
        <div className="h-4 w-px bg-nyx-border" />
        <Clapperboard className="h-4 w-4 text-nyx-text-muted" />
        <h1 className="font-display text-lg font-semibold text-nyx-text-primary">{template.name}</h1>
      </div>

      {/* 3-panel layout */}
      <div className="flex min-h-0 flex-1 gap-4 overflow-hidden p-4">

        {/* ── LEFT: Config ── */}
        <div className="w-80 shrink-0 overflow-y-auto">
          <div className="rounded-xl border border-nyx-border bg-nyx-surface p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-nyx-text-muted">
              Narração
            </p>

            {/* Narration toggle */}
            <div className="mt-2 flex rounded-lg bg-nyx-elevated p-0.5">
              {(["tts", "audio"] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setNarrationMode(mode)}
                  className={cn(
                    "flex-1 rounded-md py-1.5 text-xs font-medium transition-colors",
                    narrationMode === mode
                      ? "bg-orange-500/15 text-orange-400"
                      : "text-nyx-text-muted hover:text-nyx-text-secondary",
                  )}
                >
                  {mode === "tts" ? "Texto (TTS)" : "Áudio custom"}
                </button>
              ))}
            </div>

            {narrationMode === "tts" ? (
              <textarea
                value={ttsText}
                onChange={(e) => setTtsText(e.target.value)}
                placeholder="Digite a narração aqui..."
                rows={6}
                className="mt-2 w-full resize-none rounded-lg border border-nyx-border bg-nyx-void p-3 text-sm text-nyx-text-primary placeholder:text-nyx-text-muted focus:border-nyx-cyan-500 focus:outline-none"
              />
            ) : (
              <button
                onClick={() => setAudioPickerOpen(true)}
                className={cn(
                  "mt-2 flex h-9 w-full items-center justify-between rounded-lg border px-3 text-xs transition-colors",
                  audioAssetId
                    ? "border-nyx-cyan-500/40 bg-nyx-void text-nyx-text-primary"
                    : "border-nyx-border bg-nyx-void text-nyx-text-muted hover:border-nyx-hover",
                )}
              >
                <span className="truncate">{audioAssetName ?? "Selecionar áudio…"}</span>
                {audioAssetId && (
                  <X
                    className="h-3 w-3 shrink-0 text-nyx-text-muted hover:text-red-400"
                    onClick={(e) => { e.stopPropagation(); setAudioAssetId(null); setAudioAssetName(null); }}
                  />
                )}
              </button>
            )}

            {/* SceneSlots */}
            {sceneSlots.length > 0 && (
              <>
                <SectionLabel>Cenas únicas</SectionLabel>
                <div className="mt-2 space-y-2">
                  {sceneSlots.map((slot) => {
                    const override = sceneOverrides[slot.id];
                    return (
                      <div key={slot.id}>
                        <p className="mb-1 text-xs font-medium text-nyx-text-primary">
                          {slot.config.label}
                        </p>
                        <button
                          onClick={() => setPickerNodeId(slot.id)}
                          className={cn(
                            "flex h-9 w-full items-center justify-between rounded-lg border px-3 text-xs transition-colors",
                            override
                              ? "border-nyx-cyan-500/40 bg-nyx-void text-nyx-text-primary"
                              : "border-yellow-500/50 bg-nyx-void text-nyx-text-muted hover:border-yellow-400",
                          )}
                        >
                          <span className="flex flex-1 items-center gap-1.5 truncate">
                            {!override && <AlertCircle className="h-3 w-3 shrink-0 text-yellow-500" />}
                            {override ? override.assetName : `Escolher ${slot.config.assetType}…`}
                          </span>
                          {override && (
                            <X
                              className="h-3 w-3 shrink-0 text-nyx-text-muted hover:text-red-400"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSceneOverrides((prev) => {
                                  const next = { ...prev };
                                  delete next[slot.id];
                                  return next;
                                });
                              }}
                            />
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {/* Cost */}
            <SectionLabel>Custo estimado</SectionLabel>
            <div className="mt-2 space-y-1 text-xs">
              <div className="flex justify-between text-nyx-text-secondary">
                <span>Renderização</span>
                <span>{RENDER_CREDITS} cr</span>
              </div>
              {hasTTS && narrationMode === "tts" && (
                <div className="flex justify-between text-nyx-text-secondary">
                  <span>TTS ({ttsNode.config.provider})</span>
                  <span>{TTS_CREDITS} cr</span>
                </div>
              )}
              <div className="flex justify-between border-t border-nyx-border pt-1 font-semibold text-nyx-text-primary">
                <span>Total</span>
                <span>{totalCredits} cr</span>
              </div>
              <p className={cn("text-[10px]", hasEnoughCredits ? "text-nyx-text-muted" : "text-nyx-error")}>
                {hasEnoughCredits
                  ? `${currentBalance} cr disponíveis · ${balanceAfter} cr após render`
                  : "Créditos insuficientes"}
              </p>
            </div>

            {/* Render button */}
            <button
              onClick={() => createJob.mutate()}
              disabled={!canSubmit}
              className={cn(
                "mt-3 flex w-full items-center justify-center gap-2 rounded-lg py-3 text-sm font-semibold text-white transition-all",
                canSubmit
                  ? "bg-orange-500 hover:bg-orange-400 shadow-[0_0_20px_rgba(249,115,22,0.3)] hover:shadow-[0_0_30px_rgba(249,115,22,0.4)]"
                  : "cursor-not-allowed bg-nyx-elevated opacity-50",
              )}
            >
              {createJob.isPending ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Criando job...</>
              ) : (
                <><Play className="h-4 w-4" /> Renderizar</>
              )}
            </button>

            {createJob.isError && (
              <p className="mt-2 text-xs text-nyx-error">
                Erro ao criar job. Verifique os campos e tente novamente.
              </p>
            )}
          </div>
        </div>

        {/* ── CENTER: Player ── */}
        <div className="flex min-w-0 flex-1 items-center justify-center">
          <ClipPlayer
            clips={clipUrls}
            musicUrl={firstAudioUrl}
            transitionDur={transitionNode?.config.duration ?? 0.5}
            zoom={zoomNode?.config.factor}
            shake={shakeNode?.config.intensity}
          />
        </div>

        {/* ── RIGHT: Info ── */}
        <div className="w-72 shrink-0 overflow-y-auto">
          <div className="rounded-xl border border-nyx-border bg-nyx-surface p-4">
            {/* Videos */}
            {videoMediaPools.length > 0 && (
              <>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-nyx-text-muted">
                  Vídeos
                </p>
                <div className="mt-2 space-y-1.5">
                  {videoMediaPools.flatMap((pool) => pool.config.assetIds).map((id) => (
                    <div key={id} className="flex items-center gap-2">
                      {assetUrlMap[id] ? (
                        <video
                          muted
                          preload="metadata"
                          src={assetUrlMap[id]}
                          className="h-8 w-14 shrink-0 rounded bg-black object-cover"
                        />
                      ) : (
                        <div className="h-8 w-14 shrink-0 animate-pulse rounded bg-nyx-elevated" />
                      )}
                      <span className="truncate font-mono text-[10px] text-nyx-text-muted">
                        {id.slice(0, 14)}…
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Music */}
            {audioMediaPools.length > 0 && (
              <>
                <SectionLabel>Músicas</SectionLabel>
                <div className="mt-2 space-y-1.5">
                  {audioMediaPools.flatMap((pool) => pool.config.assetIds).map((id) =>
                    assetUrlMap[id] ? (
                      <audio key={id} controls src={assetUrlMap[id]} className="h-8 w-full" />
                    ) : (
                      <div key={id} className="h-8 animate-pulse rounded bg-nyx-elevated" />
                    ),
                  )}
                </div>
              </>
            )}

            {/* Effects */}
            {(transitionNode || zoomNode || shakeNode) && (
              <>
                <SectionLabel>Efeitos</SectionLabel>
                <div className="mt-2 space-y-1.5">
                  {transitionNode && (
                    <span className="inline-block rounded-md bg-nyx-elevated px-2 py-1 text-[10px] text-nyx-text-secondary">
                      {transitionNode.config.types[0] ?? "fade"} · {transitionNode.config.mode} · {transitionNode.config.duration}s
                    </span>
                  )}
                  {zoomNode && (
                    <div>
                      <span className="inline-block rounded-md bg-nyx-elevated px-2 py-1 text-[10px] text-nyx-text-secondary">
                        Zoom +{Math.round((zoomNode.config.factor - 1) * 100)}% · {zoomNode.config.direction}
                      </span>
                    </div>
                  )}
                  {shakeNode && (
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-nyx-text-muted">Shake</span>
                      {Array.from({ length: 10 }, (_, i) => (
                        <div
                          key={i}
                          className={cn(
                            "h-2 w-2 rounded-sm",
                            i < shakeNode.config.intensity ? "bg-orange-500" : "bg-nyx-elevated",
                          )}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}

            {/* TTS */}
            {ttsNode && (
              <>
                <SectionLabel>TTS</SectionLabel>
                <p className="mt-2 text-xs text-nyx-text-muted">
                  {ttsNode.config.provider} · {ttsNode.config.voice ?? "padrão"} · {ttsNode.config.speed ?? 1.0}x
                </p>
              </>
            )}

            {videoMediaPools.length === 0 && audioMediaPools.length === 0 && !ttsNode && !transitionNode && (
              <p className="text-xs text-nyx-text-muted">Nenhuma informação disponível.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
