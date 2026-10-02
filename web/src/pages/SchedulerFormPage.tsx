import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { motion } from "motion/react";
import { ArrowLeft, Loader2, AlertTriangle, Sparkles, ChevronDown } from "lucide-react";
import { Button } from "../components/ui/Button";
import { AssetPicker } from "../components/schedulers/AssetPicker";
import { CadencePicker } from "../components/schedulers/CadencePicker";
import { CtaInput } from "../components/schedulers/CtaInput";
import { useTemplates, useTemplate } from "../hooks/useTemplates";
import { useAiModels } from "../hooks/useAiModels";
import {
  useCreateScheduler,
  useUpdateScheduler,
  useScheduler,
  useSchedulerEstimate,
  usePreviewSeriesScript,
} from "../hooks/useSchedulers";
import { useCreditsBalance } from "../hooks/useCredits";
import { cadenceToCron, cronToCadence, type CadenceValue } from "../lib/scheduler";
import type { NarrationSourceConfig, SchedulerNarration, SeriesScript } from "../lib/types";
import { VoiceFields } from "../components/VoiceFields";

const inputCls =
  "h-9 w-full rounded-lg border border-nyx-border bg-nyx-void px-2.5 text-sm text-nyx-text-primary placeholder:text-nyx-text-muted focus:border-nyx-cyan-500 focus:outline-none";

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-nyx-text-secondary">{label}</label>
      {children}
      {hint && <p className="text-xs text-nyx-text-muted">{hint}</p>}
    </div>
  );
}

