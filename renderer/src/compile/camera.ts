import type { Graph, ZoomConfig, ShakeConfig, TransitionType } from "../graph";

export interface CameraEffects {
  zoom?: ZoomConfig;
  shake?: ShakeConfig;
  transition?: { types: TransitionType[]; mode: "random" | "sequential"; duration: number };
}

export function extractCamera(graph: Graph): CameraEffects {
  const node = graph.nodes.find((n) => n.type === "CameraEffect");
  if (!node || node.type !== "CameraEffect") return {};

  const { zoom, shake, transition } = node.config;
  return {
    zoom,
    shake,
    transition: transition
      ? { types: transition.types ?? ["fade"], mode: transition.mode ?? "random", duration: transition.duration ?? 0.5 }
      : undefined,
  };
}
