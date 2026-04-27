import { createWriteStream } from "fs";
import { writeFile } from "fs/promises";
import { pipeline } from "stream/promises";
import { Readable } from "stream";
import { extname } from "path";
import { BaseNodeExecutor, type HandleData, type HandleInputs } from "./executor";
import { storageClient, BUCKET_ASSETS } from "@nyx/shared";
import { run } from "../ffmpeg/runner";
import { probeDuration } from "../ffmpeg/probe";
import { logger } from "@nyx/shared";

const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);

function isImage(p: string): boolean {
  return IMAGE_EXTENSIONS.has(extname(p).toLowerCase());
}

// Inputs:  (nenhum) — assetIds e timings vêm de context.sceneSlots
// Outputs: video (path do slideshow montado)
export class SceneMediaExecutor extends BaseNodeExecutor<"SceneMedia"> {
  async execute(_inputs: HandleInputs): Promise<Record<string, HandleData>> {
    const { sceneSlots } = this.context;

    if (!sceneSlots || sceneSlots.length === 0) {
      throw new Error("SceneMedia: nenhum sceneSlot no contexto de execução");
    }

    const filled = sceneSlots.filter((s) => s.assetId != null);
    if (filled.length !== sceneSlots.length) {
      throw new Error(
        `SceneMedia: ${sceneSlots.length - filled.length} slot(s) sem asset atribuído`,
      );
    }

    const w = this.context.renderWidth;
    const h = this.context.renderHeight;
    if (!w || !h) throw new Error("SceneMedia: renderWidth/renderHeight não definidos no contexto");

    const { fit = "cover", transitionMs = 0 } = this.config;

    logger.info(
      { nodeId: this.nodeId, slots: sceneSlots.length, fit, transitionMs, w, h },
      "SceneMedia: building slideshow",
    );

    // 1. Baixa todos os assets em paralelo
    const downloaded = await Promise.all(
      sceneSlots.map(async (slot, i) => {
        const storageKey = slot.assetId!; // já resolvido (storageKey) pelo worker
        const ext = extname(storageKey) || (isImage(storageKey) ? ".jpg" : ".mp4");
        const localPath = this.outPath(`slot-${i}${ext}`);
        const stream = await storageClient.getObject(BUCKET_ASSETS, storageKey);
        await pipeline(Readable.from(stream), createWriteStream(localPath));
        return { slot, localPath };
      }),
    );

    // 2. Converte imagens em clips com a duração do slot; trimma vídeos
    const clips = await Promise.all(
      downloaded.map(async ({ slot, localPath }, i) => {
        const durationSec = (slot.endMs - slot.startMs) / 1000;
        const clipPath = this.outPath(`clip-${i}.mp4`);

        if (isImage(localPath)) {
          const scaleFilter = fit === "cover"
            ? `scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h}`
            : `scale=${w}:${h}:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2`;

          await run([
            "-y", "-loop", "1", "-i", localPath,
            "-vf", scaleFilter,
            "-t", String(durationSec),
            "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "fast", "-an",
            clipPath,
          ]);
        } else {
          // Vídeo: trimma para a duração do slot
          await run([
            "-y", "-i", localPath,
            "-t", String(durationSec),
            "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "fast", "-an",
            clipPath,
          ]);
        }

        return clipPath;
      }),
    );

    logger.info({ nodeId: this.nodeId, clips: clips.length }, "SceneMedia: clips ready");

    // 3. Concatena — com ou sem crossfade
    const outFile = this.outPath("slideshow.mp4");

    if (transitionMs > 0 && clips.length > 1) {
      await this._applyXfade(clips, transitionMs / 1000, outFile);
    } else {
      const concatFile = this.outPath("concat.txt");
      await writeFile(concatFile, clips.map((p) => `file '${p}'`).join("\n"));
      await run([
        "-y", "-f", "concat", "-safe", "0", "-i", concatFile,
        "-c:v", "copy", "-an",
        outFile,
      ]);
    }

    logger.info({ nodeId: this.nodeId, outFile }, "SceneMedia: slideshow done");
    return { video: outFile };
  }

  private async _applyXfade(clips: string[], transSec: number, outFile: string): Promise<void> {
    const durations = await Promise.all(clips.map((c) => probeDuration(c)));

    const inputArgs: string[] = [];
    for (const c of clips) inputArgs.push("-i", c);

    const filterParts: string[] = [];
    let prevLabel = "[0:v]";
    let timeOffset = 0;

    for (let i = 1; i < clips.length; i++) {
      timeOffset += durations[i - 1]! - transSec;
      const nextLabel = i === clips.length - 1 ? "[vout]" : `[v${i}]`;
      filterParts.push(
        `${prevLabel}[${i}:v]xfade=transition=fade:duration=${transSec}:offset=${timeOffset.toFixed(3)}${nextLabel}`,
      );
      prevLabel = nextLabel;
    }

    await run([
      "-y",
      ...inputArgs,
      "-filter_complex", filterParts.join(";"),
      "-map", "[vout]",
      "-an",
      "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "fast",
      outFile,
    ]);
  }
}
