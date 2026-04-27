import { BaseNodeExecutor, type HandleData, type HandleInputs } from "./executor";
import { FFmpegBuilder } from "../ffmpeg/builder";
import { run } from "../ffmpeg/runner";
import { logger } from "@nyx/shared";
import type { OverlayData } from "./overlay";

// Inputs: base (path do vídeo), overlay (HandleData[] — múltiplos, ordenados por edge.order)
// Outputs: video (path do vídeo composto)
export class LayerExecutor extends BaseNodeExecutor<"Layer"> {
  async execute(inputs: HandleInputs): Promise<Record<string, HandleData>> {
    const basePath = inputs.base as string;
    const rawOverlay = inputs.overlay;
    const outFile = this.outPath("composited.mp4");

    const rawArray: HandleData[] = Array.isArray(rawOverlay)
      ? rawOverlay
      : rawOverlay
        ? [rawOverlay]
        : [];

    // Separate filter strings (e.g. "ass=/path/subs.ass") from video overlay objects
    const stringFilters: string[] = [];
    const videoOverlays: OverlayData[] = [];

    for (const item of rawArray) {
      if (typeof item === "string") {
        stringFilters.push(item);
      } else if (typeof item === "object" && item !== null && "path" in item) {
        videoOverlays.push(item as OverlayData);
      }
    }

    logger.info(
      { nodeId: this.nodeId, stringFilters: stringFilters.length, videoOverlays: videoOverlays.length },
      "Layer: compositing",
    );

    if (videoOverlays.length === 0 && stringFilters.length === 0) {
      // No overlays — copy base video directly
      const args = new FFmpegBuilder()
        .input(basePath)
        .codec("v", "copy")
        .noAudio()
        .output(outFile)
        .build();
      await run(args);

    } else if (videoOverlays.length === 0) {
      // Only string filters (ASS subtitles, etc.) — existing behaviour
      const filterChain = stringFilters.join(",");
      const args = new FFmpegBuilder()
        .input(basePath)
        .videoFilter(filterChain)
        .noAudio()
        .output(outFile)
        .build();
      await run(args);

    } else {
      // Video overlays present — build a filter_complex chain.
      // Input layout: 0=base, 1..N=overlay clips
      const ffArgs: string[] = ["-y", "-i", basePath];
      for (const ov of videoOverlays) {
        ffArgs.push("-i", ov.path);
      }

      const filterParts: string[] = [];
      let currentLabel = "0:v";

      for (let i = 0; i < videoOverlays.length; i++) {
        const ov = videoOverlays[i]!;
        const inputIdx = i + 1;
        const isLast = i === videoOverlays.length - 1 && stringFilters.length === 0;
        const outLabel = isLast ? "v_final" : `v_ov${i}`;

        if (ov.opacity < 1.0) {
          // Scale alpha channel for partial opacity
          const alphaLabel = `alpha${i}`;
          filterParts.push(`[${inputIdx}:v]colorchannelmixer=aa=${ov.opacity}[${alphaLabel}]`);
          filterParts.push(
            `[${currentLabel}][${alphaLabel}]overlay=${ov.x}:${ov.y}:enable='between(t,${ov.startSec},${ov.endSec})'[${outLabel}]`,
          );
        } else {
          filterParts.push(
            `[${currentLabel}][${inputIdx}:v]overlay=${ov.x}:${ov.y}:enable='between(t,${ov.startSec},${ov.endSec})'[${outLabel}]`,
          );
        }

        currentLabel = outLabel;
      }

      // Chain string filters (e.g. ASS subtitles) after all video overlays
      if (stringFilters.length > 0) {
        filterParts.push(`[${currentLabel}]${stringFilters.join(",")}[v_final]`);
        currentLabel = "v_final";
      }

      ffArgs.push(
        "-filter_complex", filterParts.join(";"),
        "-map", `[${currentLabel}]`,
        "-c:v", "libx264",
        "-preset", "fast",
        "-an",
        outFile,
      );

      await run(ffArgs);
    }

    logger.info({ nodeId: this.nodeId, outFile }, "Layer: done");

    return { video: outFile };
  }
}
