import type { GraphInput } from "../schemas";

export interface SchedulerOverrideContext {
  assetIds: string[]; // fundo (video/image); [] = mantém o que já está no template
  musicAssetIds: string[]; // trilha; [] = mantém o que já está no template
  title: string;
  partIndex: number; // 1-based
  partsTotal: number;
}

/**
 * Aplica a configuração do scheduler sobre o grafo do template, sem persistir
 * nada — o resultado vira o `graph` do job daquela parte. Função pura, fácil
 * de testar: mesma entrada, mesma saída.
 */
export function applySchedulerOverrides(graph: GraphInput, ctx: SchedulerOverrideContext): GraphInput {
  const cardTitle =
    ctx.partsTotal > 1 && ctx.partIndex > 1 ? `${ctx.title} — Parte ${ctx.partIndex}` : ctx.title;

  const nodes = graph.nodes.map((node) => {
    if (node.type === "AssetSource" && (node.config.assetType === "video" || node.config.assetType === "image")) {
      if (ctx.assetIds.length === 0) return node;
      return { ...node, config: { ...node.config, assetIds: ctx.assetIds } };
    }

    if (node.type === "MusicSource") {
      if (ctx.musicAssetIds.length === 0) return node;
      return { ...node, config: { ...node.config, assetIds: ctx.musicAssetIds } };
    }

    if (node.type === "ShowTitleCard") {
      return { ...node, config: { ...node.config, title: cardTitle, minDurationMs: 2500 } };
    }

    return node;
  });

  return { ...graph, nodes };
}
