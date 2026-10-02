import { mkdtemp, readFile, rm, writeFile } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { logger } from "@nyx/shared";
import type { TTSConfig } from "../../graph";
import { BaseTTSProvider, type TTSResult } from "../base.provider";
import { splitTextIntoChunks } from "./edge.provider";
import { transcribeWords } from "./custom.provider";
import { run, ffmpegStderr } from "../../ffmpeg/runner";

// fetch direto na API Interactions: o @google/genai instalado (1.x) não suporta o estilo
// (speech_metadata) do TTS 3.8, e atualizar o SDK mexeria na geração de roteiro.
const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/interactions";
export const DEFAULT_GEMINI_TTS_MODEL = "gemini-3.8-flash-lite-tts";
export const DEFAULT_GEMINI_VOICE = "Algenib";

// 3 min de texto (~2.400 chars) passou num pedido só; margem pra não arriscar corte.
const MAX_CHUNK_CHARS = 3_000;

const BASE = "Narrador de vídeo storytime de Reddit para TikTok e Shorts, em português do Brasil, lendo um relato em primeira pessoa, em tom de conversa natural e direto, como alguém contando a história para um amigo. Entonação contida e estável, sem dramatizar. Emende as frases com pausas bem curtas; nunca faça pausas longas ou silêncios entre as frases.";
export const STYLE_PRESETS = {
  rapido: `${BASE} Fala RÁPIDA e contínua, ritmo acelerado do começo ao fim. Nunca lento, cansado ou arrastado.`,
  moderado: `${BASE} Ritmo moderado e constante do começo ao fim, nem lento nem acelerado. Nunca cansado ou arrastado.`,
  lento: `${BASE} Ritmo calmo e cadenciado, voz um pouco mais grave, com tensão crescente, sem soar cansado ou sonolento.`,
} as const;

/** Estilo efetivo: nenhum no modo slider; senão o preset, ou o texto livre em "custom". */
export function resolveStyle(config: TTSConfig): string | undefined {
  if (config.paceMode === "slider") return undefined;
  if (config.stylePreset === "custom") return config.style?.trim() || undefined;
  return STYLE_PRESETS[config.stylePreset === "rapido" || config.stylePreset === "lento" ? config.stylePreset : "moderado"];
}

// O Gemini atropela a última frase (CTA "Curta e comente...": ~6,7 palavras/s contra ~3 no
// resto). A última frase vai como trecho próprio, com estilo moderado.
const OUTRO_STYLE = "Fale esta frase final em ritmo moderado e claro, sem pressa, no mesmo tom de conversa.";

