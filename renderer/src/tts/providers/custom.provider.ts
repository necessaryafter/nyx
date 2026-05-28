import { pipeline } from "stream/promises";
import { Readable } from "stream";
import { createWriteStream } from "fs";
import { mkdtemp, readFile } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import type { TTSConfig, WordTimestamp } from "../../graph";
import { BaseTTSProvider, type TTSResult } from "../base.provider";
import { storageClient, BUCKET_ASSETS } from "@nyx/shared";
import { logger } from "@nyx/shared";

const WHISPERX_URL = process.env.WHISPERX_URL ?? "http://localhost:8010";

export class CustomAudioProvider extends BaseTTSProvider {
  readonly name = "custom";

  async synthesize(text: string | undefined, config: TTSConfig): Promise<TTSResult> {
    const assetId = config.voice;
    if (!assetId) {
      throw new Error("CustomAudioProvider: config.voice deve conter o assetId do áudio");
    }

    const tmpDir = await mkdtemp(join(tmpdir(), "custom-tts-"));
    const audioFile = join(tmpDir, "audio.wav");

    logger.info({ assetId }, "CustomAudio: downloading audio asset");

    const stream = await storageClient.getObject(BUCKET_ASSETS, assetId);
    await pipeline(Readable.from(stream), createWriteStream(audioFile));

    logger.info({ hasText: !!text }, "CustomAudio: calling whisperx-service");

    const form = new FormData();
    form.append("audio", new Blob([await readFile(audioFile)]), "audio.wav");

    const res = await fetch(`${WHISPERX_URL}/transcribe`, { method: "POST", body: form });
    if (!res.ok) {
      const detail = await res.text().catch(() => res.statusText);
      throw new Error(`whisperx-service error (${res.status}): ${detail}`);
    }

    const { words } = (await res.json()) as { words: WordTimestamp[] };

    logger.info({ words: words.length }, "CustomAudio: transcription complete");

    const audio = await readFile(audioFile);
    return { audio, wordTimestamps: words };
  }
}
