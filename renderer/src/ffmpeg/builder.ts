import { writeFile } from "fs/promises";
import { extname, join } from "path";
import { logger } from "@nyx/shared";
import { run } from "./runner";
import { probeDuration } from "./probe";
import { detectFrozenTail } from "./freeze";
import { zoomShakeFilter } from "./filters/zoom";
import { applyTransitions } from "./filters/transition";
import { buildSubtitleFilter } from "./filters/subtitle";
import { prepareOverlayClips, buildOverlayFilterChain } from "./filters/overlay";
import { renderTitleCard } from "./filters/titleCard";
import { renderWatermark } from "./filters/watermark";
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
    // composite() já encodou o vídeo final — aqui só junta o áudio, sem recodificar.
    "-c:v", "copy",
    "-c:a", "aac",
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

export interface PoolSegment { index: number; seconds: number }

// Monta a sequência de clipes que cobre targetSec. Aleatório = "saco embaralhado":
// usa todos os vídeos uma vez antes de repetir qualquer um. Cada segmento só dura o
// que falta — o último é cortado. overlapSec = duração da transição (xfade come isso
// de cada troca, então cada clipe depois do primeiro precisa durar overlapSec a mais).
export function planPoolSegments(
  durations: number[],
  targetSec: number,
  mode: "random-loop" | "sequential",
  overlapSec = 0,
  random: () => number = Math.random,
): PoolSegment[] {
  const usable = durations.flatMap((d, i) => (d > overlapSec + 0.1 ? [i] : []));
  if (usable.length === 0) throw new Error("builder: nenhum vídeo do pool tem duração utilizável");

  const segments: PoolSegment[] = [];
  let covered = 0;
  let bag: number[] = [];

  while (covered < targetSec - 0.01) {
    if (bag.length === 0) {
      bag = [...usable];
      if (mode === "random-loop") {
        for (let i = bag.length - 1; i > 0; i--) {
          const j = Math.floor(random() * (i + 1));
          [bag[i], bag[j]] = [bag[j]!, bag[i]!];
        }
        // Na virada do saco, não deixa o mesmo vídeo aparecer duas vezes seguidas.
        const last = segments.at(-1)?.index;
        if (bag.length > 1 && bag[0] === last) [bag[0], bag[1]] = [bag[1]!, bag[0]!];
      }
    }

    const index = bag.shift()!;
    const overlap = segments.length === 0 ? 0 : overlapSec;
    const seconds = Math.min(durations[index]!, targetSec - covered + overlap);
    segments.push({ index, seconds });
    covered += seconds - overlap;
  }

  return segments;
}

async function buildPoolTrack(plan: RenderPlan, workDir: string): Promise<string> {
  const { pool: { paths: mediaPool, mode: poolMode, speed: poolSpeed = 1 }, camera: { zoom, shake, transition }, audioPath, settings: { width, height, fps } } = plan;

  if (mediaPool.length === 0) throw new Error("builder: no media pool and no scenes");

  const targetDuration = await probeDuration(audioPath);
  const imageCount = mediaPool.filter(isImage).length;

  // Duração de cada fonte já na timeline final (vídeo acelerado dura menos). Só ffprobe,
  // nada é decodificado aqui.
  const durations = await Promise.all(
    // Vídeo: desconta o final congelado da gravação (imagem parada nos últimos ~1,5s).
    mediaPool.map(async (p) => (isImage(p) ? targetDuration / imageCount : ((await probeDuration(p)) - (await detectFrozenTail(p))) / poolSpeed)),
  );

  const overlap = transition && mediaPool.length > 1 ? transition.duration : 0;
  const segments = planPoolSegments(durations, targetDuration, poolMode, overlap);

  const speedFilter = poolSpeed !== 1 ? `setpts=PTS/${poolSpeed},` : "";
  const effectFilter = zoomShakeFilter(zoom, shake);
  const effect = effectFilter ? `,${effectFilter}` : "";

  // Um clipe por vez, só com a duração que vai ser usada. Normaliza resolução/fps
  // (concat -c copy exige streams idênticos) e já aplica zoom/shake no mesmo passe.
  // Sequencial de propósito: N encodes 1080x1920 em paralelo travavam a máquina.
  const encoded = new Map<string, string>();
  const clips: string[] = [];
  for (const { index, seconds } of segments) {
    const key = `${index}:${seconds.toFixed(3)}`;
    let clipPath = encoded.get(key);
    if (!clipPath) {
      clipPath = join(workDir, `pool-seg-${encoded.size}.mp4`);
      const src = mediaPool[index]!;
      if (isImage(src)) {
        const frames = Math.ceil(seconds * fps);
        await run([
          "-y", "-loop", "1", "-i", src,
          "-vf", `scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},zoompan=z='min(zoom+0.0003,1.05)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${frames}:s=${width}x${height}:fps=${fps}${effect}`,
          "-t", String(seconds),
          "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "ultrafast", "-an",
          clipPath,
        ]);
      } else {
        await run([
          "-y", "-i", src,
          "-vf", `${speedFilter}${buildScaleFilter("cover", width, height)},fps=${fps}${effect}`,
          "-t", String(seconds),
          "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "ultrafast", "-an",
          clipPath,
        ]);
      }
      encoded.set(key, clipPath);
    }
    clips.push(clipPath);
  }

  logger.info({ segments: segments.length, uniqueClips: encoded.size, targetDuration }, "builder: pool segments encoded");

  const outFile = join(workDir, "base-pool.mp4");

  if (overlap > 0 && transition) {
    await applyTransitions(clips, transition, outFile, targetDuration);
  } else {
    const concatFile = join(workDir, "pool-concat.txt");
    await writeFile(concatFile, clips.map((p) => `file '${p}'`).join("\n"));
    await run(["-y", "-f", "concat", "-safe", "0", "-i", concatFile, "-c:v", "copy", "-an", "-t", String(targetDuration), outFile]);
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
  const watermark = plan.watermark ? await renderWatermark(plan.watermark, workDir, width, height) : undefined;
  // Enquanto o card está na tela o título já aparece nele, então a legenda começa depois.
  const subtitleTimestamps = plan.titleCard ? plan.timestamps.slice(plan.titleCard.wordCount) : plan.timestamps;

  const subtitleFilter = plan.subtitles
    ? await buildSubtitleFilter(subtitleTimestamps, plan.subtitles.wordsPerGroup, plan.subtitles.style, width, height, workDir)
    : undefined;

  const preparedOverlays = plan.overlays.length > 0
    ? await prepareOverlayClips(plan.overlays, workDir)
    : [];

  const outFile = join(workDir, "composited.mp4");

  if (preparedOverlays.length === 0 && !subtitleFilter && !titleCard && !watermark) {
    await run([
      "-y", "-i", baseVideo,
      "-vf", scaleFilter,
      "-c:v", "libx264", "-preset", "fast", "-crf", "23", "-pix_fmt", "yuv420p", "-an",
      outFile,
    ]);

    return outFile;
  }

  const { inputArgs, filterComplex, finalLabel } = buildOverlayFilterChain(preparedOverlays, subtitleFilter, titleCard, watermark);

  const scaledLabel = "v_scaled";
  const fullFilter = `[0:v]${scaleFilter}[${scaledLabel}];` +
    filterComplex.replaceAll("[0:v]", `[${scaledLabel}]`);

  await run([
    "-y",
    "-i", baseVideo,
    ...inputArgs,
    "-filter_complex", fullFilter,
    "-map", `[${finalLabel}]`,
    "-c:v", "libx264", "-preset", "fast", "-crf", "23", "-pix_fmt", "yuv420p", "-an",
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
