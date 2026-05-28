import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Play, Loader2, Upload } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "../ui/Button";
import { useEditorStore } from "../../stores/editorStore";
import { useCreditsBalance } from "../../hooks/useCredits";
import { api } from "../../lib/api";
import { cn } from "../../lib/cn";

export function RenderModal() {
  const isOpen = useEditorStore((s) => s.isRenderModalOpen);
  const close = useEditorStore((s) => s.closeRenderModal);
  const templateId = useEditorStore((s) => s.templateId);
  const nodes = useEditorStore((s) => s.nodes);
  const edges = useEditorStore((s) => s.edges);

  const { data: balance } = useCreditsBalance();
  const navigate = useNavigate();

  const [mode, setMode] = useState<"tts" | "audio">("tts");
  const [ttsProvider, setTtsProvider] = useState<"talkify" | "edge">("talkify");
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const estimatedRenderCredits = 20;
  const estimatedTTSCredits = mode === "tts" ? 10 : 0;
  const totalCredits = estimatedRenderCredits + estimatedTTSCredits;
  const currentBalance = balance?.balance ?? 0;
  const balanceAfter = currentBalance - totalCredits;
  const canAfford = currentBalance >= totalCredits;

  const handleRender = async () => {
    if (!templateId || !canAfford) return;
    setError("");
    setSubmitting(true);

    try {
      const draft = await api.post<{ id: string }>("/api/jobs/draft", { templateId });
      const narration =
        mode === "tts"
          ? { type: "tts" as const, text, provider: ttsProvider }
          : { type: "audio" as const, assetId: "" };
      await api.post(`/api/jobs/${draft.id}/audio`, { narration });
      close();
      navigate(`/jobs/${draft.id}/edit`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar job");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={close}
          />

          <motion.div
            className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-nyx-border bg-nyx-elevated p-6 shadow-2xl"
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ duration: 0.2 }}
          >
            {/* Header */}
            <div className="flex items-start justify-between">
              <div>
                <h2 className="font-display text-lg font-semibold text-nyx-text-primary">
                  Iniciar renderização
                </h2>
                <p className="mt-0.5 text-sm text-nyx-text-muted">
                  {nodes.length} nodes · {edges.length} edges
                </p>
              </div>
              <button
                onClick={close}
                className="rounded p-1 text-nyx-text-muted hover:bg-nyx-hover hover:text-nyx-text-primary"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-5 space-y-5">
              {/* Narration mode */}
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-nyx-text-muted">
                  Narração
                </p>
                <div className="flex gap-2">
                  {[
                    { value: "tts" as const, label: "Texto para TTS" },
                    { value: "audio" as const, label: "Upload de áudio" },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setMode(opt.value)}
                      className={cn(
                        "flex-1 rounded-lg border px-3 py-2 text-sm transition-colors",
                        mode === opt.value
                          ? "border-nyx-cyan-500 bg-nyx-cyan-500/10 text-nyx-cyan-500"
                          : "border-nyx-border text-nyx-text-muted hover:border-nyx-hover",
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                {mode === "tts" ? (
                  <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Era uma noite escura quando o usuário do Reddit postou..."
                    rows={4}
                    className="mt-3 w-full resize-none rounded-lg border border-nyx-border bg-nyx-void px-3 py-2.5 text-sm text-nyx-text-primary placeholder:text-nyx-text-muted focus:border-nyx-cyan-500 focus:outline-none"
                  />
                ) : (
                  <div className="mt-3 flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-nyx-border bg-nyx-void py-4 text-sm text-nyx-text-muted hover:border-nyx-hover">
                    <Upload className="h-4 w-4" />
                    Escolher arquivo de áudio...
                  </div>
                )}
                {mode === "tts" && (
                  <div className="mt-2 flex gap-1 rounded-lg border border-nyx-border bg-nyx-void p-0.5">
                    {(["talkify", "edge"] as const).map((p) => (
                      <button
                        key={p}
                        onClick={() => setTtsProvider(p)}
                        className={cn(
                          "flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors",
                          ttsProvider === p
                            ? "bg-nyx-elevated text-nyx-text-primary"
                            : "text-nyx-text-muted hover:text-nyx-text-secondary",
                        )}
                      >
                        {p === "talkify" ? "Talkify" : "Edge TTS (gratuito)"}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Cost breakdown */}
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-nyx-text-muted">
                  Custo
                </p>
                <div className="space-y-1 rounded-xl border border-nyx-border bg-nyx-void/50 p-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-nyx-text-secondary">Renderização</span>
                    <span className="font-mono text-nyx-text-primary">
                      {estimatedRenderCredits} cr
                    </span>
                  </div>
                  {mode === "tts" && (
                    <div className="flex justify-between text-sm">
                      <span className="text-nyx-text-secondary">TTS</span>
                      <span className="font-mono text-nyx-text-primary">
                        {estimatedTTSCredits} cr
                      </span>
                    </div>
                  )}
                  <div className="mt-2 border-t border-nyx-border pt-2">
                    <div className="flex justify-between font-medium">
                      <span className="text-sm text-nyx-text-primary">Total</span>
                      <span className="font-mono text-sm text-nyx-text-primary">
                        {totalCredits} cr
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-2 space-y-1">
                  <div className="flex justify-between text-xs text-nyx-text-muted">
                    <span>Saldo atual</span>
                    <span className="font-mono">{currentBalance} cr</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-nyx-text-muted">Saldo após</span>
                    <span
                      className={cn(
                        "font-mono",
                        balanceAfter < 0 ? "text-red-400" : "text-nyx-text-muted",
                      )}
                    >
                      {balanceAfter} cr
                    </span>
                  </div>
                </div>

                {!canAfford && (
                  <p className="mt-2 text-xs text-red-400">
                    Créditos insuficientes para este render.{" "}
                    <a href="/credits" className="underline">
                      Comprar créditos
                    </a>
                  </p>
                )}
              </div>

              {error && <p className="text-xs text-red-400">{error}</p>}

              {/* Actions */}
              <div className="flex gap-3">
                <Button variant="ghost" size="md" onClick={close} className="flex-1">
                  Cancelar
                </Button>
                <button
                  onClick={handleRender}
                  disabled={
                    !canAfford ||
                    submitting ||
                    (mode === "tts" && !text.trim())
                  }
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-nyx-orange-500 px-4 py-2.5 text-sm font-medium text-white transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 shadow-[0_0_20px_rgba(249,115,22,0.3)]"
                >
                  {submitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Play className="h-4 w-4" />
                  )}
                  Renderizar
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
