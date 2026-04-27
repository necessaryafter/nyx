import { writeFile } from "fs/promises";
import { extname } from "path";
import { BaseNodeExecutor, type HandleData, type HandleInputs } from "./executor";
import { FFmpegBuilder } from "../ffmpeg/builder";
import { run } from "../ffmpeg/runner";
import { probeDuration } from "../ffmpeg/probe";
import { logger } from "@nyx/shared";
import type { EffectConfig, TransitionConfig, ZoomConfig, ShakeConfig } from "../graph";

const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp"]);

function isImagePath(p: string): boolean {
  return IMAGE_EXTENSIONS.has(extname(p).toLowerCase());
}

// Converts image files to video clips with equal duration share.
// Non-image paths are returned as-is.
async function convertImagesToClips(
  paths: string[],
  totalDuration: number,
  outPath: (name: string) => string,
  width: number,
  height: number,
): Promise<string[]> {
  const images = paths.filter(isImagePath);
  if (images.length === 0) return paths;

  const clipDuration = totalDuration / images.length;
  const fps = 30;
  const frames = Math.ceil(clipDuration * fps);
  let imgIndex = 0;

  return Promise.all(
    paths.map(async (p) => {
      if (!isImagePath(p)) return p;
      const out = outPath(`img-clip-${imgIndex++}.mp4`);
      await run([
        "-y", "-loop", "1", "-i", p,
        "-vf", `scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},zoompan=z='min(zoom+0.0003,1.05)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${frames}:s=${width}x${height}:fps=${fps}`,
        "-t", String(clipDuration),
        "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "fast", "-an",
        out,
      ]);
      return out;
    }),
  );
}

// Inputs:  intro? (string[] — clips fixos no início), items (string[] | string[][] — pool(s) de vídeo/imagem)
//          audio (path — referência de duração), effects? (EffectConfig[])
// Outputs: video (path do vídeo montado e trimado)
export class VideoFitExecutor extends BaseNodeExecutor<"VideoFit"> {
  async execute(inputs: HandleInputs): Promise<Record<string, HandleData>> {
    const rawIntro = inputs.intro;
    const introPaths: string[] = rawIntro == null
      ? []
      : Array.isArray(rawIntro)
        ? (rawIntro as (string | string[])[]).flatMap((v) => (Array.isArray(v) ? v : [v]))
        : [rawIntro as string];

    const rawItems = inputs.items;
    const audioPath = inputs.audio as string;

    const rawEffects = inputs.effects;
    const effects: EffectConfig[] = rawEffects == null
      ? []
      : Array.isArray(rawEffects)
        ? (rawEffects as EffectConfig[])
        : [rawEffects as EffectConfig];

    const zoomConfig = effects.find((e): e is Extract<EffectConfig, { type: "zoom" }> => e.type === "zoom");
    const shakeConfig = effects.find((e): e is Extract<EffectConfig, { type: "shake" }> => e.type === "shake");
    const transitionConfig = effects.find((e): e is Extract<EffectConfig, { type: "transition" }> => e.type === "transition");

    // Flatten: suporta um ou múltiplos MediaPool conectados ao mesmo handle
    const poolPaths: string[] = rawItems == null
      ? []
      : Array.isArray(rawItems)
        ? (rawItems as (string | string[])[]).flatMap((v) => (Array.isArray(v) ? v : [v]))
        : [rawItems as string];

    if (introPaths.length === 0 && poolPaths.length === 0) {
      throw new Error("VideoFit: nenhum vídeo recebido");
    }

    const { mode } = this.config;
    const targetDuration = await probeDuration(audioPath);

    logger.info(
      { nodeId: this.nodeId, targetDuration, introCount: introPaths.length, poolCount: poolPaths.length, mode },
      "VideoFit: building playlist",
    );

    // Convert any image assets to video clips before building the playlist
    const w = this.context.renderWidth;
    const h = this.context.renderHeight;
    if (!w || !h) throw new Error("VideoFit: renderWidth/renderHeight não definidos no contexto");

    const resolvedIntro = await convertImagesToClips(introPaths, targetDuration, this.outPath.bind(this), w, h);
    const resolvedPool = await convertImagesToClips(poolPaths, targetDuration, this.outPath.bind(this), w, h);

    const introDurations = await Promise.all(resolvedIntro.map((p) => probeDuration(p)));
    const introDuration = introDurations.reduce((s, d) => s + d, 0);
    const remainingDuration = Math.max(0, targetDuration - introDuration);

    let poolPlaylist: string[] = [];
    if (resolvedPool.length > 0 && remainingDuration > 0) {
      const durations = await Promise.all(resolvedPool.map((p) => probeDuration(p)));

      if (mode === "random-loop") {
        let totalDuration = 0;
        while (totalDuration < remainingDuration) {
          const idx = Math.floor(Math.random() * resolvedPool.length);
          poolPlaylist.push(resolvedPool[idx]!);
          totalDuration += durations[idx]!;
        }
      } else if (mode === "sequential") {
        let totalDuration = 0;
        let i = 0;
        while (totalDuration < remainingDuration) {
          const idx = i % resolvedPool.length;
          poolPlaylist.push(resolvedPool[idx]!);
          totalDuration += durations[idx]!;
          i++;
        }
      } else {
        // once: usa em ordem, para quando esgota
        poolPlaylist = [...resolvedPool];
      }
    }

    const playlist = [...resolvedIntro, ...poolPlaylist];

    logger.info({ nodeId: this.nodeId, playlistLength: playlist.length }, "VideoFit: playlist built");

    const trimTo = mode !== "once" ? targetDuration : undefined;

    // Fast path: nenhum efeito — codec copy
    if (!zoomConfig && !shakeConfig && !transitionConfig) {
      const concatFile = this.outPath("concat.txt");
      const outFile = this.outPath("fitted.mp4");
      await writeFile(concatFile, playlist.map((p) => `file '${p}'`).join("\n"));

      const builder = new FFmpegBuilder()
        .rawArgs("-f", "concat", "-safe", "0")
        .input(concatFile)
        .noAudio()
        .codec("v", "copy")
        .output(outFile);

      if (trimTo !== undefined) builder.duration(trimTo);
      await run(builder.build());

      logger.info({ nodeId: this.nodeId, outFile }, "VideoFit: done (copy)");
      return { video: outFile, audio: audioPath };
    }

    // Re-encode clips com zoom/shake se necessário
    let processedClips: string[];
    if (zoomConfig || shakeConfig) {
      logger.info({ nodeId: this.nodeId }, "VideoFit: re-encoding clips with effects");
      processedClips = await Promise.all(
        playlist.map((clip, i) => this._reencodeClip(clip, i, zoomConfig, shakeConfig)),
      );
    } else {
      processedClips = playlist;
    }

    const outFile = this.outPath("fitted.mp4");

    if (transitionConfig && processedClips.length > 1) {
      logger.info({ nodeId: this.nodeId }, "VideoFit: applying transitions");
      await this._applyTransitions(processedClips, transitionConfig, outFile, trimTo);
    } else {
      const concatFile = this.outPath("concat-eff.txt");
      await writeFile(concatFile, processedClips.map((p) => `file '${p}'`).join("\n"));

      const args = ["-y", "-f", "concat", "-safe", "0", "-i", concatFile, "-an", "-c:v", "copy"];
      if (trimTo !== undefined) args.push("-t", String(trimTo));
      args.push(outFile);
      await run(args);
    }

    logger.info({ nodeId: this.nodeId, outFile }, "VideoFit: done");
    return { video: outFile, audio: audioPath };
  }

