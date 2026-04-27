import { createWriteStream } from "fs";
import { pipeline } from "stream/promises";
import { Readable } from "stream";
import { extname } from "path";
import { BaseNodeExecutor, type HandleData, type HandleInputs } from "./executor";
import { storageClient, BUCKET_ASSETS } from "@nyx/shared";
import { run } from "../ffmpeg/runner";
import { logger } from "@nyx/shared";

const IMAGE_EXTS = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif"]);

export interface OverlayData {
  path: string;
  x: number;
  y: number;
  width: number;
  height: number;
  startSec: number;
  endSec: number;
  opacity: number;
  blendMode: "normal" | "screen";
}

export interface SfxData {
  path: string;
  startSec: number;
}

// Inputs:  (nenhum)
// Outputs: overlay (OverlayData), sfx (SfxData | null)
export class OverlayExecutor extends BaseNodeExecutor<"Overlay"> {
  async execute(_inputs: HandleInputs): Promise<Record<string, HandleData>> {
    const { assetId, soundAssetId, startSeconds, durationSeconds, position, opacity, blendMode } =
      this.config;

    // --- Download image/video asset ---
    const rawExt = extname(assetId).toLowerCase() || ".mp4";
    const rawPath = this.outPath(`raw${rawExt}`);

    logger.info({ nodeId: this.nodeId, assetId }, "Overlay: downloading image/video asset");
    const imgStream = await storageClient.getObject(BUCKET_ASSETS, assetId);
    await pipeline(Readable.from(imgStream), createWriteStream(rawPath));

    // Convert static images to a video clip with the right duration
    let overlayVideoPath: string;
    if (IMAGE_EXTS.has(rawExt)) {
      overlayVideoPath = this.outPath("overlay.mp4");
      await run([
        "-y",
        "-loop", "1",
        "-i", rawPath,
        "-t", String(durationSeconds),
        "-vf", `scale=${position.width}:${position.height}`,
        "-pix_fmt", "yuva420p",
        "-c:v", "libx264",
        "-preset", "ultrafast",
        overlayVideoPath,
      ]);
      logger.info({ nodeId: this.nodeId }, "Overlay: static image converted to video clip");
    } else {
      // Video/GIF: trim to durationSeconds
      overlayVideoPath = this.outPath("overlay.mp4");
      await run([
        "-y",
        "-i", rawPath,
        "-t", String(durationSeconds),
        "-vf", `scale=${position.width}:${position.height}`,
        "-pix_fmt", "yuva420p",
        "-c:v", "libx264",
        "-preset", "ultrafast",
        "-an",
        overlayVideoPath,
      ]);
    }

    const overlayData: OverlayData = {
      path: overlayVideoPath,
      x: position.x,
      y: position.y,
      width: position.width,
      height: position.height,
      startSec: startSeconds,
      endSec: startSeconds + durationSeconds,
      opacity: opacity ?? 1.0,
      blendMode: blendMode ?? "normal",
    };

    // --- Download sound effect (optional) ---
    let sfxData: SfxData | null = null;
    if (soundAssetId) {
      const sfxExt = extname(soundAssetId).toLowerCase() || ".mp3";
      const sfxPath = this.outPath(`sfx${sfxExt}`);
      logger.info({ nodeId: this.nodeId, soundAssetId }, "Overlay: downloading SFX asset");
      const sfxStream = await storageClient.getObject(BUCKET_ASSETS, soundAssetId);
      await pipeline(Readable.from(sfxStream), createWriteStream(sfxPath));
      sfxData = { path: sfxPath, startSec: startSeconds };
    }

    logger.info({ nodeId: this.nodeId, startSec: startSeconds, endSec: overlayData.endSec }, "Overlay: ready");

    return {
      overlay: overlayData,
      ...(sfxData ? { sfx: sfxData } : {}),
    };
  }
}
