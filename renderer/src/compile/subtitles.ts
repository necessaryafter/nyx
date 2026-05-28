import type { SubtitleStyle } from "../graph";
import type { RenderAction } from "./actions";

export interface SubtitleConfig {
  wordsPerGroup: number;
  style?: SubtitleStyle;
}

export function extractSubtitles(actions: RenderAction[]): SubtitleConfig | undefined {
  const action = actions.find((a) => a.type === "SetSubtitleStyle");
  if (!action) return undefined;

  return {
    wordsPerGroup: (action.params.wordsPerGroup as number | undefined) ?? 3,
    style: action.params.style as SubtitleStyle | undefined,
  };
}
