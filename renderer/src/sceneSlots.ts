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