/** [corpo, última frase] — ou só [texto] se tiver uma frase só. */
export function splitLastSentence(text: string): string[] {
  const m = text.trim().match(/^([\s\S]*[.!?…]["”'»)]*)\s+([^\s][\s\S]*)$/);
  return m && /[.!?…]/.test(m[1]!) ? [m[1]!, m[2]!] : [text.trim()];
}

export function buildGeminiRequest(text: string, config: TTSConfig, opts: { slowOutro?: boolean } = {}) {
  const style = resolveStyle(config);
  const item = (t: string, st?: string) => ({ type: "text", text: t, ...(st && { annotations: [{ type: "speech_metadata", style: st }] }) });
  // Só no modo estilo e fora do preset lento (lá o fim já sai devagar).
  const parts = opts.slowOutro && style && config.stylePreset !== "lento" ? splitLastSentence(text) : [text];
  const content = parts.length === 2 ? [item(parts[0]!, style), item(` ${parts[1]}`, OUTRO_STYLE)] : [item(text, style)];
  return {
    model: config.model || DEFAULT_GEMINI_TTS_MODEL,
    input: [{ type: "user_input", content }],
    response_format: { type: "audio" },
    generation_config: { speech_config: [{ voice: config.voice || DEFAULT_GEMINI_VOICE }] },
  };
}

/** Áudio (base64) dentro de steps[].content[] da resposta. */
export function extractGeminiAudio(json: unknown): Buffer {
  const steps = (json as { steps?: Array<{ content?: Array<{ type?: string; data?: string }> }> }).steps ?? [];
  const audio = steps.flatMap((s) => s.content ?? []).find((c) => c.type === "audio" && c.data);
  if (!audio) throw new Error("Gemini TTS: resposta sem áudio");
  return Buffer.from(audio.data!, "base64");
}

// Pausa máxima depois do corte, com margem dos dois lados: corta só o miolo do silêncio.
// Sem a margem ANTES da palavra seguinte (silenceremove cortava até encostar nela), o
// respiro e o começo suave da palavra iam junto e a volta da fala soava cortada.
const KEEP_AFTER_WORD = 0.12;
const KEEP_BEFORE_WORD = 0.23;
const MAX_PAUSE = KEEP_AFTER_WORD + KEEP_BEFORE_WORD;

/** Trechos a remover: o miolo de cada pausa maior que MAX_PAUSE (saída do silencedetect). */
export function pauseCuts(silencedetectStderr: string): Array<[number, number]> {
  const starts = [...silencedetectStderr.matchAll(/silence_start: ([0-9.]+)/g)].map((m) => Number(m[1]));
  const ends = [...silencedetectStderr.matchAll(/silence_end: ([0-9.]+)/g)].map((m) => Number(m[1]));
  return starts.flatMap((s, i) => {
    const e = ends[i];
    // Silêncio sem fim = fim do arquivo; deixa como está (o render corta pelo -shortest).
    if (e === undefined || e - s <= MAX_PAUSE) return [];
    return [[s + KEEP_AFTER_WORD, e - KEEP_BEFORE_WORD] as [number, number]];
  });
}

/** Filtro final: remove os miolos das pausas e, no modo slider, ajusta a velocidade. */
export function finishFilter(cuts: Array<[number, number]>, config: TTSConfig): string {
  const parts: string[] = [];
  if (cuts.length) {
    const drop = cuts.map(([a, b]) => `between(t,${a.toFixed(3)},${b.toFixed(3)})`).join("+");
    parts.push(`aselect='not(${drop})'`, "asetpts=N/SR/TB");
  }
  if (config.paceMode === "slider" && config.speed && config.speed !== 1) parts.push(`atempo=${config.speed}`);
  return parts.join(",") || "anull";
}

export class GeminiTTSProvider extends BaseTTSProvider {
  readonly name = "gemini";

  constructor(private readonly apiKey: string) {
    super();
  }

  protected async doSynthesize(text: string | undefined, config: TTSConfig): Promise<TTSResult> {
    if (!text) throw new Error("GeminiTTSProvider: text is required");

    const chunks = splitTextIntoChunks(text, MAX_CHUNK_CHARS);
    logger.info({ model: config.model, voice: config.voice, paceMode: config.paceMode, chunks: chunks.length }, "GeminiTTS: synthesizing");

    const workDir = await mkdtemp(join(tmpdir(), "gemini-tts-"));
    try {
      const files: string[] = [];
      for (const [i, chunk] of chunks.entries()) {
        const file = join(workDir, `chunk-${i}.wav`);
        await writeFile(file, await this.request(chunk, config, i === chunks.length - 1));
        files.push(file);
      }

      const joined = join(workDir, "joined.wav");
      await run([
        "-y", ...files.flatMap((f) => ["-i", f]),
        "-filter_complex", `${files.map((_, i) => `[${i}:a]`).join("")}concat=n=${files.length}:v=0:a=1`,
        "-c:a", "pcm_s16le", joined,
      ]);
      const silences = await ffmpegStderr(["-i", joined, "-af", `silencedetect=n=-50dB:d=${MAX_PAUSE}`, "-f", "null", "-"]);

      const out = join(workDir, "out.wav");
      await run(["-y", "-i", joined, "-af", finishFilter(pauseCuts(silences), config), "-c:a", "pcm_s16le", out]);

      const audio = await readFile(out);
      // Gemini não devolve tempo das palavras — whisperx (já usado no "custom") resolve.
      const wordTimestamps = await transcribeWords(audio);
      return { audio, wordTimestamps };
    } finally {
      await rm(workDir, { recursive: true, force: true });
    }
  }

  private async request(text: string, config: TTSConfig, slowOutro = false): Promise<Buffer> {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": this.apiKey },
      body: JSON.stringify(buildGeminiRequest(text, config, { slowOutro })),
    });
    if (res.ok) return extractGeminiAudio(await res.json());
    // ponytail: o formato com 2 trechos (CTA moderado) ainda não foi validado na API; se
    // recusar (400), refaz no formato de 1 trecho já testado em vez de falhar o job.
    if (res.status === 400 && slowOutro) {
      logger.warn({ detail: (await res.text().catch(() => "")).slice(0, 200) }, "GeminiTTS: API recusou CTA separado, refazendo sem");
      return this.request(text, config, false);
    }

    const detail = (await res.text().catch(() => "")).slice(0, 300);
    const model = config.model || DEFAULT_GEMINI_TTS_MODEL;
    // Texto pensado pro usuário (aparece na execução do scheduler); o JSON do Google vai só pro log.
    // O scheduler.worker reconhece "Cota ... esgotada" pra não tentar as partes seguintes.
    if (res.status === 429) {
      logger.warn({ model, detail }, "GeminiTTS: cota esgotada");
      throw new Error(`Cota diária grátis do Gemini TTS esgotada (${model}, limite de 10 pedidos/dia). Volta por volta das 4h (horário de Brasília). Para gerar agora: troque a voz para Edge TTS, use o outro modelo do Gemini ou ative o plano pago da API.`);
    }
    if (res.status === 503) throw new Error(`Gemini TTS sobrecarregado (503). Tente de novo mais tarde. ${detail}`);
    throw new Error(`Gemini TTS erro ${res.status}: ${detail}`);
  }
}
