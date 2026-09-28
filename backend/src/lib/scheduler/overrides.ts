import type { GraphInput } from "../schemas";

export interface SchedulerCardContext {
  subreddit: string;
  username: string;
  flair: string;
  upvotes: string;
  comments: string;
  timeAgo: string;
}

export interface SchedulerOverrideContext {
  assetIds: string[]; // fundo (video/image); [] = mantém o que já está no template
  musicAssetIds: string[]; // trilha; [] = mantém o que já está no template
  title: string;
  partIndex: number; // 1-based
  partsTotal: number;
  // Identidade do post (subreddit/usuário/tag vêm da IA, junto do roteiro) — a
  // mesma em todas as partes da execução, mas diferente a cada execução nova,
  // em vez de ficar congelada no template.
  card: SchedulerCardContext;
}

const TIME_AGO_OPTIONS = ["há 2h", "há 3h", "há 5h", "há 6h", "há 8h", "há 12h", "há 1 dia"];

/** Votos/comentários/tempo fake — não precisam vir da IA, só parecer reais e variar a cada execução. */
export function randomEngagement(): Pick<SchedulerCardContext, "upvotes" | "comments" | "timeAgo"> {
  const upvotesK = Math.round((2 + Math.random() * 30) * 10) / 10;
  const comments = Math.round(80 + Math.random() * 2200);
  const timeAgo = TIME_AGO_OPTIONS[Math.floor(Math.random() * TIME_AGO_OPTIONS.length)]!;
  return { upvotes: `${upvotesK}k`, comments: String(comments), timeAgo };
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
      return { ...node, config: { ...node.config, ...ctx.card, title: cardTitle, minDurationMs: 2500 } };
    }

    return node;
  });

  return { ...graph, nodes };
}
