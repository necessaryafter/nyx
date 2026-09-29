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
  assetIds: string[]; // fundo (video/image) desta parte; [] = mantém o que já está no template
  assetMode: "random-loop" | "sequential"; // como o renderer consome esses assetIds
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
 * Decide quais assetIds cada parte da execução recebe. Função pura, um único
 * lugar pra testar as duas opções do scheduler:
 * - randomize=false: ordena por nome (o `mode` sequencial no AssetSource
 *   percorre o array na ordem dada, então ordenar aqui já basta).
 * - noRepeatAcrossParts=true: reparte o pool entre as partes (round-robin,
 *   preserva a ordem relativa) em vez de dar a lista inteira pra todas —
 *   é isso que evita o mesmo vídeo aparecer em partes diferentes do lote.
 *   Sem isso, cada parte recebe o pool inteiro (comportamento de sempre).
 */
export function planPartAssetIds(
  assetIds: string[],
  partsTotal: number,
  opts: { randomize: boolean; noRepeatAcrossParts: boolean; nameById?: Map<string, string> },
): string[][] {
  if (assetIds.length === 0) return Array.from({ length: partsTotal }, () => []);

  const ordered = opts.randomize
    ? assetIds
    : [...assetIds].sort((a, b) => (opts.nameById?.get(a) ?? "").localeCompare(opts.nameById?.get(b) ?? ""));

  if (!opts.noRepeatAcrossParts) {
    return Array.from({ length: partsTotal }, () => ordered);
  }

  const buckets: string[][] = Array.from({ length: partsTotal }, () => []);
  ordered.forEach((id, i) => buckets[i % partsTotal]!.push(id));
  return buckets;
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
      return { ...node, config: { ...node.config, assetIds: ctx.assetIds, mode: ctx.assetMode } };
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
