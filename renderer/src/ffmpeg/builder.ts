import { writeFile } from "fs/promises";
import { extname, join } from "path";
import { logger } from "@nyx/shared";
import { run } from "./runner";
import { probeDuration } from "./probe";
import { zoomShakeFilter } from "./filters/zoom";
import { applyTransitions } from "./filters/transition";
import { buildSubtitleFilter } from "./filters/subtitle";
import { prepareOverlayClips, buildOverlayFilterChain } from "./filters/overlay";
import { renderTitleCard } from "./filters/titleCard";
import type { RenderPlan, PendingSfx } from "../compile/index";

const IMAGE_EXTS = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);

function isImage(fileName: string) { return IMAGE_EXTS.has(extname(fileName).toLowerCase()); }

export async function buildVideo(plan: RenderPlan, workDir: string): Promise<string> {
  const { settings } = plan;
  const { width, height, fps, format = "mp4" } = settings;

  logger.info({ width, height, fps }, "builder: starting render");
  const t0 = Date.now();

  const baseVideo = plan.scenes.length > 0
    ? await buildSceneTrack(plan, workDir)
    : await buildPoolTrack(plan, workDir);
    
  logger.info({ ms: Date.now() - t0 }, "builder: base track ready");

  const composited = await composite(baseVideo, plan, workDir, width, height, fps);
  logger.info({ ms: Date.now() - t0 }, "builder: compositing done");

  const mixedAudio = await mixAudio(plan, workDir);
  logger.info({ ms: Date.now() - t0 }, "builder: audio mixed");

  const outFile = join(workDir, `output.${format}`);
  await run([
    "-y",
    "-i", composited,
    "-i", mixedAudio,
    "-map", "0:v:0",
    "-map", "1:a:0",
    "-c:v", "libx264", "-preset", "fast", "-crf", "23",
    "-c:a", "aac",
    "-pix_fmt", "yuv420p",
    "-movflags", "+faststart",
    "-shortest",
    outFile,
  ]);

  logger.info({ ms: Date.now() - t0 }, "builder: final encode done");
  return outFile;
}

