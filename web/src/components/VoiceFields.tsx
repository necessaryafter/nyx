import type { VoiceConfig } from "../lib/types";
import {
  DEFAULT_GEMINI_TTS_MODEL,
  DEFAULT_GEMINI_VOICE,
  EDGE_VOICES,
  GEMINI_TTS_MODELS,
  GEMINI_VOICES,
  STYLE_PRESETS,
  formatSpeedPct,
} from "../lib/voices";

interface Props {
  provider: "edge" | "gemini";
  value: VoiceConfig;
  onChange: (patch: Partial<VoiceConfig>) => void;
  inputCls: string; // cada tela tem seu tamanho de campo
}

const labelCls = "text-xs font-medium text-nyx-text-secondary";

function Options({ list, current }: { list: { value: string; label: string }[]; current?: string }) {
  // Valor salvo fora da lista (voz digitada antes de existir o select) continua aparecendo.
  const all = current && !list.some((o) => o.value === current) ? [{ value: current, label: current }, ...list] : list;
  return <>{all.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</>;
}

function SpeedSlider({ value, onChange }: Pick<Props, "value" | "onChange">) {
  return (
    <div className="space-y-1">
      <label className={labelCls}>Velocidade: {formatSpeedPct(value.speed)}</label>
      <input type="range" min={0.5} max={2} step={0.01} value={value.speed ?? 1} onChange={(e) => onChange({ speed: Number(e.target.value) })} className="w-full accent-nyx-cyan-500" />
    </div>
  );
}

/** Campos de voz do Edge e do Gemini — usados no nó Narração e na voz do scheduler. */
export function VoiceFields({ provider, value, onChange, inputCls }: Props) {
  if (provider === "edge") {
    return (
      <div className="space-y-3">
        <div className="space-y-1">
          <label className={labelCls}>Voz</label>
          <select value={value.voice ?? EDGE_VOICES[0]!.value} onChange={(e) => onChange({ voice: e.target.value })} className={inputCls}>
            <Options list={EDGE_VOICES} current={value.voice} />
          </select>
        </div>
        <SpeedSlider value={value} onChange={onChange} />
      </div>
    );
  }

  const paceMode = value.paceMode ?? "style";
  const custom = value.stylePreset === "custom";
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <label className={labelCls}>Modelo</label>
        <select value={value.model ?? DEFAULT_GEMINI_TTS_MODEL} onChange={(e) => onChange({ model: e.target.value })} className={inputCls}>
          <Options list={GEMINI_TTS_MODELS} current={value.model} />
        </select>
      </div>
      <div className="space-y-1">
        <label className={labelCls}>Voz</label>
        <select value={value.voice ?? DEFAULT_GEMINI_VOICE} onChange={(e) => onChange({ voice: e.target.value })} className={inputCls}>
          <Options list={GEMINI_VOICES} current={value.voice} />
        </select>
      </div>
      <div className="space-y-1">
        <label className={labelCls}>Velocidade controlada por</label>
        <div className="flex gap-4 text-xs text-nyx-text-primary">
          {(["style", "slider"] as const).map((m) => (
            <label key={m} className="flex items-center gap-1.5">
              <input type="radio" checked={paceMode === m} onChange={() => onChange({ paceMode: m })} className="accent-nyx-cyan-500" />
              {m === "style" ? "Estilo" : "Slider"}
            </label>
          ))}
        </div>
      </div>
      {paceMode === "slider" ? (
        <>
          <SpeedSlider value={value} onChange={onChange} />
          <p className="text-xs text-nyx-text-muted">O áudio é acelerado depois de gerado; ajustes grandes mudam o timbre da voz.</p>
        </>
      ) : (
        <div className="space-y-2">
          <label className="flex items-center gap-1.5 text-xs text-nyx-text-primary">
            <input type="checkbox" checked={custom} onChange={(e) => onChange({ stylePreset: e.target.checked ? "custom" : "moderado" })} className="accent-nyx-cyan-500" />
            Personalizar estilo
          </label>
          {custom ? (
            <textarea
              value={value.style ?? ""}
              onChange={(e) => onChange({ style: e.target.value })}
              placeholder="Ex.: narrador de terror, ritmo moderado, voz grave, leve tensão, sem pausas longas"
              className="h-24 w-full resize-none rounded-lg border border-nyx-border bg-nyx-void p-2.5 text-xs text-nyx-text-primary focus:border-nyx-cyan-500 focus:outline-none"
            />
          ) : (
            <select value={value.stylePreset ?? "moderado"} onChange={(e) => onChange({ stylePreset: e.target.value as VoiceConfig["stylePreset"] })} className={inputCls}>
              <Options list={[...STYLE_PRESETS]} />
            </select>
          )}
        </div>
      )}
    </div>
  );
}
