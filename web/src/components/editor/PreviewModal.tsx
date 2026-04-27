import { useEffect, useRef, useState, useCallback } from "react";
import { X, Play, Square, Eye } from "lucide-react";
import { useEditorStore } from "../../stores/editorStore";
import { api } from "../../lib/api";
import { cn } from "../../lib/cn";
import type { VideoPoolConfig, SubtitleConfig, RenderConfig } from "../../lib/types";

// Word-group subtitle engine using Web Speech API
function useSubtitleEngine(text: string, wordsPerGroup: number) {
  const [groupIdx, setGroupIdx] = useState(-1);
  const [wordInGroup, setWordInGroup] = useState(0);
  const [speaking, setSpeaking] = useState(false);
  const utterRef = useRef<SpeechSynthesisUtterance | null>(null);

  // groups is an array of word arrays, e.g. [["Este","é","um"],["texto","de","exemplo"]]
  const groups = (() => {
    const words = text.trim().split(/\s+/).filter(Boolean);
    const result: string[][] = [];
    for (let i = 0; i < words.length; i += wordsPerGroup) {
      result.push(words.slice(i, i + wordsPerGroup));
    }
    return result;
  })();

  const start = useCallback(() => {
    if (!text.trim() || !("speechSynthesis" in window)) return;
    speechSynthesis.cancel();

    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = "pt-BR";
    utterRef.current = utter;

    utter.onboundary = (e) => {
      if (e.name !== "word") return;
      const spoken = text.slice(0, e.charIndex);
      const wordIdx = spoken.trim().split(/\s+/).filter(Boolean).length;
      setGroupIdx(Math.floor(wordIdx / wordsPerGroup));
      setWordInGroup(wordIdx % wordsPerGroup);
    };

    utter.onend = () => { setSpeaking(false); setGroupIdx(-1); };
    utter.onerror = () => { setSpeaking(false); setGroupIdx(-1); };

    setSpeaking(true);
    setGroupIdx(0);
    setWordInGroup(0);
    speechSynthesis.speak(utter);
  }, [text, wordsPerGroup, groups]);

  const stop = useCallback(() => {
    speechSynthesis.cancel();
    setSpeaking(false);
    setGroupIdx(-1);
  }, []);

  useEffect(() => () => { speechSynthesis.cancel(); }, []);

  return { groups, groupIdx, wordInGroup, speaking, start, stop };
}

