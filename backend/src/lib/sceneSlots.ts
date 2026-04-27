import type { SceneSlot } from "./schemas";

interface WordTimestamp {
  word: string;
  startMs: number;
  endMs: number;
}

/**
 * Segmenta uma lista de word timestamps em SceneSlots usando pausas longas
 * entre palavras como delimitadores de cena.
 *
 * @param timestamps Lista ordenada de timestamps por palavra
 * @param pauseThresholdMs Pausa mínima (ms) para iniciar nova cena (default: 500ms)
 * @returns Array de SceneSlot com index, startMs, endMs e assetId null
 */
export function calculateSceneSlots(
  timestamps: WordTimestamp[],
  pauseThresholdMs = 500,
): SceneSlot[] {
  if (timestamps.length === 0) return [];

  const slots: SceneSlot[] = [];
  let slotStart = timestamps[0]!.startMs;
  let lastEnd = timestamps[0]!.endMs;

  for (let i = 1; i < timestamps.length; i++) {
    const word = timestamps[i]!;
    const gap = word.startMs - lastEnd;

    if (gap >= pauseThresholdMs) {
      // Encerra slot atual
      slots.push({
        index: slots.length,
        startMs: slotStart,
        endMs: lastEnd,
        assetId: null,
      });
      slotStart = word.startMs;
    }

    lastEnd = word.endMs;
  }

  // Último slot
  slots.push({
    index: slots.length,
    startMs: slotStart,
    endMs: lastEnd,
    assetId: null,
  });

  return slots;
}

/**
 * Segmenta timestamps em N slots de duração igual (fallback quando não há pausas).
 *
 * @param timestamps Lista de timestamps
 * @param n Número de slots desejados
 */
export function calculateEvenSceneSlots(
  timestamps: WordTimestamp[],
  n: number,
): SceneSlot[] {
  if (timestamps.length === 0 || n <= 0) return [];

  const totalStart = timestamps[0]!.startMs;
  const totalEnd = timestamps[timestamps.length - 1]!.endMs;
  const duration = totalEnd - totalStart;
  const slotDuration = duration / n;

  return Array.from({ length: n }, (_, i) => ({
    index: i,
    startMs: Math.round(totalStart + i * slotDuration),
    endMs: Math.round(totalStart + (i + 1) * slotDuration),
    assetId: null,
  }));
}

/**
 * Segmenta timestamps com base em parágrafos duplos no texto original.
 * Exige que o texto tenha sido dividido por `\n\n` antes do TTS,
 * e que os timestamps sejam concatenados com offsets corretos.
 *
 * Agrupa palavras por parágrafo usando o texto como guia:
 * conta palavras por segmento e split proporcionalmente nos timestamps.
 *
 * @param timestamps Lista de timestamps (já com offsets de concatenação)
 * @param paragraphs Array de textos de cada parágrafo/cena
 */
export function calculateSceneSlotsByParagraphs(
  timestamps: WordTimestamp[],
  paragraphs: string[],
): SceneSlot[] {
  if (timestamps.length === 0 || paragraphs.length === 0) return [];

  const wordCounts = paragraphs.map(
    (p) => p.trim().split(/\s+/).filter(Boolean).length,
  );
  const totalWords = wordCounts.reduce((a, b) => a + b, 0);

  if (totalWords === 0) return [];

  const slots: SceneSlot[] = [];
  let wordIndex = 0;

  for (let i = 0; i < paragraphs.length; i++) {
    const count = wordCounts[i]!;
    const startWord = timestamps[wordIndex];
    const endWord = timestamps[Math.min(wordIndex + count - 1, timestamps.length - 1)];

    if (!startWord || !endWord) break;

    slots.push({
      index: i,
      startMs: startWord.startMs,
      endMs: endWord.endMs,
      assetId: null,
    });

    wordIndex += count;
  }

  return slots;
}
