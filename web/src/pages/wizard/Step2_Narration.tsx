import { useState } from "react";
import { Loader2, Mic, FileAudio, AlertCircle } from "lucide-react";
import { useStartAudio } from "../../hooks/useJobs";
import { useAssets } from "../../hooks/useAssets";
import { Button } from "../../components/ui/Button";
import { cn } from "../../lib/cn";
import type { JobStatus } from "../../lib/types";

type Tab = "tts" | "audio";

export function Step2_Narration({
  jobId,
  status,
}: {
  jobId: string;
  status: JobStatus;
}) {
  const [tab, setTab] = useState<Tab>("tts");
  const [text, setText] = useState("");
  const [audioAssetId, setAudioAssetId] = useState<string | null>(null);

  const startAudio = useStartAudio(jobId);
  const audioAssets = useAssets(0, "audio");
  const isProcessing = status === "audio_processing";

  async function handleSubmit() {
    if (tab === "tts") {
      if (!text.trim()) return;
      await startAudio.mutateAsync({
        type: "tts",
        text: text.trim(),
        provider: "talkify",
      });
    } else {
      if (!audioAssetId) return;
      await startAudio.mutateAsync({ type: "audio", assetId: audioAssetId });
    }
  }

  const canSubmit = tab === "tts" ? text.trim().length > 0 : !!audioAssetId;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Configurar narração</h2>
        <p className="text-sm text-white/50 mt-1">
          Gere o áudio do vídeo via TTS ou envie um áudio pronto.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white/5 rounded-lg p-1 w-fit">
        {(["tts", "audio"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
              tab === t ? "bg-white/10 text-white" : "text-white/40 hover:text-white/70",
            )}
          >
            {t === "tts" ? (
              <Mic className="w-3.5 h-3.5" />
            ) : (
              <FileAudio className="w-3.5 h-3.5" />
            )}
            {t === "tts" ? "Texto (TTS)" : "Áudio pronto"}
          </button>
        ))}
      </div>

      {tab === "tts" && (
        <div className="space-y-3">
          <label className="text-sm text-white/60">Roteiro</label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Cole o roteiro aqui. Separe cenas com linha em branco para gerar slots automáticos."
            rows={10}
            disabled={isProcessing}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-sm text-white placeholder-white/30 focus:outline-none focus:border-nyx-cyan-500/50 resize-none disabled:opacity-50"
          />
          <p className="text-xs text-white/30">
            {text.split(/\s+/).filter(Boolean).length} palavras
          </p>
        </div>
      )}

      {tab === "audio" && (
        <div className="space-y-3">
          <label className="text-sm text-white/60">Selecionar áudio da biblioteca</label>
          {audioAssets.isLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="w-4 h-4 animate-spin text-white/40" />
            </div>
          ) : audioAssets.data?.data.length === 0 ? (
            <p className="text-sm text-white/40 py-4">
              Nenhum arquivo de áudio encontrado. Faça upload em{" "}
              <a href="/assets" className="text-nyx-cyan-400 underline">
                Assets
              </a>
              .
            </p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {audioAssets.data?.data.map((asset) => (
                <button
                  key={asset.id}
                  onClick={() => setAudioAssetId(asset.id)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border text-left transition-all",
                    audioAssetId === asset.id
                      ? "border-nyx-cyan-500 bg-nyx-cyan-500/10"
                      : "border-white/10 bg-white/5 hover:border-white/20",
                  )}
                >
                  <FileAudio className="w-4 h-4 text-white/40 shrink-0" />
                  <span className="text-sm truncate">{asset.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Loading state */}
      {isProcessing && (
        <div className="flex items-center gap-3 px-4 py-3 bg-nyx-cyan-500/10 border border-nyx-cyan-500/20 rounded-lg">
          <Loader2 className="w-4 h-4 animate-spin text-nyx-cyan-400 shrink-0" />
          <div>
            <p className="text-sm font-medium text-nyx-cyan-300">Gerando áudio...</p>
            <p className="text-xs text-white/50 mt-0.5">
              Aguarde. Você avançará automaticamente quando o áudio estiver pronto.
            </p>
          </div>
        </div>
      )}

      {startAudio.isError && (
        <div className="flex items-center gap-2 px-3 py-2.5 bg-red-500/10 border border-red-500/20 rounded-lg">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
          <p className="text-sm text-red-300">
            Erro ao iniciar geração de áudio. Tente novamente.
          </p>
        </div>
      )}

      <div className="flex justify-end pt-2">
        <Button
          disabled={!canSubmit || isProcessing || startAudio.isPending}
          onClick={handleSubmit}
        >
          {(isProcessing || startAudio.isPending) ? (
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
          ) : null}
          {isProcessing ? "Gerando áudio..." : "Gerar áudio"}
        </Button>
      </div>
    </div>
  );
}
