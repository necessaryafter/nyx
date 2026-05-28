import { spawn } from "child_process";
import { readFile } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { randomUUID } from "crypto";
import { BaseImageProvider, type ImageOptions, type ImageResult } from "../base.provider";

const COLORS = ["#1a1a2e", "#16213e", "#0f3460", "#533483", "#2b4865", "#256d85", "#1b4332", "#40916c"];

export class MockImageProvider extends BaseImageProvider {
  readonly name = "mock";

  async generate(prompt: string, options?: ImageOptions): Promise<ImageResult> {
    const ratio = options?.ratio ?? "9:16";
    const [w, h] = ratio === "16:9" ? [1280, 720] : ratio === "1:1" ? [720, 720] : [720, 1280];

    const color = COLORS[Math.floor(Math.random() * COLORS.length)]!;
    const outFile = join(tmpdir(), `mock-img-${randomUUID()}.png`);

    // Truncate prompt for display
    const label = prompt.length > 60 ? prompt.slice(0, 57) + "..." : prompt;
    // Escape single quotes for FFmpeg drawtext
    const escaped = label.replace(/'/g, "\\'").replace(/:/g, "\\:");

    await new Promise<void>((resolve, reject) => {
      const proc = spawn(
        "ffmpeg",
        [
          "-y",
          "-f", "lavfi",
          "-i", `color=c=${color.replace("#", "0x")}:size=${w}x${h}:rate=1`,
          "-vf", `drawtext=text='MOCK IMAGE':fontcolor=white:fontsize=${Math.round(h * 0.05)}:x=(w-text_w)/2:y=(h-text_h)/2-${Math.round(h * 0.06)},drawtext=text='${escaped}':fontcolor=white@0.6:fontsize=${Math.round(h * 0.025)}:x=(w-text_w)/2:y=(h-text_h)/2+${Math.round(h * 0.02)}:line_spacing=8`,
          "-frames:v", "1",
          outFile,
        ],
        { stdio: ["ignore", "ignore", "pipe"] },
      );

      const stderr: Buffer[] = [];
      proc.stderr.on("data", (chunk) => stderr.push(chunk));
      proc.on("close", (code) =>
        code === 0
          ? resolve()
          : reject(new Error(`ffmpeg (mock image) exited ${code}: ${Buffer.concat(stderr).toString()}`)),
      );
    });

    const buffer = await readFile(outFile);
    return { buffer, mimeType: "image/png", ext: "png" };
  }
}
