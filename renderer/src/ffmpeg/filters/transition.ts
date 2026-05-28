import type { TransitionType } from "../../graph";
import { run } from "../runner";
import { probeDuration } from "../probe";

export interface TransitionConfig {
  types: TransitionType[];
  mode: "random" | "sequential";
  duration: number;
}

export async function applyTransitions(
  clips: string[],
  config: TransitionConfig,
  outFile: string,
  trimTo?: number,
): Promise<void> {
  if (clips.length === 1) {
    const args = ["-y", "-i", clips[0]!, "-c:v", "copy", "-an"];
    if (trimTo !== undefined) args.push("-t", String(trimTo));
    args.push(outFile);
    await run(args);
    return;
  }

  const durations = await Promise.all(clips.map((c) => probeDuration(c)));
  const { types, mode, duration: transDur } = config;

  const pickTransition = (index: number): string => {
    if (mode === "random") return types[Math.floor(Math.random() * types.length)]!;
    return types[index % types.length]!;
  };

  const inputArgs: string[] = [];
  for (const clip of clips) inputArgs.push("-i", clip);

  const filterParts: string[] = [];
  let previousLabel = "[0:v]";
  let timeOffset = 0;

  for (let i = 1; i < clips.length; i++) {
    const transition = pickTransition(i - 1);
    timeOffset += durations[i - 1]! - transDur;

    const nextLabel = i === clips.length - 1 ? "[vout]" : `[v${i}]`;
    filterParts.push(`${previousLabel}[${i}:v]xfade=transition=${transition}:duration=${transDur}:offset=${timeOffset.toFixed(3)}${nextLabel}`,);
    previousLabel = nextLabel;
  }

  const args = [
    "-y",
    ...inputArgs,
    "-filter_complex", filterParts.join(";"),
    "-map", "[vout]",
    "-an",
    "-c:v", "libx264", "-preset", "ultrafast", "-crf", "23",
  ];
  if (trimTo !== undefined) args.push("-t", String(trimTo));
  args.push(outFile);

  await run(args);
}
