import type { Graph } from "../graph";
import type { SceneAsset } from "../prepare/scenes";

export interface MediaPool {
  paths: string[];
  mode: "random-loop" | "sequential";
  speed?: number;
}

export function extractMediaPool(
  graph: Graph,
  sceneAssets: SceneAsset[],
  assetMap: Map<string, string>,
): MediaPool {
  if (sceneAssets.length > 0) return { paths: [], mode: "random-loop" };

  const node = graph.nodes.find(
    (n) => n.type === "AssetSource" && n.config.assetType !== "audio",
  );
  if (!node || node.type !== "AssetSource") return { paths: [], mode: "random-loop" };

  const paths = node.config.assetIds.flatMap((id) => {
    const p = assetMap.get(id);
    return p ? [p] : [];
  });

  return { paths, mode: node.config.mode ?? "random-loop", speed: node.config.speed };
}
