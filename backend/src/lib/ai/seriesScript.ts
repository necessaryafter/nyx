import { Type } from "@google/genai";
import { createGemini } from "./gemini";
import { BASE_SYSTEM_PROMPT, SERIES_RULES } from "./prompts";

export interface SeriesScriptInput {
  apiKey: string;
  model: string;
  theme: string;
  parts: number; // 1..10
  minutesPerPart: number; // 0.5..10
  ctaTemplate?: string;
  finalCtaTemplate?: string;
  avoidTitles?: string[];
  wordsPerMinute?: number;
}

export interface SeriesScriptPart {
  index: number; // 1-based
  text: string; // narração final (abertura + corpo + CTA)
  body: string; // corpo puro devolvido pela IA
  targetWords: number;
  actualWords: number;
  outOfBudget: boolean;
}

/** Identidade do post fake (Reddit-like) — gerada pela IA, junto com o roteiro, pra combinar com o tema. */
export interface SeriesScriptCard {
  subreddit: string;
  username: string;
  flair: string;
}

export interface SeriesScript {
  title: string;
  card: SeriesScriptCard;
  parts: SeriesScriptPart[];
  model: string;
}

const DEFAULT_CTA = "Curta e comente para a parte {next}.";
const DEFAULT_WPM = 150;
const BUDGET_TOLERANCE = 0.15;

/** Substitui os placeholders do CTA e garante pontuação final. */
export function applyCta(template: string, n: number, total: number): string {
  const filled = template
    .replaceAll("{next}", String(n + 1))
    .replaceAll("{total}", String(total))
    .replaceAll("{n}", String(n))
    .trim();
  return /[.!?]$/.test(filled) ? filled : `${filled}.`;
}

export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/** Palavras disponíveis pro corpo depois de descontar abertura + CTA. Nunca menos que 1. */
export function wordBudget(minutes: number, wpm: number, overheadWords: number): number {
  return Math.max(1, Math.round(minutes * wpm) - overheadWords);
}

/**
 * Monta o texto final de cada parte a partir dos corpos escritos pela IA.
 * A abertura e o CTA são responsabilidade do sistema, não da IA — o número
 * da parte tem que estar sempre certo, e a parte 1 vira o card de título.
 *
 * Regra (todas as partes 2..N, inclusive a última, repetem o título falado
 * junto com "Parte N."; só a última troca o CTA de "próxima parte" pelo CTA
 * final, que é opcional):
 *   parte 1:        "{title} {body} {cta(1)}"              (sem cta se for parte única)
 *   parte 2..N-1:   "{title} Parte {n}. {body} {cta(n)}"
 *   parte N (final):"{title} Parte {N}. {body} {finalCta?}" (parte 1 se N=1: "{title} {body} {finalCta?}")
 */
export function assembleParts(
  title: string,
  bodies: string[],
  opts: { ctaTemplate: string; finalCtaTemplate?: string; targetWords: number[] },
): SeriesScriptPart[] {
  const total = bodies.length;
  const cleanTitle = /[.!?]$/.test(title.trim()) ? title.trim() : `${title.trim()}.`;

  return bodies.map((rawBody, i) => {
    const n = i + 1;
    const isFirst = n === 1;
    const isLast = n === total;
    const body = rawBody.trim();

    const opener = isFirst ? cleanTitle : `${cleanTitle} Parte ${n}.`;
    const cta = isLast
      ? (opts.finalCtaTemplate ? applyCta(opts.finalCtaTemplate, n, total) : "")
      : total > 1
        ? applyCta(opts.ctaTemplate, n, total)
        : "";

    const text = [opener, body, cta].filter(Boolean).join(" ");
    const actualWords = countWords(text);
    const targetWords = opts.targetWords[i]!;

    return {
      index: n,
      text,
      body,
      targetWords,
      actualWords,
      outOfBudget: Math.abs(actualWords - targetWords) > targetWords * BUDGET_TOLERANCE,
    };
  });
}

interface RawSeries {
  title: string;
  card: SeriesScriptCard;
  parts: Array<{ text: string }>;
}

