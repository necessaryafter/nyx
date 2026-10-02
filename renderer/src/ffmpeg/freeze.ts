import { ffmpegStderr } from "./runner";

const TAIL_WINDOW_SEC = 3;

/**
 * Quanto tempo do FIM do vídeo fica congelado (gravação que termina com a imagem parada).
 * Só olha os últimos 3s. Freezes que encostam um no outro contam como um só.
 */
export function frozenTailSec(freezedetectStderr: string, windowSec = TAIL_WINDOW_SEC): number {
  const intervals: { start: number; end?: number }[] = [];
  for (const m of freezedetectStderr.matchAll(/freeze_(start|end): ([0-9.]+)/g)) {
    if (m[1] === "start") intervals.push({ start: Number(m[2]) });
    else if (intervals.length) intervals.at(-1)!.end = Number(m[2]);
  }
  const last = intervals.at(-1);
  if (!last || last.end !== undefined) return 0; // termina andando

  let tailStart = last.start;
  for (let i = intervals.length - 2; i >= 0; i--) {
    if ((intervals[i]!.end ?? Infinity) < tailStart - 0.1) break;
    tailStart = intervals[i]!.start;
  }
  return Math.max(0, windowSec - tailStart);
}

export async function detectFrozenTail(path: string): Promise<number> {
  // Detecção é só otimização visual: se falhar, não corta nada.
  const stderr = await ffmpegStderr(["-sseof", `-${TAIL_WINDOW_SEC}`, "-i", path, "-vf", "freezedetect=n=-60dB:d=0.2", "-an", "-f", "null", "-"]).catch(() => "");
  return frozenTailSec(stderr);
}
