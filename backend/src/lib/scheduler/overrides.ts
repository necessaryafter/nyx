import type { GraphInput, SchedulerNarration } from "../schemas";

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
  backgroundSpeed: number; // velocidade do vídeo de fundo (1 = normal, 1.5 = 50% mais rápido)
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

  if (!opts.noRepeatAcrossParts) {
    const ordered = opts.randomize
      ? assetIds
      : [...assetIds].sort((a, b) => (opts.nameById?.get(a) ?? "").localeCompare(opts.nameById?.get(b) ?? ""));
    return Array.from({ length: partsTotal }, () => ordered);
  }

  // Lista inteira pra cada parte, cada uma começando num bloco diferente (o renderer consome
  // em ordem: assetMode "sequential"). Antes dividia em grupos fixos — 20 vídeos / 5 partes
  // = 4 por parte, que cobriam ~1 min de uma parte de 3 e repetiam 3x dentro dela. Assim
  // nada repete dentro da parte enquanto houver vídeo novo, e entre partes só sobrepõe
  // quando os vídeos não dão pra todas.
  const ordered = opts.randomize
    ? shuffle(assetIds)
    : [...assetIds].sort((a, b) => (opts.nameById?.get(a) ?? "").localeCompare(opts.nameById?.get(b) ?? ""));
  const block = Math.ceil(ordered.length / partsTotal);
  return Array.from({ length: partsTotal }, (_, i) => {
    const start = (i * block) % ordered.length;
    return [...ordered.slice(start), ...ordered.slice(0, start)];
  });
}

function shuffle<T>(list: T[]): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

const CARD_FIELDS = ["subreddit", "username", "flair", "upvotes", "comments", "timeAgo"] as const;

/**
 * Identidade do cartão de uma parte. Template que já usa o "Auto" por campo (config.auto definido): campo
 * fixo (preenchido e fora do auto) vale o do template, e só os automáticos recebem o valor da IA/sorteio.
 * Template antigo (sem config.auto): o scheduler preenche tudo, como sempre foi.
 */
function cardIdentity(templateConfig: { auto?: string[] } & Partial<Record<(typeof CARD_FIELDS)[number], string>>, scheduler: SchedulerCardContext): SchedulerCardContext {
  if (templateConfig.auto === undefined) return scheduler;
  const out = { ...scheduler };
  for (const key of CARD_FIELDS) {
    const fixed = templateConfig[key]?.trim();
    if (fixed && !templateConfig.auto.includes(key)) out[key] = fixed;
  }
  return out;
}

/**
 * Aplica a configuração do scheduler sobre o grafo do template, sem persistir
 * nada — o resultado vira o `graph` do job daquela parte. Função pura, fácil
 * de testar: mesma entrada, mesma saída.
 */
export function applySchedulerOverrides(graph: GraphInput, ctx: SchedulerOverrideContext): GraphInput {
  // Série com várias partes: o card de TODAS leva "— Parte N", inclusive a 1 (assim a 1 combina com as outras).
  // Execução de uma parte só não tem número.
  const cardTitle = ctx.partsTotal > 1 ? `${ctx.title} — Parte ${ctx.partIndex}` : ctx.title;

  const nodes = graph.nodes.map((node) => {
    if (node.type === "AssetSource" && (node.config.assetType === "video" || node.config.assetType === "image")) {
      if (ctx.assetIds.length === 0) return { ...node, config: { ...node.config, speed: ctx.backgroundSpeed } };
      return { ...node, config: { ...node.config, assetIds: ctx.assetIds, mode: ctx.assetMode, speed: ctx.backgroundSpeed } };
    }

    if (node.type === "MusicSource") {
      if (ctx.musicAssetIds.length === 0) return node;
      return { ...node, config: { ...node.config, assetIds: ctx.musicAssetIds } };
    }

    if (node.type === "ShowTitleCard") {
      return { ...node, config: { ...node.config, ...cardIdentity(node.config, ctx.card), title: cardTitle, minDurationMs: 2500 } };
    }

    return node;
  });

  return { ...graph, nodes };
}

type NarrationConfig = Extract<GraphInput["nodes"][number], { type: "NarrationSource" }>["config"];

/**
 * Voz de cada parte: a do scheduler, se tiver, substitui a do template inteira (não mescla —
 * nome de voz do Edge não serve pro Gemini e vice-versa). Provider desconhecido cai em
 * talkify, como sempre foi.
 */
export function resolveSchedulerVoice(template: NarrationConfig | undefined, override: SchedulerNarration | null | undefined) {
  const cfg = override ?? template;
  const provider = cfg?.provider === "edge" || cfg?.provider === "gemini" ? cfg.provider : ("talkify" as const);
  return {
    provider,
    voice: cfg?.voice,
    speed: cfg?.speed,
    model: cfg?.model,
    paceMode: cfg?.paceMode,
    stylePreset: cfg?.stylePreset,
    style: cfg?.style,
  };
}
