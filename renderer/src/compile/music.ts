import type { Graph } from "../graph";

export interface MusicConfig {
  paths: string[];
  volume: number;
}

export function extractMusic(graph: Graph, assetMap: Map<string, string>): MusicConfig {
  const volume = graph.settings.musicVolume ?? 0.15;
  const node = graph.nodes.find((n) => n.type === "MusicSource");
  if (!node || node.type !== "MusicSource") return { paths: [], volume };

  const paths = node.config.assetIds.flatMap((id) => {
    const p = assetMap.get(id);
    return p ? [p] : [];
  });

  return { paths, volume };
}