async function buildSceneTrack(plan: RenderPlan, workDir: string): Promise<string> {
  const { scenes, camera: { zoom, shake, transition }, settings: { width, height } } = plan;

  const clips = await Promise.all(
    scenes.map(async (scene, i) => {
      const durationSec = (scene.endMs - scene.startMs) / 1000;
      const clipPath = join(workDir, `scene-clip-${i}.mp4`);
      const scaleFilter = buildScaleFilter(scene.fit, width, height);
      const effectFilter = zoomShakeFilter(zoom, shake);
      const videoFilter = [scaleFilter, effectFilter].filter(Boolean).join(",");

      const startSec = scene.startMs / 1000;

      if (isImage(scene.localPath)) {
        await run([
          "-y", "-loop", "1", "-i", scene.localPath,
          "-vf", videoFilter || scaleFilter,
          "-t", String(durationSec),
          "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "ultrafast", "-an",
          clipPath,
        ]);
      } else {
        // -ss before -i = fast input seek (keyframe-accurate, no slow decode)
        const args = ["-y", "-ss", String(startSec), "-i", scene.localPath, "-t", String(durationSec), "-an"];
        if (videoFilter) args.push("-vf", videoFilter);

        args.push("-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "ultrafast", clipPath);
        await run(args);
      }

      return clipPath;
    }),
  );

  const outFile = join(workDir, "base-scenes.mp4");

  if (transition && clips.length > 1) {
    await applyTransitions(clips, transition, outFile);
  } else {
    const concatFile = join(workDir, "scenes-concat.txt");
    await writeFile(concatFile, clips.map((p) => `file '${p}'`).join("\n"));
    await run(["-y", "-f", "concat", "-safe", "0", "-i", concatFile, "-c:v", "copy", "-an", outFile]);
  }

  return outFile;
}

async function buildPoolTrack(plan: RenderPlan, workDir: string): Promise<string> {
  const { pool: { paths: mediaPool, mode: poolMode }, camera: { zoom, shake, transition }, audioPath, settings: { width, height } } = plan;

  if (mediaPool.length === 0) throw new Error("builder: no media pool and no scenes");

  const targetDuration = await probeDuration(audioPath);
  const resolvedPool = await Promise.all(
    mediaPool.map(async (fileName: string, index: number) => {
      if (!isImage(fileName)) {
        // Trim video to audio length before any further processing (stream copy = instant)
        const trimPath = join(workDir, `pool-vid-${index}.mp4`);
        await run(["-y", "-i", fileName, "-t", String(targetDuration), "-c:v", "copy", "-an", trimPath]);
        return trimPath;
      }
      const clipPath = join(workDir, `pool-img-${index}.mp4`);
      const clipDur = targetDuration / mediaPool.filter((p: string) => isImage(p)).length;
      const frames = Math.ceil(clipDur * 30);

      await run([
        "-y", "-loop", "1", "-i", fileName,
        "-vf", `scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},zoompan=z='min(zoom+0.0003,1.05)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${frames}:s=${width}x${height}:fps=30`,
        "-t", String(clipDur),
        "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "ultrafast", "-an",
        clipPath,
      ]);

      return clipPath;
    }),
  );

  const durations = await Promise.all(resolvedPool.map((p) => probeDuration(p)));

  const playlist: string[] = [];
  let total = 0;
  if (poolMode === "random-loop") {
    while (total < targetDuration) {
      const idx = Math.floor(Math.random() * resolvedPool.length);
      playlist.push(resolvedPool[idx]!);
      total += durations[idx]!;
    }
  } else {
    let i = 0;

    while (total < targetDuration) {
      const index = i % resolvedPool.length;

      playlist.push(resolvedPool[index]!);
      total += durations[index]!;
      i++;
    }
  }

  // Apply zoom/shake per unique clip, capped at targetDuration — no point encoding
  // beyond what the final output uses (e.g. a 50-min source for a 5-min audio).
  let processedPlaylist = playlist;
  if (zoom || shake) {
    const vf = zoomShakeFilter(zoom, shake);
    const uniqueClips = [...new Set(playlist)];
    const processedMap = new Map<string, string>();
    await Promise.all(
      uniqueClips.map(async (clip, i) => {
        const out = join(workDir, `pool-clip-${i}.mp4`);
        await run(["-y", "-i", clip, "-vf", vf, "-c:v", "libx264", "-preset", "ultrafast", "-crf", "23", "-an", out]);
        processedMap.set(clip, out);
      }),
    );
    processedPlaylist = playlist.map((clip) => processedMap.get(clip)!);
  }

  const outFile = join(workDir, "base-pool.mp4");

  if (transition && processedPlaylist.length > 1) {
    await applyTransitions(processedPlaylist, transition, outFile, targetDuration);
  } else {
    const concatFile = join(workDir, "pool-concat.txt");

    await writeFile(concatFile, processedPlaylist.map((p) => `file '${p}'`).join("\n"));
    const args = ["-y", "-f", "concat", "-safe", "0", "-i", concatFile, "-c:v", "copy", "-an"];
    args.push("-t", String(targetDuration), outFile);
    await run(args);
  }

  return outFile;
}

async function composite(
  baseVideo: string,
  plan: RenderPlan,
  workDir: string,
  width: number,
  height: number,
  fps: number,
): Promise<string> {
  const scaleFilter = `scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},fps=${fps}`;

  const titleCard = plan.titleCard ? await renderTitleCard(plan.titleCard, workDir, width, height) : undefined;
  // Enquanto o card está na tela o título já aparece nele, então a legenda começa depois.
  const subtitleTimestamps = plan.titleCard ? plan.timestamps.slice(plan.titleCard.wordCount) : plan.timestamps;

  const subtitleFilter = plan.subtitles
    ? await buildSubtitleFilter(subtitleTimestamps, plan.subtitles.wordsPerGroup, plan.subtitles.style, width, height, workDir)
    : undefined;

  const preparedOverlays = plan.overlays.length > 0
    ? await prepareOverlayClips(plan.overlays, workDir)
    : [];

  const outFile = join(workDir, "composited.mp4");

  if (preparedOverlays.length === 0 && !subtitleFilter && !titleCard) {
    await run([
      "-y", "-i", baseVideo,
      "-vf", scaleFilter,
      "-c:v", "libx264", "-preset", "fast", "-an",
      outFile,
    ]);

    return outFile;
  }

  const { inputArgs, filterComplex, finalLabel } = buildOverlayFilterChain(preparedOverlays, subtitleFilter, titleCard);

  const scaledLabel = "v_scaled";
  const fullFilter = `[0:v]${scaleFilter}[${scaledLabel}];` +
    filterComplex.replaceAll("[0:v]", `[${scaledLabel}]`);

  await run([
    "-y",
    "-i", baseVideo,
    ...inputArgs,
    "-filter_complex", fullFilter,
    "-map", `[${finalLabel}]`,
    "-c:v", "libx264", "-preset", "fast", "-an",
    outFile,
  ]);

  return outFile;
}

async function mixAudio(plan: RenderPlan, workDir: string): Promise<string> {
  let audioPath = plan.audioPath;

  if (plan.music.paths.length > 0) {
    audioPath = await mixMusic(audioPath, plan.music, workDir);
  }

  if (plan.sfx.length > 0) {
    audioPath = await mixSfx(audioPath, plan.sfx, workDir);
  }

  return audioPath;
}

async function mixMusic(narrationPath: string, music: import("../compile/music").MusicConfig, workDir: string): Promise<string> {
  const { paths: musicPaths, volume, mode, fadeInMs, fadeOutMs } = music;
  const narrationDuration = await probeDuration(narrationPath);
  const durations = await Promise.all(musicPaths.map((p) => probeDuration(p)));

  const playlist: string[] = [];
  let total = 0;
  if (mode === "sequential") {
    let i = 0;
    while (total < narrationDuration) {
      const idx = i % musicPaths.length;
      playlist.push(musicPaths[idx]!);
      total += durations[idx]!;
      i++;
    }
  } else {
    while (total < narrationDuration) {
      const idx = Math.floor(Math.random() * musicPaths.length);
      playlist.push(musicPaths[idx]!);
      total += durations[idx]!;
    }
  }

  const concatFile = join(workDir, "music-concat.txt");
  await writeFile(concatFile, playlist.map((p) => `file '${p}'`).join("\n"));

  const concatOut = join(workDir, "music-full.wav");
  await run([
    "-y", "-f", "concat", "-safe", "0", "-i", concatFile,
    "-t", String(narrationDuration),
    "-c:a", "pcm_s16le", concatOut,
  ]);

  const fadeParts: string[] = [`volume=${volume}`];
  if (fadeInMs > 0) fadeParts.push(`afade=t=in:st=0:d=${fadeInMs / 1000}`);
  if (fadeOutMs > 0) fadeParts.push(`afade=t=out:st=${Math.max(0, narrationDuration - fadeOutMs / 1000)}:d=${fadeOutMs / 1000}`);

  const mixedOut = join(workDir, "audio-music.wav");
  await run([
    "-y", "-i", narrationPath, "-i", concatOut,
    "-filter_complex", `[1:a]${fadeParts.join(",")}[bg];[0:a][bg]amix=inputs=2:duration=first:dropout_transition=2[out]`,
    "-map", "[out]", "-c:a", "pcm_s16le", mixedOut,
  ]);

  return mixedOut;
}

async function mixSfx(basePath: string, sfxList: PendingSfx[], workDir: string): Promise<string> {
  const sfxOut = join(workDir, "audio-sfx.wav");

  const inputArgs: string[] = ["-y", "-i", basePath];
  for (const sfx of sfxList) inputArgs.push("-i", sfx.localPath);

  const filterParts: string[] = [];
  for (let i = 0; i < sfxList.length; i++) {
    const delayMs = Math.round(sfxList[i]!.startSec * 1000);
    const volume = sfxList[i]!.volume;
    filterParts.push(`[${i + 1}:a]adelay=${delayMs}|${delayMs},volume=${volume}[sfx${i}]`);
  }

  const mixInputs = ["[0:a]", ...sfxList.map((_, i) => `[sfx${i}]`)].join("");
  filterParts.push(`${mixInputs}amix=inputs=${sfxList.length + 1}:duration=first:normalize=0[out]`);

  await run([
    ...inputArgs,
    "-filter_complex", filterParts.join(";"),
    "-map", "[out]", "-c:a", "pcm_s16le", sfxOut,
  ]);

  return sfxOut;
}

export function buildScaleFilter(fit: "cover" | "contain", w: number, h: number): string {
  return fit === "cover"
    ? `scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h}`
    : `scale=${w}:${h}:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2`;
}
