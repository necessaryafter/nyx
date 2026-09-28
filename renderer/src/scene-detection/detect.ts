import { spawn } from "child_process";

export interface DetectedSegment {
  index: number; // 1-based
  startMs: number;
  endMs: number;
}

export interface DetectSegmentsOptions {
  threshold?: number; // default 0.4 — limiar clássico do ffmpeg pra corte abrupto
  minSegmentMs?: number; // default 1500 — corte mais próximo que isso do anterior é descartado
}

const DEFAULT_THRESHOLD = 0.4;
const DEFAULT_MIN_SEGMENT_MS = 1500;

/**
 * Roda o ffmpeg com o filtro select='gt(scene,threshold)' + showinfo — cada
 * frame selecionado é um ponto onde a cena mudou bruscamente. Devolve os
 * timestamps em ms, ordenados, sem incluir o 0 (início do vídeo não é "um
 * corte"). I/O real, não é pura — ver buildSegments pra lógica testável.
 */
export function detectSceneCuts(filePath: string, threshold = DEFAULT_THRESHOLD): Promise<number[]> {
  return new Promise((resolve, reject) => {
    const proc = spawn(
      "ffmpeg",
      ["-i", filePath, "-filter:v", `select='gt(scene,${threshold})',showinfo`, "-an", "-f", "null", "-"],
      { stdio: ["ignore", "ignore", "pipe"] },
    );

    const stderr: Buffer[] = [];
    proc.stderr.on("data", (chunk) => stderr.push(chunk));

    proc.on("close", (code) => {
      const output = Buffer.concat(stderr).toString();
      // O ffmpeg sai com código != 0 quando não há stream de saída real (esperado
      // com -f null); só trata como erro de verdade se não achou nenhuma linha
      // de showinfo E o código não é 0 (indício de arquivo inválido/corrompido).
      const cuts: number[] = [];
      const re = /Parsed_showinfo[^\n]*pts_time:([\d.]+)/g;
      let match: RegExpExecArray | null;
      while ((match = re.exec(output))) {
        cuts.push(Math.round(parseFloat(match[1]!) * 1000));
      }

      if (code !== 0 && cuts.length === 0 && !output.includes("Parsed_showinfo")) {
        return reject(new Error(`ffmpeg scene detection failed (code ${code}): ${output.slice(-2000)}`));
      }

      resolve(cuts.sort((a, b) => a - b));
    });

    proc.on("error", (err) => reject(err));
  });
}

/**
 * Função pura: recebe os timestamps de corte brutos (podem estar muito
 * próximos um do outro) e monta a lista final de segmentos, descartando
 * cortes a menos de `minSegmentMs` do último corte aceito.
 */
export function buildSegments(
  cutTimestampsMs: number[],
  durationMs: number,
  minSegmentMs: number = DEFAULT_MIN_SEGMENT_MS,
): DetectedSegment[] {
  const accepted: number[] = [0];
  for (const cut of cutTimestampsMs) {
    if (cut - accepted[accepted.length - 1]! >= minSegmentMs && durationMs - cut >= minSegmentMs) {
      accepted.push(cut);
    }
  }
  accepted.push(durationMs);

  const segments: DetectedSegment[] = [];
  for (let i = 0; i < accepted.length - 1; i++) {
    segments.push({ index: i + 1, startMs: accepted[i]!, endMs: accepted[i + 1]! });
  }
  return segments;
}

/** Junta as duas: roda o ffmpeg de verdade, filtra, monta os segmentos. */
export async function detectSegments(
  filePath: string,
  durationMs: number,
  opts: DetectSegmentsOptions = {},
): Promise<DetectedSegment[]> {
  const cuts = await detectSceneCuts(filePath, opts.threshold ?? DEFAULT_THRESHOLD);
  return buildSegments(cuts, durationMs, opts.minSegmentMs ?? DEFAULT_MIN_SEGMENT_MS);
}

/**
 * Estratégia alternativa: divide em pedaços de tamanho fixo, usada quando
 * detectSegments não achou corte nenhum e o usuário escolhe dividir mesmo
 * assim. Pura, sem ffmpeg. O último pedaço absorve o resto se ficar curto
 * demais (< minLastPieceMs) em vez de virar um segmento anão.
 */
export function splitFixedInterval(durationMs: number, intervalMs: number, minLastPieceMs = 500): DetectedSegment[] {
  const count = Math.max(1, Math.ceil(durationMs / intervalMs));
  const boundaries: number[] = [];
  for (let i = 0; i < count; i++) boundaries.push(i * intervalMs);
  boundaries.push(durationMs);

  // Último pedaço curto demais: gruda no penúltimo.
  if (boundaries.length > 2) {
    const lastPiece = boundaries[boundaries.length - 1]! - boundaries[boundaries.length - 2]!;
    if (lastPiece < minLastPieceMs) boundaries.splice(boundaries.length - 2, 1);
  }

  const segments: DetectedSegment[] = [];
  for (let i = 0; i < boundaries.length - 1; i++) {
    segments.push({ index: i + 1, startMs: boundaries[i]!, endMs: boundaries[i + 1]! });
  }
  return segments;
}
