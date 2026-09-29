import { spawn } from "child_process";
import { readFile, rm, mkdtemp, writeFile } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { randomUUID } from "crypto";
import type { TTSConfig, WordTimestamp } from "../../graph";
import { BaseTTSProvider, type TTSResult } from "../base.provider";
import { probeDuration } from "../../ffmpeg/probe";
import { run } from "../../ffmpeg/runner";
import { logger } from "@nyx/shared";

// Default voice — Microsoft Edge Neural TTS, pt-BR
const DEFAULT_VOICE = "pt-BR-FranciscaNeural";

// Edge TTS silently truncates requests longer than ~3 min. Stay well under.
const MAX_CHUNK_CHARS = 2_500;

// Pausa inserida entre chunks quando o texto precisa ser dividido — sem isso, dois
// chunks concatenados direto (Buffer.concat cru) soam colados, sem respiro nenhum
// entre frases (reparado sobretudo quando o CTA final vira um chunk isolado).
const SILENCE_MS = 400;

export class EdgeTTSProvider extends BaseTTSProvider {
  readonly name = "edge";

  async synthesize(text: string | undefined, config: TTSConfig): Promise<TTSResult> {
    if (!text) throw new Error("EdgeTTSProvider: text is required");

    const voice = config.voice ?? DEFAULT_VOICE;
    // config.speed é um multiplicador (1 = normal); edge-tts espera um % relativo.
    const rate = config.speed ? `${config.speed >= 1 ? "+" : ""}${Math.round((config.speed - 1) * 100)}%` : "+0%";
    const chunks = splitTextIntoChunks(text, MAX_CHUNK_CHARS);
    logger.info({ voice, rate, textLen: text.length, chunks: chunks.length }, "EdgeTTS: synthesizing");

    const wordTimestampsByChunk: WordTimestamp[][] = [];
    const chunkFiles: string[] = [];
    let offsetMs = 0;

    try {
      for (let i = 0; i < chunks.length; i++) {
        const id = randomUUID();
        const mp3File = join(tmpdir(), `edge-tts-${id}.mp3`);
        const vttFile = join(tmpdir(), `edge-tts-${id}.vtt`);

        await runEdgeTTS(chunks[i]!, voice, rate, mp3File, vttFile);

        const vtt = await readFile(vttFile, "utf8");
        await rm(vttFile, { force: true });
        chunkFiles.push(mp3File);

        const chunkDurationMs = Math.round((await probeDuration(mp3File)) * 1000);
        let wordTimestamps = parseVtt(vtt).map((w) => ({ ...w, startMs: w.startMs + offsetMs, endMs: w.endMs + offsetMs }));

        if (wordTimestamps.length === 0) {
          // edge-tts às vezes não devolve boundary nenhum pra um chunk isolado curto
          // (mais comum quando o chunk é só o CTA final, sozinho) — sem esse fallback
          // o texto some da legenda mesmo estando audível no áudio.
          wordTimestamps = fallbackTimestamps(chunks[i]!, offsetMs, chunkDurationMs);
          logger.warn({ chunkIndex: i }, "EdgeTTS: chunk sem boundary de legenda, usando timestamps estimados");
        }

        wordTimestampsByChunk.push(wordTimestamps);
        offsetMs += chunkDurationMs + (i < chunks.length - 1 ? SILENCE_MS : 0);
      }

      const audio = chunkFiles.length > 1 ? await concatWithSilence(chunkFiles, SILENCE_MS) : await readFile(chunkFiles[0]!);
      const wordTimestamps = wordTimestampsByChunk.flat();

      logger.info({ words: wordTimestamps.length, chunks: chunks.length }, "EdgeTTS: done");

      return { audio, wordTimestamps };
    } finally {
      await Promise.all(chunkFiles.map((f) => rm(f, { force: true }).catch(() => {})));
    }
  }
}

/** Espalha as palavras uniformemente pela duração real do áudio do chunk — só usado
 * quando o edge-tts não devolve boundary nenhum (perderia a legenda inteira daquele trecho). */
export function fallbackTimestamps(text: string, offsetMs: number, durationMs: number): WordTimestamp[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const perWordMs = durationMs / words.length;
  return words.map((word, i) => ({
    word,
    startMs: offsetMs + Math.round(i * perWordMs),
    endMs: offsetMs + Math.round((i + 1) * perWordMs),
  }));
}

/** Concatena os áudios dos chunks intercalando um trecho de silêncio real entre eles
 * (reencoda no concat — não exige que os chunks tenham o mesmo sample rate). */
