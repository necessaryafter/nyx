import { writeFile } from "fs/promises";
import { BaseNodeExecutor, type HandleData, type HandleInputs } from "./executor";
import { FFmpegBuilder } from "../ffmpeg/builder";
import { run } from "../ffmpeg/runner";
import { probeDuration } from "../ffmpeg/probe";
import { logger } from "@nyx/shared";
import type { SfxData } from "./overlay";

export class RenderExecutor extends BaseNodeExecutor<"Render"> {
  async execute(inputs: HandleInputs): Promise<Record<string, HandleData>> {
    const videoPath = inputs.video as string;
    const narrationPath = inputs.audio as string;
    const rawMusic = inputs.music;
    const rawSfx = inputs.sfx;
    const subtitleFilter = inputs.subtitle as string | undefined;

    const { width, height, fps, format, musicVolume } = this.config;

    const ext = format ?? "mp4";
    const outFile = this.outPath(`final.${ext}`);

    // 1. Mix background music with narration (existing behaviour)
    let audioPath = narrationPath;
    if (rawMusic) {
      const musicPaths = (Array.isArray(rawMusic) ? rawMusic : [rawMusic]) as string[];
      if (musicPaths.length > 0) {
        audioPath = await this.mixAudio(narrationPath, musicPaths, musicVolume ?? 0.15);
      }
    }

    // 2. Mix SFX clips at their timestamps (adelay per clip)
    if (rawSfx) {
      const sfxList = (Array.isArray(rawSfx) ? rawSfx : [rawSfx]) as SfxData[];
      if (sfxList.length > 0) {
        audioPath = await this.mixSfx(audioPath, sfxList);
      }
    }

    logger.info(
      { nodeId: this.nodeId, width, height, fps, format: ext, hasMusic: audioPath !== narrationPath },
      "Render: muxing final output",
    );

    const args = new FFmpegBuilder()
      .input(videoPath)
      .input(audioPath)
      .mapStream("0:v:0")
      .mapStream("1:a:0")
      .videoFilter(subtitleFilter
        ? `scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},fps=${fps},${subtitleFilter}`
        : `scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},fps=${fps}`)
      .codec("v", "libx264")
      .codec("a", "aac")
      .rawArgs("-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-shortest")
      .output(outFile)
      .build();

    await run(args);

    logger.info({ nodeId: this.nodeId, outFile }, "Render: done");

    return { file: outFile };
  }

  /**
   * Concatena músicas aleatoriamente até cobrir a duração da narração,
   * depois mixa narração + música de fundo com volume ajustável.
   */
  private async mixAudio(narrationPath: string, musicPaths: string[], volume: number): Promise<string> {
    const narrationDuration = await probeDuration(narrationPath);

    logger.info(
      { nodeId: this.nodeId, narrationDuration, musicCount: musicPaths.length, volume },
      "Render: mixing background music",
    );

    // Probe music durations
    const durations = await Promise.all(musicPaths.map((p) => probeDuration(p)));

    // Build random playlist to cover narration duration
    const playlist: string[] = [];
    let totalDuration = 0;
    while (totalDuration < narrationDuration) {
      const idx = Math.floor(Math.random() * musicPaths.length);
      playlist.push(musicPaths[idx]!);
      totalDuration += durations[idx]!;
    }

    // Concat music tracks via demuxer
    const concatFile = this.outPath("music-concat.txt");
    await writeFile(concatFile, playlist.map((p) => `file '${p}'`).join("\n"));

    const concatOut = this.outPath("music-concat.wav");
    const concatArgs = new FFmpegBuilder()
      .rawArgs("-f", "concat", "-safe", "0")
      .input(concatFile)
      .duration(narrationDuration)
      .codec("a", "pcm_s16le")
      .output(concatOut)
      .build();

    await run(concatArgs);

    // Mix narration + music: narration at full volume, music at configured volume
    const mixedOut = this.outPath("mixed-audio.wav");
    const mixArgs = new FFmpegBuilder()
      .input(narrationPath)
      .input(concatOut)
      .complexFilter(
        `[1:a]volume=${volume}[bg];[0:a][bg]amix=inputs=2:duration=first:dropout_transition=2[out]`,
      )
      .rawArgs("-map", "[out]")
      .codec("a", "pcm_s16le")
      .output(mixedOut)
      .build();

    await run(mixArgs);

    logger.info({ nodeId: this.nodeId, mixedOut }, "Render: audio mixed");

    return mixedOut;
  }

  /**
   * Mixa efeitos sonoros no áudio principal em seus timestamps corretos.
   * Cada SFX é atrasado via adelay, depois mixado com amix.
   */
  private async mixSfx(basePath: string, sfxList: SfxData[]): Promise<string> {
    logger.info({ nodeId: this.nodeId, sfxCount: sfxList.length }, "Render: mixing SFX");

    const sfxOut = this.outPath("sfx-mixed.wav");

    // Build args: base + each sfx as input
    const ffArgs: string[] = ["-y", "-i", basePath];
    for (const sfx of sfxList) {
      ffArgs.push("-i", sfx.path);
    }

    // For each sfx input, apply adelay then amix all together
    const filterParts: string[] = [];
    for (let i = 0; i < sfxList.length; i++) {
      const delayMs = Math.round(sfxList[i]!.startSec * 1000);
      filterParts.push(`[${i + 1}:a]adelay=${delayMs}|${delayMs}[sfx${i}]`);
    }

    const mixInputs = ["[0:a]", ...sfxList.map((_, i) => `[sfx${i}]`)].join("");
    filterParts.push(`${mixInputs}amix=inputs=${sfxList.length + 1}:duration=first:normalize=0[out]`);

    ffArgs.push(
      "-filter_complex", filterParts.join(";"),
      "-map", "[out]",
      "-c:a", "pcm_s16le",
      sfxOut,
    );

    await run(ffArgs);

    logger.info({ nodeId: this.nodeId, sfxOut }, "Render: SFX mixed");

    return sfxOut;
  }
}
