import type { TTSConfig, WordTimestamp } from "../../graph";
import { BaseTTSProvider, type TTSResult } from "../base.provider";
import { logger } from "@nyx/shared";

const BASE_URL = "https://api.talkifylabs.com";
const POLL_INTERVAL_MS = 2_000;
const POLL_MAX_ATTEMPTS = 60; // 2 min timeout

interface TalkifyJobResponse {
  id: string;
  status: "queued" | "running" | "success" | "error";
  errorMessage?: string;
}

export class TalkifyProvider extends BaseTTSProvider {
  readonly name = "talkify";
  private readonly apiKey: string;

  constructor(apiKey: string) {
    super();
    this.apiKey = apiKey;
  }

  async synthesize(text: string | undefined, config: TTSConfig): Promise<TTSResult> {
    if (!text) throw new Error("TalkifyProvider: text is required");

    const jobId = await this.createJob(text, config);
    await this.waitForCompletion(jobId);
    const [audio, wordTimestamps] = await Promise.all([
      this.downloadAudio(jobId),
      this.fetchWordTimestamps(jobId),
    ]);
    return { audio, wordTimestamps };
  }

  private async createJob(text: string, config: TTSConfig): Promise<string> {
    const providerEffects = (config.providerConfig?.effects ?? {}) as Record<string, unknown>;

    const body: Record<string, unknown> = {
      audioName: crypto.randomUUID(),
      audio: {
        text,
        voiceId: config.voice,
        effects: {
          ...(config.speed !== undefined ? { tempo: config.speed } : {}),
          ...providerEffects,
        },
      },
    };

    const res = await fetch(`${BASE_URL}/tts/jobs`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.text().catch(() => res.statusText);
      throw new Error(`Talkify createJob failed (${res.status}): ${err}`);
    }

    const data = (await res.json()) as TalkifyJobResponse;
    logger.info({ talkifyJobId: data.id }, "Talkify job created");
    return data.id;
  }

  private async waitForCompletion(jobId: string): Promise<void> {
    for (let attempt = 0; attempt < POLL_MAX_ATTEMPTS; attempt++) {
      const res = await fetch(`${BASE_URL}/tts/jobs/${jobId}`, {
        headers: { Authorization: `Bearer ${this.apiKey}` },
      });

      if (!res.ok) {
        throw new Error(`Talkify poll failed (${res.status})`);
      }

      const data = (await res.json()) as TalkifyJobResponse;

      if (data.status === "success") {
        logger.info({ talkifyJobId: jobId }, "Talkify job completed");
        return;
      }

      if (data.status === "error") {
        throw new Error(`Talkify job failed: ${data.errorMessage ?? "unknown error"}`);
      }

      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    }

    throw new Error(`Talkify job ${jobId} timed out after ${POLL_MAX_ATTEMPTS} poll attempts`);
  }

  private async downloadAudio(jobId: string): Promise<Buffer> {
    const res = await fetch(`${BASE_URL}/audios/${jobId}.mp3`, {
      headers: { Authorization: `Bearer ${this.apiKey}` },
    });

    if (!res.ok) {
      throw new Error(`Talkify audio download failed (${res.status})`);
    }

    return Buffer.from(await res.arrayBuffer());
  }

  private async fetchWordTimestamps(jobId: string): Promise<WordTimestamp[]> {
    const res = await fetch(`${BASE_URL}/tts/jobs/${jobId}/subtitles?style=word`, {
      headers: { Authorization: `Bearer ${this.apiKey}` },
    });

    if (!res.ok) {
      throw new Error(`Talkify subtitles fetch failed (${res.status})`);
    }

    const srt = await res.text();
    return parseSrtToWordTimestamps(srt);
  }
}

/**
 * Parses an SRT string where each entry is a single word.
 * SRT format:
 *   1
 *   00:00:00,000 --> 00:00:00,500
 *   hello
 */
function parseSrtToWordTimestamps(srt: string): WordTimestamp[] {
  const timestamps: WordTimestamp[] = [];
  const blocks = srt.trim().split(/\n\s*\n/);

  for (const block of blocks) {
    const lines = block.trim().split("\n");
    if (lines.length < 3) continue;

    const timeLine = lines[1]!;
    const word = lines.slice(2).join(" ").trim();

    if (!word) continue;

    const match = timeLine.match(
      /(\d{2}):(\d{2}):(\d{2}),(\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2}),(\d{3})/,
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
