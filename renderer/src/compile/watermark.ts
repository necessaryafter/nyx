import type { Graph } from "../graph";

export interface WatermarkPlan {
  localPath: string; // imagem já baixada
  widthPercent: number;
  opacity: number;
  marginPercent: number;
}

const clamp = (value: number | undefined, min: number, max: number, fallback: number) =>
  Math.min(max, Math.max(min, Number.isFinite(value) ? (value as number) : fallback));

/** A marca d'água vale pro vídeo todo. Sem etapa, sem imagem escolhida ou sem o arquivo baixado: sem marca. */
export function extractWatermark(graph: Graph, localPath: string | undefined): WatermarkPlan | undefined {
  const node = graph.nodes.find((n) => n.type === "ShowWatermark");
  if (!node || node.type !== "ShowWatermark" || !node.config.assetId || !localPath) return undefined;
  return {
    localPath,
    widthPercent: clamp(node.config.widthPercent, 3, 50, 14),
    opacity: clamp(node.config.opacity, 0.1, 1, 1),
    marginPercent: clamp(node.config.marginPercent, 0, 20, 4),
  };
}
