import { useState, useRef, useEffect } from "react";
import Markdown from "react-markdown";
import {
  Loader2,
  Mic,
  FileAudio,
  AlertCircle,
  ArrowUp,
  Bot,
  ChevronDown,
} from "lucide-react";
import { useStartAudio, useJob } from "../../hooks/useJobs";
import { useAssets } from "../../hooks/useAssets";
import { Button } from "../../components/ui/Button";
import { api } from "../../lib/api";
import { cn } from "../../lib/cn";
import type { JobStatus } from "../../lib/types";

type Tab = "tts" | "audio";
type Role = "user" | "model";

interface Message {
  role: Role;
  text: string;
  isError?: boolean;
}

// Modelos antigos (2.0-flash, 1.5-pro) foram descontinuados pelo Google — a API já nem aceita mais.
const AI_MODELS = [
  { id: "gemini-3.1-flash-lite", label: "Gemini 3.1 Flash Lite (rápido)" },
  { id: "gemini-3.8-flash", label: "Gemini 3.8 Flash (mais recente)" },
  { id: "gemini-3.1-pro-preview", label: "Gemini 3.1 Pro (mais caprichado)" },
] as const;

const INITIAL_MESSAGE: Message = {
  role: "model",
  text: "Olá! Sou seu assistente de roteiros. Me conta sobre o vídeo que você quer criar: qual é o tema, o tom desejado (informativo, inspiracional, engraçado...) e a duração aproximada?",
};

function extractScript(text: string): string | null {
  const match = text.match(/---ROTEIRO---([\s\S]*?)---FIM---/);
  return match ? match[1].trim() : null;
}

const mdComponents: React.ComponentProps<typeof Markdown>["components"] = {
  p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
  strong: ({ children }) => <strong className="font-semibold text-nyx-text-primary">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  code: ({ children }) => (
    <code className="rounded bg-nyx-elevated px-1 py-0.5 font-mono text-xs text-nyx-text-secondary">{children}</code>
  ),
  ul: ({ children }) => <ul className="my-1 ml-4 list-disc space-y-0.5">{children}</ul>,
  ol: ({ children }) => <ol className="my-1 ml-4 list-decimal space-y-0.5">{children}</ol>,
  li: ({ children }) => <li>{children}</li>,
};

function renderText(text: string): React.ReactNode {
  const scriptMatch = text.match(/---ROTEIRO---([\s\S]*?)---FIM---/);
  if (!scriptMatch) {
    return <Markdown components={mdComponents}>{text}</Markdown>;
  }

  const before = text.slice(0, text.indexOf("---ROTEIRO---")).trim();
  const after = text.slice(text.indexOf("---FIM---") + 9).trim();
  const script = scriptMatch[1].trim();

  return (
    <div className="space-y-3">
      {before && <Markdown components={mdComponents}>{before}</Markdown>}
      <div className="rounded-lg border border-nyx-border bg-nyx-surface px-3.5 py-3 font-mono text-xs leading-relaxed text-nyx-text-secondary whitespace-pre-wrap">
        {script}
      </div>
      {after && <Markdown components={mdComponents}>{after}</Markdown>}
    </div>
  );
}

function ChatMessage({ msg }: { msg: Message }) {
  const isUser = msg.role === "user";

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[78%] rounded-2xl rounded-br-sm bg-nyx-elevated px-4 py-2.5 text-sm text-nyx-text-primary whitespace-pre-wrap">
          {msg.text}
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-3">
      <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-nyx-cyan-500/15 ring-1 ring-nyx-cyan-500/20">
        <Bot className="h-3.5 w-3.5 text-nyx-cyan-400" />
      </div>
      <div
        className={cn(
          "flex-1 text-sm leading-relaxed",
          msg.isError ? "text-red-500" : "text-nyx-text-secondary",
        )}
      >
        {renderText(msg.text)}
      </div>
    </div>
  );
}