function parseSeriesJson(raw: string, expectedParts: number): RawSeries {
  const stripped = raw.trim().replace(/^```(?:json)?\n?/, "").replace(/```$/, "");
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripped);
  } catch {
    throw new Error("Gemini não devolveu um JSON válido para o roteiro da série");
  }
  const candidate = parsed as Partial<RawSeries> | null;
  if (!candidate || typeof candidate.title !== "string" || !Array.isArray(candidate.parts)) {
    throw new Error("Resposta da IA fora do formato esperado (title + parts)");
  }
  const card = candidate.card;
  if (!card || typeof card.subreddit !== "string" || typeof card.username !== "string" || typeof card.flair !== "string") {
    throw new Error("Resposta da IA fora do formato esperado (card.subreddit/username/flair)");
  }
  if (candidate.parts.length !== expectedParts) {
    throw new Error(`Esperava ${expectedParts} partes, a IA devolveu ${candidate.parts.length}`);
  }
  return candidate as RawSeries;
}

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING },
    card: {
      type: Type.OBJECT,
      properties: {
        subreddit: { type: Type.STRING },
        username: { type: Type.STRING },
        flair: { type: Type.STRING },
      },
      required: ["subreddit", "username", "flair"],
    },
    parts: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: { text: { type: Type.STRING } },
        required: ["text"],
      },
    },
  },
  required: ["title", "card", "parts"],
};

async function callGemini(
  input: SeriesScriptInput,
  targetWordsPerPart: number[],
  retryPart?: { index: number; words: number },
): Promise<RawSeries> {
  const ai = createGemini(input.apiKey);

  const budgetLines = targetWordsPerPart
    .map((w, i) => `- Parte ${i + 1}: ~${w} palavras`)
    .join("\n");

  const avoidBlock = input.avoidTitles?.length
    ? `\nNão repita estas histórias já usadas antes (título ou tema muito parecido): ${input.avoidTitles.join(" | ")}`
    : "";

  const retryBlock = retryPart
    ? `\nAjuste SÓ a parte ${retryPart.index} para ficar com aproximadamente ${retryPart.words} palavras, mantendo o mesmo conteúdo e o mesmo título; devolva o JSON completo de novo, com todas as partes.`
    : "";

  const systemInstruction = `${BASE_SYSTEM_PROMPT}\n\n${SERIES_RULES}\n\nORÇAMENTO DE PALAVRAS POR PARTE:\n${budgetLines}${avoidBlock}${retryBlock}`;

  const response = await ai.models.generateContent({
    model: input.model,
    config: {
      systemInstruction,
      temperature: 0.9,
      responseMimeType: "application/json",
      responseSchema: RESPONSE_SCHEMA,
    },
    contents: [{ role: "user", parts: [{ text: input.theme }] }],
  });

  return parseSeriesJson(response.text ?? "", input.parts);
}

export async function generateSeriesScript(input: SeriesScriptInput): Promise<SeriesScript> {
  const wpm = input.wordsPerMinute ?? DEFAULT_WPM;
  const ctaTemplate = input.ctaTemplate ?? DEFAULT_CTA;

  // Overhead estimado por parte: abertura (título sozinho, ou título + "Parte N.") + CTA, se houver.
  const targetWordsPerPart = Array.from({ length: input.parts }, (_, i) => {
    const n = i + 1;
    const isLast = n === input.parts;
    const opener = n === 1 ? 6 : 8; // título ~6 palavras (+ "Parte N." = 2 nas partes 2+)
    const ctaWords = isLast
      ? (input.finalCtaTemplate ? countWords(input.finalCtaTemplate) : 0)
      : input.parts > 1
        ? countWords(ctaTemplate)
        : 0;
    return wordBudget(input.minutesPerPart, wpm, opener + ctaWords);
  });

  let raw = await callGemini(input, targetWordsPerPart);
  let parts = assembleParts(
    raw.title,
    raw.parts.map((p) => p.text),
    { ctaTemplate, finalCtaTemplate: input.finalCtaTemplate, targetWords: targetWordsPerPart },
  );

  // Uma única retentativa, só para a primeira parte fora do orçamento.
  const offender = parts.find((p) => p.outOfBudget);
  if (offender) {
    raw = await callGemini(input, targetWordsPerPart, {
      index: offender.index,
      words: offender.targetWords,
    });
    parts = assembleParts(
      raw.title,
      raw.parts.map((p) => p.text),
      { ctaTemplate, finalCtaTemplate: input.finalCtaTemplate, targetWords: targetWordsPerPart },
    );
  }

  return { title: raw.title, card: raw.card, parts, model: input.model };
}