async function concatWithSilence(files: string[], silenceMs: number): Promise<Buffer> {
  const workDir = await mkdtemp(join(tmpdir(), "edge-tts-concat-"));
  try {
    const silenceFile = join(workDir, "silence.mp3");
    await run(["-y", "-f", "lavfi", "-i", "anullsrc=r=24000:cl=mono", "-t", String(silenceMs / 1000), "-c:a", "libmp3lame", silenceFile]);

    const entries = files.flatMap((f, i) => (i < files.length - 1 ? [f, silenceFile] : [f]));
    const listFile = join(workDir, "list.txt");
    await writeFile(listFile, entries.map((f) => `file '${f}'`).join("\n"));

    const outFile = join(workDir, "out.mp3");
    await run(["-y", "-f", "concat", "-safe", "0", "-i", listFile, "-c:a", "libmp3lame", outFile]);
    return await readFile(outFile);
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}

/**
 * Splits text into chunks at sentence/paragraph boundaries,
 * keeping each chunk under maxChars.
 */
export function splitTextIntoChunks(text: string, maxChars: number): string[] {
  if (text.length <= maxChars) return [text];

  const chunks: string[] = [];
  // Split on sentence-ending punctuation followed by whitespace
  const sentences = text.split(/(?<=[.!?…\n])\s+/);
  let current = "";

  for (const sentence of sentences) {
    if (sentence.length > maxChars) {
      // Sentence itself is too long — split on commas/semicolons
      if (current) { chunks.push(current.trim()); current = ""; }
      const parts = sentence.split(/(?<=[,;])\s+/);
      for (const part of parts) {
        if ((current + " " + part).trim().length > maxChars) {
          if (current) chunks.push(current.trim());
          current = part;
        } else {
          current = current ? current + " " + part : part;
        }
      }
    } else if ((current + " " + sentence).trim().length > maxChars) {
      chunks.push(current.trim());
      current = sentence;
    } else {
      current = current ? current + " " + sentence : sentence;
    }
  }

  if (current.trim()) chunks.push(current.trim());

  // Evita deixar um pedaço final curtinho isolado — é exatamente o que acontece
  // quando o texto (corpo + CTA) passa um pouco de maxChars: o CTA ("Curta e
  // comente...") sozinho vira um chunk próprio, com pedido de TTS isolado que às
  // vezes não recebe boundary de legenda (ver fallbackTimestamps) e nunca tem pausa
  // natural antes dele (começo de um áudio novo, não quebra de frase no mesmo áudio).
  const MIN_TRAILING_CHARS = 300;
  const MERGE_TOLERANCE = maxChars * 1.1;
  while (chunks.length > 1 && chunks[chunks.length - 1]!.length < MIN_TRAILING_CHARS) {
    const merged = `${chunks[chunks.length - 2]} ${chunks[chunks.length - 1]}`;
    if (merged.length > MERGE_TOLERANCE) break; // não vale o risco de estourar o limite real do edge-tts
    chunks.splice(chunks.length - 2, 2, merged);
  }

  return chunks;
}

function runEdgeTTS(text: string, voice: string, rate: string, mp3Out: string, vttOut: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(
      "edge-tts",
      [
        "--voice", voice,
        "--rate", rate,
        "--text", text,
        "--write-media", mp3Out,
        "--write-subtitles", vttOut,
      ],
      { stdio: ["ignore", "ignore", "pipe"] },
    );

    const stderr: Buffer[] = [];
    proc.stderr.on("data", (chunk) => stderr.push(chunk));
    proc.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(
          new Error(
            `edge-tts exited with code ${code}: ${Buffer.concat(stderr).toString().trim()}`,
          ),
        );
      }
    });
    proc.on("error", (err) => {
      reject(
        new Error(
          `edge-tts not found — install with: pip install edge-tts\n${err.message}`,
        ),
      );
    });
  });
}

/**
 * Parses a WebVTT file produced by edge-tts --write-subtitles.
 */
function parseVtt(vtt: string): WordTimestamp[] {
  const timestamps: WordTimestamp[] = [];
  const normalized = vtt.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const blocks = normalized.trim().split(/\n\s*\n/);

  for (const block of blocks) {
    const lines = block.trim().split("\n").map((l) => l.trimEnd());
    const timeLine = lines.find((l) => l.includes("-->"));
    if (!timeLine) continue;

    const word = lines
      .filter((l) => !l.includes("-->") && l !== "WEBVTT" && !/^\d+$/.test(l.trim()))
      .join(" ")
      .trim();

    if (!word) continue;

    const match = timeLine.match(
      /(\d{2}):(\d{2}):(\d{2})[,.](\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})[,.](\d{3})/,
    );
    if (!match) continue;

    const startMs =
      parseInt(match[1]!) * 3_600_000 +
      parseInt(match[2]!) * 60_000 +
      parseInt(match[3]!) * 1_000 +
      parseInt(match[4]!);

    const endMs =
      parseInt(match[5]!) * 3_600_000 +
      parseInt(match[6]!) * 60_000 +
      parseInt(match[7]!) * 1_000 +
      parseInt(match[8]!);

    timestamps.push({ word, startMs, endMs });
  }

  return timestamps;
}
