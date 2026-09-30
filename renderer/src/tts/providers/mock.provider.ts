import { spawn } from "child_process";
import { readFile } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { randomUUID } from "crypto";
import type { TTSConfig, WordTimestamp } from "../../graph";
import { BaseTTSProvider, type TTSResult } from "../base.provider";

export class MockTTSProvider extends BaseTTSProvider {
  readonly name = "mock";

  protected async doSynthesize(text: string | undefined, _config: TTSConfig): Promise<TTSResult> {
    const words = (text ?? "test audio").split(/\s+/).filter(Boolean);
    const durationSec = Math.max(words.length * 0.5, 1);

    // Generate sine wave audio via FFmpeg
    const outFile = join(tmpdir(), `mock-tts-${randomUUID()}.wav`);

    await new Promise<void>((resolve, reject) => {
      const proc = spawn(
        "ffmpeg",
        [
          "-y",
          "-f", "lavfi",
          "-i", `sine=frequency=440:duration=${durationSec}`,
          "-ar", "44100",
          "-ac", "1",
          outFile,
        ],
        { stdio: ["ignore", "ignore", "pipe"] },
      );

      const stderr: Buffer[] = [];
      proc.stderr.on("data", (chunk) => stderr.push(chunk));
      proc.on("close", (code) =>
        code === 0
          ? resolve()
          : reject(new Error(`ffmpeg (mock TTS) exited with code ${code}: ${Buffer.concat(stderr).toString()}`)),
      );
    });

    const audio = await readFile(outFile);

    // Distribute word timestamps evenly across audio duration
    const msPerWord = (durationSec * 1000) / words.length;
    const wordTimestamps: WordTimestamp[] = words.map((word, i) => ({
      word,
      startMs: Math.round(i * msPerWord),
      endMs: Math.round((i + 1) * msPerWord),
    }));

    return { audio, wordTimestamps };
  }
}
