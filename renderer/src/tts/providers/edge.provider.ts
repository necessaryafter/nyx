import { spawn } from "child_process";
import { readFile, rm } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { randomUUID } from "crypto";
import type { TTSConfig, WordTimestamp } from "../../graph";
import { BaseTTSProvider, type TTSResult } from "../base.provider";
import { logger } from "@nyx/shared";

// Default voice — Microsoft Edge Neural TTS, pt-BR
const DEFAULT_VOICE = "pt-BR-FranciscaNeural";

// Edge TTS silently truncates requests longer than ~3 min. Stay well under.
const MAX_CHUNK_CHARS = 2_500;

export class EdgeTTSProvider extends BaseTTSProvider {
  readonly name = "edge";

  async synthesize(text: string | undefined, config: TTSConfig): Promise<TTSResult> {
    if (!text) throw new Error("EdgeTTSProvider: text is required");

    const voice = config.voice ?? DEFAULT_VOICE;
    const chunks = splitTextIntoChunks(text, MAX_CHUNK_CHARS);
    logger.info({ voice, textLen: text.length, chunks: chunks.length }, "EdgeTTS: synthesizing");

    const results: Array<{ audio: Buffer; wordTimestamps: WordTimestamp[] }> = [];
    let offsetMs = 0;

    for (let i = 0; i < chunks.length; i++) {
      const id = randomUUID();
      const mp3File = join(tmpdir(), `edge-tts-${id}.mp3`);
      const vttFile = join(tmpdir(), `edge-tts-${id}.vtt`);

      await runEdgeTTS(chunks[i]!, voice, mp3File, vttFile);

      const [audio, vtt] = await Promise.all([readFile(mp3File), readFile(vttFile, "utf8")]);

      await Promise.all([rm(mp3File, { force: true }), rm(vttFile, { force: true })]);

      const wordTimestamps = parseVtt(vtt).map((w) => ({
        ...w,
        startMs: w.startMs + offsetMs,
        endMs: w.endMs + offsetMs,
      }));

      if (wordTimestamps.length > 0) {
        offsetMs = wordTimestamps[wordTimestamps.length - 1]!.endMs + 50;
      }

      results.push({ audio, wordTimestamps });
    }

    const audio = Buffer.concat(results.map((r) => r.audio));
    const wordTimestamps = results.flatMap((r) => r.wordTimestamps);

    logger.info({ words: wordTimestamps.length, chunks: chunks.length }, "EdgeTTS: done");

    return { audio, wordTimestamps };
  }
}

/**
 * Splits text into chunks at sentence/paragraph boundaries,
 * keeping each chunk under maxChars.
 */
function splitTextIntoChunks(text: string, maxChars: number): string[] {
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
  return chunks;
}

function runEdgeTTS(text: string, voice: string, mp3Out: string, vttOut: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(
      "edge-tts",
      [
        "--voice", voice,
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