export function SchedulerFormPage() {
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;
  const navigate = useNavigate();

  const existing = useScheduler(id ?? "");
  const create = useCreateScheduler();
  const update = useUpdateScheduler(id ?? "");
  const balance = useCreditsBalance();
  const models = useAiModels();
  const templates = useTemplates(0);
  const preview = usePreviewSeriesScript();

  const [name, setName] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [theme, setTheme] = useState("");
  const [assetIds, setAssetIds] = useState<string[]>([]);
  const [musicAssetIds, setMusicAssetIds] = useState<string[]>([]);
  const [noRepeatAssetsAcrossParts, setNoRepeatAssetsAcrossParts] = useState(false);
  const [randomizeAssetOrder, setRandomizeAssetOrder] = useState(true);
  const [backgroundSpeed, setBackgroundSpeed] = useState(1);
  const [narration, setNarration] = useState<SchedulerNarration | null>(null);
  const [mode, setMode] = useState<"single" | "parts">("parts");
  const [totalMinutes, setTotalMinutes] = useState(3);
  const [partsCount, setPartsCount] = useState(4);
  const [minutesPerPart, setMinutesPerPart] = useState(1);
  const [ctaTemplate, setCtaTemplate] = useState("Curta e comente para a parte {next}.");
  const [finalCtaTemplate, setFinalCtaTemplate] = useState("");
  const [finalPartEnabled, setFinalPartEnabled] = useState(false);
  const [finalPartLabel, setFinalPartLabel] = useState("");
  const [aiModel, setAiModel] = useState("");
  const [cadence, setCadence] = useState<CadenceValue>({ kind: "manual" });
  const [runOnCreate, setRunOnCreate] = useState(!isEdit);
  const [error, setError] = useState("");
  const [previewResult, setPreviewResult] = useState<SeriesScript | null>(null);

  const selectedTemplate = useTemplate(templateId);

  // Carrega os dados do scheduler existente (edição).
  useEffect(() => {
    if (!existing.data) return;
    const s = existing.data;
    setName(s.name);
    setTemplateId(s.templateId);
    setTheme(s.theme);
    setAssetIds(s.assetIds);
    setMusicAssetIds(s.musicAssetIds);
    setNoRepeatAssetsAcrossParts(s.noRepeatAssetsAcrossParts);
    setRandomizeAssetOrder(s.randomizeAssetOrder);
    setBackgroundSpeed(s.backgroundSpeed);
    setNarration(s.narration ?? null);
    setMode(s.mode);
    if (s.totalMinutes != null) setTotalMinutes(s.totalMinutes);
    if (s.partsCount != null) setPartsCount(s.partsCount);
    if (s.minutesPerPart != null) setMinutesPerPart(s.minutesPerPart);
    setCtaTemplate(s.ctaTemplate);
    setFinalCtaTemplate(s.finalCtaTemplate ?? "");
    setFinalPartEnabled(s.finalPartEnabled);
    setFinalPartLabel(s.finalPartLabel === "Parte final." ? "" : s.finalPartLabel); // vazio = padrão
    setAiModel(s.aiModel);
    setCadence(cronToCadence(s.cronPattern));
  }, [existing.data]);

  // Assim que a lista de modelos chega, escolhe o primeiro se nada foi setado ainda.
  useEffect(() => {
    if (!aiModel && models.data && models.data.length > 0) setAiModel(models.data[0]!.id);
  }, [models.data]); // eslint-disable-line react-hooks/exhaustive-deps

  const hasSceneSource = !!selectedTemplate.data?.graph.nodes.some((n) => n.type === "SceneSource");
  const narrationNode = selectedTemplate.data?.graph.nodes.find((n) => n.type === "NarrationSource");
  const narrationCfg = narrationNode?.config as NarrationSourceConfig | undefined;

  const estimate = useSchedulerEstimate(
    mode === "single" ? { mode, totalMinutes } : { mode, partsCount, minutesPerPart },
  );

  const canSubmit =
    name.trim().length > 0 &&
    !!templateId &&
    !hasSceneSource &&
    theme.trim().length >= 10 &&
    !!aiModel &&
    !create.isPending &&
    !update.isPending;

  async function handleSubmit() {
    setError("");
    const payload = {
      name: name.trim(),
      templateId,
      theme: theme.trim(),
      assetIds,
      musicAssetIds,
      noRepeatAssetsAcrossParts,
      randomizeAssetOrder,
      backgroundSpeed,
      narration,
      mode,
      ...(mode === "single" ? { totalMinutes } : { partsCount, minutesPerPart }),
      ctaTemplate,
      finalCtaTemplate: finalCtaTemplate.trim() || undefined,
      finalPartEnabled,
      finalPartLabel: finalPartLabel.trim(),
      aiModel,
      cronPattern: cadenceToCron(cadence),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      ...(isEdit ? {} : { runOnCreate }),
    };

    try {
      if (isEdit) {
        await update.mutateAsync(payload);
      } else {
        await create.mutateAsync(payload);
      }
      navigate("/schedulers");
    } catch (err) {
      const body = (err as { body?: { error?: string } })?.body;
      setError(body?.error ?? "Erro ao salvar scheduler");
    }
  }

  async function handlePreview() {
    setPreviewResult(null);
    const parts = mode === "single" ? 1 : partsCount;
    const perPart = mode === "single" ? totalMinutes : minutesPerPart;
    try {
      const result = await preview.mutateAsync({
        model: aiModel,
        theme: theme.trim(),
        parts,
        minutesPerPart: perPart,
        ctaTemplate,
        finalCtaTemplate: finalCtaTemplate.trim() || undefined,
        finalPartEnabled,
        finalPartLabel: finalPartLabel.trim() || undefined,
      });
      setPreviewResult(result);
    } catch (err) {
      const body = (err as { body?: { error?: string } })?.body;
      setError(body?.error ?? "Erro ao gerar prévia do roteiro");
    }
  }

  if (isEdit && existing.isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-nyx-void">
        <Loader2 className="h-5 w-5 animate-spin text-nyx-text-muted" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-nyx-void pb-32 text-nyx-text-primary">
      <div className="mx-auto max-w-2xl px-6 py-8">
        <Link to="/schedulers" className="mb-6 inline-flex items-center gap-2 text-xs text-nyx-text-muted hover:text-nyx-text-primary">
          <ArrowLeft className="h-4 w-4" />
          Schedulers
        </Link>

        <h1 className="mb-6 font-display text-xl font-bold">{isEdit ? "Editar scheduler" : "Novo scheduler"}</h1>

        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          <Field label="Nome">
            <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} placeholder="Ex.: Histórias de trabalho" />
          </Field>

          <Field label="Template">
            <select value={templateId} onChange={(e) => setTemplateId(e.target.value)} className={inputCls}>
              <option value="">Selecione um template</option>
              {templates.data?.data.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
            {narrationCfg && !hasSceneSource && (
              <p className="text-xs text-nyx-text-muted">
                Narração do template: {narrationCfg.provider === "edge" ? "Edge TTS" : narrationCfg.provider === "gemini" ? "Gemini TTS" : "Talkify"}
                {narrationCfg.voice ? ` · ${narrationCfg.voice}` : ""}
                {narrationCfg.speed ? ` · ${Math.round((narrationCfg.speed - 1) * 100)}%` : ""}
              </p>
            )}
            {hasSceneSource && (
              <p className="flex items-center gap-1.5 text-xs text-red-400">
                <AlertTriangle className="h-3.5 w-3.5" />
                Este template usa slots de cena; o scheduler só funciona com templates de fundo fixo.
              </p>
            )}
          </Field>

          <Field label="Voz" hint="Por padrão usa a voz do nó Narração do template. Escolher aqui troca só neste scheduler.">
            <select
              value={narration?.provider ?? ""}
              onChange={(e) => setNarration(e.target.value ? { provider: e.target.value as "edge" | "gemini" } : null)}
              className={inputCls}
            >
              <option value="">Usar a do template</option>
              <option value="edge">Edge TTS (gratuito)</option>
              <option value="gemini">Gemini TTS</option>
            </select>
            {narration && (
              <div className="mt-2 rounded-lg border border-nyx-border p-3">
                <VoiceFields
                  provider={narration.provider}
                  value={narration}
                  onChange={(patch) => setNarration((n) => (n ? { ...n, ...patch } : n))}
                  inputCls={inputCls}
                />
              </div>
            )}
          </Field>

          <Field label="Tema" hint={`${theme.trim().length}/5000 caracteres (mínimo 10) · {a|b|c} sorteia uma opção a cada execução`}>
            <textarea
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
              rows={3}
              placeholder="Ex.: histórias de traição no trabalho, contadas em primeira pessoa, com final surpreendente"
              className="w-full resize-none rounded-lg border border-nyx-border bg-nyx-void px-2.5 py-2 text-sm text-nyx-text-primary placeholder:text-nyx-text-muted focus:border-nyx-cyan-500 focus:outline-none"
            />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Vídeos de fundo" hint="Vazio = usa os do template">
              <AssetPicker type="video" selectedIds={assetIds} onChange={setAssetIds} />
              <div className="space-y-1.5 pt-1">
                <label className="flex items-center gap-2 text-xs text-nyx-text-secondary">
                  <input
                    type="checkbox"
                    checked={randomizeAssetOrder}
                    onChange={(e) => setRandomizeAssetOrder(e.target.checked)}
                  />
                  Ordem aleatória
                </label>
                <p className="pl-5 text-[11px] text-nyx-text-muted">
                  Desmarcado = ordem alfabética pelo nome do vídeo.
                </p>
                <label className="flex items-center gap-2 text-xs text-nyx-text-secondary">
                  <input
                    type="checkbox"
                    checked={noRepeatAssetsAcrossParts}
                    onChange={(e) => setNoRepeatAssetsAcrossParts(e.target.checked)}
                  />
                  Não repetir vídeo no mesmo lote
                </label>
                <p className="pl-5 text-[11px] text-nyx-text-muted">
                  Cada parte começa num vídeo diferente e só repete um vídeo depois de usar todos.
                </p>
                <label className="flex items-center justify-between text-xs text-nyx-text-secondary">
                  <span>Velocidade do vídeo de fundo</span>
                  <span className="font-medium text-nyx-text-primary">{backgroundSpeed.toFixed(2)}x</span>
                </label>
                <input
                  type="range"
                  min={0.5}
                  max={2.5}
                  step={0.05}
                  value={backgroundSpeed}
                  onChange={(e) => setBackgroundSpeed(Number(e.target.value))}
                  className="w-full accent-nyx-cyan-500"
                />
                <p className="text-[11px] text-nyx-text-muted">1x = normal. Só afeta o vídeo, a narração continua no ritmo normal.</p>
              </div>
            </Field>
            <Field label="Trilha" hint="Vazio = usa a do template">
              <AssetPicker type="audio" selectedIds={musicAssetIds} onChange={setMusicAssetIds} />
            </Field>
          </div>

          <Field label="Formato">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setMode("single")}
                className={`h-9 flex-1 rounded-lg border text-sm font-medium ${mode === "single" ? "border-nyx-cyan-500 bg-nyx-cyan-500/10 text-nyx-cyan-400" : "border-nyx-border text-nyx-text-secondary"}`}
              >
                Vídeo único
              </button>
              <button
                type="button"
                onClick={() => setMode("parts")}
                className={`h-9 flex-1 rounded-lg border text-sm font-medium ${mode === "parts" ? "border-nyx-cyan-500 bg-nyx-cyan-500/10 text-nyx-cyan-400" : "border-nyx-border text-nyx-text-secondary"}`}
              >
                Em partes
              </button>
            </div>

            {mode === "single" ? (
              <div className="mt-2.5">
                <label className="text-xs text-nyx-text-muted">Minutos (0,5–10)</label>
                <input
                  type="number" min={0.5} max={10} step={0.5}
                  value={totalMinutes}
                  onChange={(e) => setTotalMinutes(Number(e.target.value))}
                  className={inputCls}
                />
              </div>
            ) : (
              <div className="mt-2.5 grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-nyx-text-muted">Quantidade (2–10)</label>
                  <input
                    type="number" min={2} max={10}
                    value={partsCount}
                    onChange={(e) => setPartsCount(Number(e.target.value))}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="text-xs text-nyx-text-muted">Minutos por parte (0,5–10)</label>
                  <input
                    type="number" min={0.5} max={10} step={0.5}
                    value={minutesPerPart}
                    onChange={(e) => setMinutesPerPart(Number(e.target.value))}
                    className={inputCls}
                  />
                </div>
              </div>
            )}
            {((mode === "single" && totalMinutes > 3) || (mode === "parts" && minutesPerPart > 3)) && (
              <p className="mt-1.5 text-xs text-yellow-500">Shorts têm limite de 3 min.</p>
            )}
          </Field>

          {mode === "parts" && (
            <>
              <CtaInput label="CTA das partes intermediárias" value={ctaTemplate} onChange={setCtaTemplate} placeholder="Curta e comente para a parte {next}." />
              <label className="flex items-center gap-2 text-xs text-nyx-text-secondary">
                <input
                  type="checkbox"
                  checked={finalPartEnabled}
                  onChange={(e) => setFinalPartEnabled(e.target.checked)}
                />
                Última parte fala uma frase própria (padrão "Parte final.")
              </label>
              <p className="pl-5 text-[11px] text-nyx-text-muted">
                Desmarcado = a última parte fala "Parte {"{N}"}." igual as demais.
              </p>
              {finalPartEnabled && (
                <CtaInput
                  label="O que a última parte fala"
                  value={finalPartLabel}
                  onChange={setFinalPartLabel}
                  placeholder="Parte final."
                />
              )}
            </>
          )}
          <CtaInput label="CTA da última parte (opcional)" value={finalCtaTemplate} onChange={setFinalCtaTemplate} placeholder="Deixa nos comentários o que achou." />

          <Field label="IA">
            {models.isError ? (
              <p className="text-xs text-red-400">
                Configure sua chave do Gemini em <Link to="/settings" className="underline">Configurações → Integrações</Link>.
              </p>
            ) : (
              <select value={aiModel} onChange={(e) => setAiModel(e.target.value)} className={inputCls}>
                {(models.data ?? []).map((m) => (
                  <option key={m.id} value={m.id}>{m.label}</option>
                ))}
              </select>
            )}
            <Button variant="secondary" size="sm" onClick={handlePreview} disabled={preview.isPending || !aiModel || theme.trim().length < 10}>
              {preview.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              Testar roteiro
            </Button>
          </Field>

          {previewResult && (
            <div className="space-y-2 rounded-xl border border-nyx-border bg-nyx-surface p-4">
              <p className="text-sm font-medium text-nyx-text-primary">{previewResult.title}</p>
              {previewResult.parts.map((p) => (
                <details key={p.index} className="rounded-lg border border-nyx-border/60 bg-nyx-void/50 p-2.5">
                  <summary className="flex cursor-pointer items-center justify-between text-xs text-nyx-text-secondary">
                    <span>Parte {p.index} · {p.actualWords} palavras{p.outOfBudget ? " (fora do alvo)" : ""}</span>
                    <ChevronDown className="h-3.5 w-3.5" />
                  </summary>
                  <p className="mt-2 text-xs text-nyx-text-muted">{p.text}</p>
                </details>
              ))}
            </div>
          )}

          <Field label="Agendamento">
            <CadencePicker value={cadence} onChange={setCadence} />
          </Field>

          {!isEdit && (
            <label className="flex items-center gap-2 text-sm text-nyx-text-secondary">
              <input type="checkbox" checked={runOnCreate} onChange={(e) => setRunOnCreate(e.target.checked)} />
              Rodar agora ao salvar
            </label>
          )}

          {error && <p className="text-sm text-red-400">{error}</p>}
        </motion.div>
      </div>

      {/* Rodapé fixo */}
      <div className="fixed inset-x-0 bottom-0 border-t border-nyx-border bg-nyx-deep/95 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-6 py-4">
          <div className="text-xs text-nyx-text-muted">
            {estimate.data && (
              <>
                {estimate.data.partsTotal} parte{estimate.data.partsTotal > 1 ? "s" : ""} · ~{estimate.data.wordsPerPart} palavras cada · ~{estimate.data.creditsTotal} créditos por execução
                {balance.data && <> · saldo atual {balance.data.balance}</>}
              </>
            )}
          </div>
          <Button variant="primary" size="md" onClick={handleSubmit} disabled={!canSubmit}>
            {(create.isPending || update.isPending) && <Loader2 className="h-4 w-4 animate-spin" />}
            {isEdit ? "Salvar" : "Criar scheduler"}
          </Button>
        </div>
      </div>
    </div>
  );
}