export function PreviewModal() {
  const isOpen = useEditorStore((s) => s.isPreviewOpen);
  const nodes = useEditorStore((s) => s.nodes);
  const closePreview = useEditorStore((s) => s.closePreview);

  const videoPoolNode = nodes.find((n) => n.data?.type === "VideoPool");
  const subtitleNode = nodes.find((n) => n.data?.type === "Subtitle");
  const renderNode = nodes.find((n) => n.data?.type === "Render");

  const videoAssetIds = ((videoPoolNode?.data?.config as unknown as VideoPoolConfig)?.assetIds ?? []);
  const subtitleCfg = (subtitleNode?.data?.config as unknown as SubtitleConfig) ?? {};
  const renderCfg = (renderNode?.data?.config as unknown as RenderConfig) ?? { width: 1080, height: 1920, fps: 30 };

  const wordsPerGroup = subtitleCfg.wordsPerGroup ?? 3;
  const subStyle = subtitleCfg.style ?? {};
  const aspectRatio = renderCfg.width / renderCfg.height;

  const [previewText, setPreviewText] = useState(
    "Este é um texto de exemplo para preview. Você pode editar este texto para ver como a narração vai ficar com as legendas."
  );
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const { groups, groupIdx, wordInGroup, speaking, start, stop } = useSubtitleEngine(previewText, wordsPerGroup);

  // Fetch first video presigned URL
  useEffect(() => {
    if (!isOpen || videoAssetIds.length === 0) { setVideoUrl(null); return; }
    api.get<{ url: string }>(`/api/assets/${videoAssetIds[0]}/url`)
      .then((r) => setVideoUrl(r.url))
      .catch(() => setVideoUrl(null));
  }, [isOpen, videoAssetIds[0]]);

  // Keep video looping while speaking
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (speaking) { v.currentTime = 0; v.play().catch(() => {}); }
    else v.pause();
  }, [speaking]);

  const subtitlePosition = subStyle.position ?? "bottom";
  const posClass = subtitlePosition === "top" ? "top-8" : subtitlePosition === "center" ? "top-1/2 -translate-y-1/2" : "bottom-8";

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm" onClick={closePreview}>
      <div
        className="flex w-[900px] max-h-[90vh] gap-6 rounded-2xl border border-nyx-border bg-nyx-surface p-6 shadow-2xl overflow-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Video preview */}
        <div className="flex shrink-0 flex-col items-center gap-3">
          <div
            className="relative overflow-hidden rounded-xl bg-black shadow-lg"
            style={{ width: 270, height: Math.round(270 / aspectRatio) }}
          >
            {videoUrl ? (
              <video
                ref={videoRef}
                src={videoUrl}
                loop
                muted
                playsInline
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-nyx-text-muted">
                {videoAssetIds.length === 0 ? "Sem vídeo no pool" : "Carregando…"}
              </div>
            )}

            {/* Subtitle overlay */}
            {groupIdx >= 0 && groups[groupIdx] && (
              <div className={cn("absolute left-0 right-0 px-3 text-center", posClass)}>
                <span className="inline-flex flex-wrap justify-center gap-x-1 font-bold leading-snug">
                  {groups[groupIdx].map((word, i) => (
                    <span
                      key={i}
                      style={{
                        color: i === wordInGroup
                          ? (subStyle.highlightColor ?? "#ffdd00")
                          : (subStyle.color ?? "#ffffff"),
                        WebkitTextStroke: subStyle.strokeWidth
                          ? `${subStyle.strokeWidth}px ${subStyle.strokeColor ?? "#000"}`
                          : undefined,
                        fontSize: Math.round((subStyle.fontSize ?? 36) * 270 / renderCfg.width),
                        transition: "color 0.1s",
                      }}
                    >
                      {word}
                    </span>
                  ))}
                </span>
              </div>
            )}
          </div>

          {/* Play/stop */}
          <div className="flex gap-2">
            <button
              onClick={speaking ? stop : start}
              disabled={!previewText.trim()}
              className={cn(
                "flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition-all",
                speaking
                  ? "bg-red-500/20 text-red-400 hover:bg-red-500/30"
                  : "bg-nyx-cyan-500 text-white hover:opacity-90",
                "disabled:opacity-40 disabled:pointer-events-none"
              )}
            >
              {speaking ? <Square className="h-3 w-3 fill-current" /> : <Play className="h-3 w-3 fill-current" />}
              {speaking ? "Parar" : "Preview"}
            </button>
          </div>

          <p className="text-center text-[10px] text-nyx-text-muted leading-relaxed max-w-[270px]">
            Usa a voz do browser (Web Speech API).<br />Não consome créditos.
          </p>
        </div>

        {/* Text + info */}
        <div className="flex flex-1 flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Eye className="h-4 w-4 text-nyx-cyan-500" />
              <p className="text-sm font-semibold text-nyx-text-primary">Preview</p>
            </div>
            <button onClick={closePreview} className="text-nyx-text-muted hover:text-nyx-text-primary">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-nyx-text-secondary">
              Texto de narração (exemplo)
            </label>
            <textarea
              value={previewText}
              onChange={(e) => { if (speaking) stop(); setPreviewText(e.target.value); }}
              rows={8}
              className="w-full resize-none rounded-lg border border-nyx-border bg-nyx-void px-3 py-2.5 text-xs text-nyx-text-primary placeholder:text-nyx-text-muted focus:border-nyx-cyan-500 focus:outline-none"
              placeholder="Digite o texto para simular a narração…"
            />
          </div>

          {/* Config summary */}
          <div className="space-y-1 rounded-lg border border-nyx-border bg-nyx-void/50 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-nyx-text-muted">Configuração atual</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-nyx-text-secondary">
              <span>Resolução</span>
              <span className="font-mono">{renderCfg.width}×{renderCfg.height}</span>
              <span>Legendas</span>
              <span className="font-mono">{wordsPerGroup} palavras/grupo</span>
              <span>Posição</span>
              <span className="font-mono">{subStyle.position ?? "bottom"}</span>
              <span>Vídeos no pool</span>
              <span className="font-mono">{videoAssetIds.length}</span>
            </div>
          </div>

          <div className="mt-auto rounded-lg border border-nyx-warning/30 bg-nyx-warning/5 px-3 py-2.5">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-nyx-warning">Limitações do preview</p>
            <ul className="space-y-0.5 text-[10px] text-nyx-text-muted">
              <li>• Voz gerada pelo browser — não é o TTS real do vídeo</li>
              <li>• Sincronização de legendas é aproximada (varia por browser/SO)</li>
              <li>• Apenas o primeiro vídeo do pool é exibido</li>
              <li>• Música de fundo não é reproduzida</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
