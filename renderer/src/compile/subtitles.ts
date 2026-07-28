import type { Graph, SubtitleStyle } from "../graph";
import type { RenderAction } from "./actions";

export interface SubtitleConfig {
  wordsPerGroup: number;
  style?: SubtitleStyle;
}

export function extractSubtitles(graph: Graph, actions: RenderAction[]): SubtitleConfig | undefined {
  // Prefer event-triggered config (allows dynamic subtitle changes)
  const action = actions.find((a) => a.type === "SetSubtitleStyle");
  if (action) {
    return {
      wordsPerGroup: (action.params.wordsPerGroup as number | undefined) ?? 3,
      style: action.params.style as SubtitleStyle | undefined,
    };
  }

  // Fallback: node present in graph without an event trigger (global subtitle config)
  const node = graph.nodes.find((n) => n.type === "SetSubtitleStyle");
  if (!node || node.type !== "SetSubtitleStyle") return undefined;
  return {
    wordsPerGroup: node.config.wordsPerGroup ?? 3,
    style: node.config.style,
  };
}
