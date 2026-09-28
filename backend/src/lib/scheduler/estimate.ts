import { RENDER_CREDITS_PER_MIN, TTS_CREDITS_PER_MIN } from "../credits";

export interface EstimateInput {
  mode: "single" | "parts";
  totalMinutes?: number;
  partsCount?: number;
  minutesPerPart?: number;
  wordsPerMinute?: number; // default 150, mesmo default de series-script
}

export interface EstimateResult {
  partsTotal: number;
  minutesPerPart: number;
  wordsPerPart: number;
  creditsPerPart: number;
  creditsTotal: number;
}

const DEFAULT_WPM = 150;

/** Créditos e palavras esperados de uma execução — usado tanto pela API (preview) quanto pelo worker (checagem de saldo). */
export function estimateRun(input: EstimateInput): EstimateResult {
  const partsTotal = input.mode === "single" ? 1 : (input.partsCount ?? 1);
  const minutesPerPart = input.mode === "single" ? (input.totalMinutes ?? 0) : (input.minutesPerPart ?? 0);
  const wpm = input.wordsPerMinute ?? DEFAULT_WPM;

  const creditsPerPart = Math.ceil(minutesPerPart * (RENDER_CREDITS_PER_MIN + TTS_CREDITS_PER_MIN));

  return {
    partsTotal,
    minutesPerPart,
    wordsPerPart: Math.round(minutesPerPart * wpm),
    creditsPerPart,
    creditsTotal: creditsPerPart * partsTotal,
  };
}