  private async _reencodeClip(
    clip: string,
    index: number,
    zoom: ZoomConfig | undefined,
    shake: ShakeConfig | undefined,
  ): Promise<string> {
    const out = this.outPath(`clip-${index}.mp4`);
    const vf = buildEffectFilter(zoom, shake);

    const args = ["-y", "-i", clip, "-an"];
    if (vf) args.push("-vf", vf);
    args.push("-c:v", "libx264", "-preset", "ultrafast", "-crf", "23", out);

    await run(args);
    return out;
  }

  private async _applyTransitions(
    clips: string[],
    config: TransitionConfig,
    outFile: string,
    trimTo?: number,
  ): Promise<void> {
    const durations = await Promise.all(clips.map((c) => probeDuration(c)));
    const { types, mode, duration: transDur } = config;

    const pickTransition = (index: number): string => {
      if (mode === "random") return types[Math.floor(Math.random() * types.length)]!;
      return types[index % types.length]!;
    };

    const inputArgs: string[] = [];
    for (const clip of clips) inputArgs.push("-i", clip);

    const filterParts: string[] = [];
    let prevLabel = "[0:v]";
    let timeOffset = 0;

    for (let i = 1; i < clips.length; i++) {
      const transition = pickTransition(i - 1);
      timeOffset += durations[i - 1]! - transDur;
      const nextLabel = i === clips.length - 1 ? "[vout]" : `[v${i}]`;
      filterParts.push(
        `${prevLabel}[${i}:v]xfade=transition=${transition}:duration=${transDur}:offset=${timeOffset.toFixed(3)}${nextLabel}`,
      );
      prevLabel = nextLabel;
    }

    const args = [
      "-y",
      ...inputArgs,
      "-filter_complex", filterParts.join(";"),
      "-map", "[vout]",
      "-an",
      "-c:v", "libx264",
      "-preset", "ultrafast",
      "-crf", "23",
    ];
    if (trimTo !== undefined) args.push("-t", String(trimTo));
    args.push(outFile);

    await run(args);
  }
}

function buildEffectFilter(zoom: ZoomConfig | undefined, shake: ShakeConfig | undefined): string {
  const factor = zoom?.factor ?? (shake ? 1.05 : 1.0);
  const shakePixels = shake ? shake.intensity * 2 : 0;

  if (factor === 1.0 && shakePixels === 0) return "";

  const scaleFilter = `scale=trunc(iw*${factor}/2)*2:trunc(ih*${factor}/2)*2`;

  const cx = shakePixels > 0
    ? `(iw-iw/${factor})/2+${shakePixels}*sin(t*12)`
    : `(iw-iw/${factor})/2`;
  const cy = shakePixels > 0
    ? `(ih-ih/${factor})/2+${shakePixels}*cos(t*9)`
    : `(ih-ih/${factor})/2`;
  const cropFilter = `crop=trunc(iw/${factor}/2)*2:trunc(ih/${factor}/2)*2:${cx}:${cy}`;

  return `${scaleFilter},${cropFilter}`;
}