export function Step2_Narration({
  jobId,
  status,
}: {
  jobId: string;
  status: JobStatus;
}) {
  const [tab, setTab] = useState<Tab>("tts");
  const [script, setScript] = useState("");
  const [audioAssetId, setAudioAssetId] = useState<string | null>(null);

  const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE]);
  const [input, setInput] = useState("");
  const [isAILoading, setIsAILoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState<string>(AI_MODELS[0].id);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const modelDropdownRef = useRef<HTMLDivElement>(null);
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (modelDropdownRef.current && !modelDropdownRef.current.contains(e.target as Node)) {
        setModelDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const { data: job } = useJob(jobId);
  const narrationCfg = job?.graph?.nodes.find((n) => n.type === "NarrationSource")?.config;
  const ttsProvider = (narrationCfg?.provider as "talkify" | "edge" | undefined) ?? "talkify";

  useEffect(() => {
    if (!job) return;
    const narrationNode = job.graph?.nodes.find((n) => n.type === "NarrationSource");
    const savedText = narrationNode?.config?.text as string | undefined;
    if (savedText) setScript(savedText);
  }, [job?.id]);

  const startAudio = useStartAudio(jobId);
  const audioAssets = useAssets(0, "audio");
  const isProcessing = status === "audio_processing";

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isAILoading]);

  async function sendMessage() {
    const trimmed = input.trim();
    if (!trimmed || isAILoading) return;

    const userMsg: Message = { role: "user", text: trimmed };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setInput("");
    setIsAILoading(true);

    try {
      const res = await api.post<{ text?: string; error?: string }>("/api/ai/script", {
        messages: nextMessages
          .filter((m) => !m.isError)
          .map((m) => ({ role: m.role, text: m.text })),
        model: selectedModel,
      });

      const aiText = res.text ?? res.error ?? "Erro desconhecido";
      const aiMsg: Message = {
        role: "model",
        text: aiText,
        isError: !!res.error,
      };
      setMessages((prev) => [...prev, aiMsg]);

      const extracted = extractScript(aiText);
      if (extracted) setScript(extracted);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "model",
          text: "Erro ao conectar com a IA. Verifique se GOOGLE_AI_STUDIO_KEY está configurada.",
          isError: true,
        },
      ]);
    } finally {
      setIsAILoading(false);
    }
  }

  async function handleSubmit() {
    if (tab === "tts") {
      if (!script.trim()) return;
      await startAudio.mutateAsync({
        type: "tts",
        text: script.trim(),
        provider: ttsProvider,
        voice: narrationCfg?.voice as string | undefined,
        speed: narrationCfg?.speed as number | undefined,
      });
    } else {
      if (!audioAssetId) return;
      await startAudio.mutateAsync({ type: "audio", assetId: audioAssetId });
    }
  }

  const canSubmit = tab === "tts" ? script.trim().length > 0 : !!audioAssetId;

  return (
    <div className="flex flex-col h-full gap-5">
      <div>
        <h2 className="text-lg font-semibold text-nyx-text-primary">Configurar narração</h2>
        <p className="text-sm text-nyx-text-secondary mt-1">
          Gere o áudio do vídeo via TTS ou envie um áudio pronto.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-nyx-surface rounded-lg p-1 w-fit">
        {(["tts", "audio"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
              tab === t
                ? "bg-nyx-elevated text-nyx-text-primary"
                : "text-nyx-text-muted hover:text-nyx-text-secondary",
            )}
          >
            {t === "tts" ? <Mic className="w-3.5 h-3.5" /> : <FileAudio className="w-3.5 h-3.5" />}
            {t === "tts" ? "Texto (TTS)" : "Áudio pronto"}
          </button>
        ))}
      </div>

      {/* TTS — split layout */}
      {tab === "tts" && (
        <div className="flex flex-1 min-h-0 gap-5">
          {/* Left: AI Chat */}
          <div className="flex flex-col flex-1 min-w-0">
            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-1 py-2 space-y-5">
              {messages.map((msg, i) => (
                <ChatMessage key={i} msg={msg} />
              ))}
              {isAILoading && (
                <div className="flex gap-3">
                  <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-nyx-cyan-500/15 ring-1 ring-nyx-cyan-500/20">
                    <Bot className="h-3.5 w-3.5 text-nyx-cyan-400" />
                  </div>
                  <div className="flex items-center gap-1 pt-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-nyx-text-muted animate-bounce [animation-delay:0ms]" />
                    <span className="h-1.5 w-1.5 rounded-full bg-nyx-text-muted animate-bounce [animation-delay:150ms]" />
                    <span className="h-1.5 w-1.5 rounded-full bg-nyx-text-muted animate-bounce [animation-delay:300ms]" />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="pt-3 shrink-0">
              <div className="rounded-2xl border border-nyx-border bg-nyx-surface shadow-sm">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage();
                    }
                  }}
                  disabled={isAILoading || isProcessing}
                  placeholder="Como posso ajudar com o roteiro?"
                  rows={1}
                  className="w-full resize-none bg-transparent px-4 pt-3.5 pb-2 text-sm text-nyx-text-primary placeholder:text-nyx-text-muted focus:outline-none disabled:opacity-50 min-h-[48px] max-h-[120px]"
                  style={{ overflowY: "auto" }}
                />
                <div className="flex items-center justify-between px-3 pb-2.5">
                  {/* Model selector */}
                  <div className="relative" ref={modelDropdownRef}>
                    <button
                      onClick={() => setModelDropdownOpen((o) => !o)}
                      className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-nyx-text-muted hover:bg-nyx-elevated hover:text-nyx-text-secondary transition-colors"
                    >
                      {AI_MODELS.find((m) => m.id === selectedModel)?.label ?? selectedModel}
                      <ChevronDown className={cn("h-3 w-3 transition-transform", modelDropdownOpen && "rotate-180")} />
                    </button>

                    {modelDropdownOpen && (
                      <div className="absolute bottom-full left-0 mb-2 w-52 rounded-xl border border-nyx-border bg-nyx-elevated shadow-xl overflow-hidden z-50">
                        {AI_MODELS.map((m) => (
                          <button
                            key={m.id}
                            onClick={() => { setSelectedModel(m.id); setModelDropdownOpen(false); }}
                            className={cn(
                              "flex w-full items-center justify-between px-3.5 py-2.5 text-left text-sm transition-colors hover:bg-nyx-hover",
                              selectedModel === m.id ? "text-nyx-text-primary" : "text-nyx-text-muted",
                            )}
                          >
                            <span>{m.label}</span>
                            {selectedModel === m.id && (
                              <span className="h-1.5 w-1.5 rounded-full bg-nyx-cyan-400" />
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Send */}
                  <button
                    onClick={sendMessage}
                    disabled={!input.trim() || isAILoading || isProcessing}
                    className={cn(
                      "flex h-7 w-7 items-center justify-center rounded-lg transition-all",
                      input.trim() && !isAILoading
                        ? "bg-nyx-text-primary text-nyx-void hover:opacity-90"
                        : "bg-nyx-surface text-nyx-text-muted cursor-not-allowed",
                    )}
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Script */}
          <div className="flex w-[380px] shrink-0 flex-col gap-3">
            <div className="flex items-center justify-between">
              <label className="text-sm text-nyx-text-secondary">Roteiro</label>
              <span className="font-mono text-xs text-nyx-text-muted">
                {script.split(/\s+/).filter(Boolean).length} palavras
              </span>
            </div>
            <textarea
              value={script}
              onChange={(e) => setScript(e.target.value)}
              placeholder="O roteiro gerado pela IA aparecerá aqui. Você também pode escrever diretamente."
              disabled={isProcessing}
              className="flex-1 resize-none bg-nyx-surface border border-nyx-border rounded-lg px-4 py-3 text-sm text-nyx-text-primary placeholder:text-nyx-text-muted focus:outline-none focus:border-nyx-cyan-500 disabled:opacity-50"
            />
            <Button
              disabled={!canSubmit || isProcessing || startAudio.isPending}
              onClick={handleSubmit}
              className="w-full"
            >
              {(isProcessing || startAudio.isPending) && (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              )}
              {isProcessing ? "Gerando áudio..." : "Gerar áudio"}
            </Button>
          </div>
        </div>
      )}

      {/* Audio tab */}
      {tab === "audio" && (
        <div className="space-y-3 max-w-lg">
          <label className="text-sm text-nyx-text-secondary">Selecionar áudio da biblioteca</label>
          {audioAssets.isLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="w-4 h-4 animate-spin text-nyx-text-muted" />
            </div>
          ) : audioAssets.data?.data.length === 0 ? (
            <p className="text-sm text-nyx-text-muted py-4">
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
                      : "border-nyx-border bg-nyx-surface hover:border-nyx-hover",
                  )}
                >
                  <FileAudio className="w-4 h-4 text-nyx-text-muted shrink-0" />
                  <span className="text-sm truncate text-nyx-text-primary">{asset.name}</span>
                </button>
              ))}
            </div>
          )}
          <div className="flex justify-end pt-2">
            <Button
              disabled={!canSubmit || isProcessing || startAudio.isPending}
              onClick={handleSubmit}
            >
              {startAudio.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Usar áudio
            </Button>
          </div>
        </div>
      )}

      {/* Processing */}
      {isProcessing && (
        <div className="flex items-center gap-3 px-4 py-3 bg-nyx-cyan-500/10 border border-nyx-cyan-500/20 rounded-lg">
          <Loader2 className="w-4 h-4 animate-spin text-nyx-cyan-400 shrink-0" />
          <div>
            <p className="text-sm font-medium text-nyx-cyan-400">Gerando áudio...</p>
            <p className="text-xs text-nyx-text-muted mt-0.5">
              Aguarde. Você avançará automaticamente quando o áudio estiver pronto.
            </p>
          </div>
        </div>
      )}

      {/* Error */}
      {startAudio.isError && (
        <div className="flex items-center gap-2 px-3 py-2.5 bg-red-500/10 border border-red-500/20 rounded-lg">
          <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
          <p className="text-sm text-red-500">Erro ao iniciar geração de áudio. Tente novamente.</p>
        </div>
      )}
    </div>
  );
}
