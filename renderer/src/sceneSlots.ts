import type { WordTimestamp } from "./graph";

export interface SceneSlot {
  index: number;
  startMs: number;
  endMs: number;
  assetId: string | null;
  narrationText?: string;
}

export function calculateSceneSlots(
  timestamps: WordTimestamp[],
  pauseThresholdMs = 500,
): SceneSlot[] {
  if (timestamps.length === 0) return [];

  const slots: SceneSlot[] = [];
  let slotStart = timestamps[0]!.startMs;
  let lastEnd = timestamps[0]!.endMs;
  let slotWords: string[] = [timestamps[0]!.word];

  for (let i = 1; i < timestamps.length; i++) {
    const word = timestamps[i]!;
    const gap = word.startMs - lastEnd;

    if (gap >= pauseThresholdMs) {
      slots.push({
        index: slots.length,
        startMs: slotStart,
        endMs: lastEnd,
        assetId: null,
        narrationText: slotWords.join(" "),
      });
      slotStart = word.startMs;
      slotWords = [];
    }

    slotWords.push(word.word);
    lastEnd = word.endMs;
  }

  slots.push({
    index: slots.length,
    startMs: slotStart,
    endMs: lastEnd,
    assetId: null,
    narrationText: slotWords.join(" "),
  });

  return slots;
}

/**
 * Um slot por frase (como o edge-tts já entrega), a partir das palavras transcritas.
 * O alinhamento do whisperx no render só alinha a 1ª frase de cada slot — slot com várias
 * frases deixava o resto sem legenda. Quando o nº de frases bate com o roteiro, usa o
 * texto do roteiro (a transcrição troca "três e dezessete" por "3h17").
 */
export function sentenceSlots(words: WordTimestamp[], scriptText?: string): SceneSlot[] {
  const groups: WordTimestamp[][] = [];
  let current: WordTimestamp[] = [];
  for (const w of words) {
    current.push(w);
    if (/[.!?…]["”'»)]*$/.test(w.word)) {
      groups.push(current);
      current = [];
    }
  }
  if (current.length) groups.push(current);

  const sentences = scriptText?.split(/(?<=[.!?…]["”'»)]*)\s+/).map((s) => s.trim()).filter(Boolean) ?? [];
  const useScript = sentences.length === groups.length;

  return groups.map((g, i) => ({
    index: i,
    startMs: g[0]!.startMs,
    endMs: g.at(-1)!.endMs,
    assetId: null,
    narrationText: useScript ? sentences[i]! : g.map((w) => w.word).join(" "),
  }));
}
