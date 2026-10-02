import type { Graph, ShowTitleCardConfig, TitleCardField, WordTimestamp } from "../graph";

export interface TitleCardPlan {
  config: ShowTitleCardConfig;
  title: string;
  startSeconds: number;
  endSeconds: number;
  /** Palavras que formam o título — ficam fora da legenda enquanto o card está na tela. */
  wordCount: number;
  /** Imagem do avatar já baixada (o worker preenche); sem ela o card desenha a letra do subreddit. */
  avatarPath?: string;
}

const SUBREDDITS = ["r/relatos", "r/confissoes", "r/desabafos", "r/historiasreais", "r/causos", "r/segredos", "r/vidaadulta", "r/tretas"];
const FIRST_NAMES = ["marcos", "julia", "pedro", "ana", "lucas", "carla", "rafael", "bia", "thiago", "paula"];
const LAST_NAMES = ["silva", "costa", "souza", "lima", "rocha", "alves", "pereira", "dias"];
const FLAIRS = ["RELATO", "CONFISSÃO", "DESABAFO", "DESABAFO ANÔNIMO", "HISTÓRIA REAL"];
const TIME_AGO = ["há 2h", "há 3h", "há 5h", "há 6h", "há 8h", "há 12h", "há 1 dia"];

/**
 * Preenche os campos automáticos (config.auto) que estiverem vazios, para o card não repetir sempre os
 * mesmos valores. Campo com valor nunca é trocado. `rand` injetável só pra teste.
 */
export function resolveCardConfig(config: ShowTitleCardConfig, rand: () => number = Math.random): ShowTitleCardConfig {
  const pick = <T,>(list: T[]) => list[Math.floor(rand() * list.length)]!;
  const generators: Record<TitleCardField, () => string> = {
    subreddit: () => pick(SUBREDDITS),
    username: () => `u/${pick(FIRST_NAMES)}_${pick(LAST_NAMES)}_${10 + Math.floor(rand() * 90)}`,
    timeAgo: () => pick(TIME_AGO),
    flair: () => pick(FLAIRS),
    upvotes: () => `${Math.round((2 + rand() * 30) * 10) / 10}k`,
    comments: () => String(Math.round(80 + rand() * 2200)),
  };
  const out = { ...config };
  for (const field of config.auto ?? []) {
    if (!out[field]?.trim()) out[field] = generators[field]?.();
  }
  return out;
}

/** O título é a primeira frase da narração; o card dura enquanto ela é falada. */
export function extractTitleCard(graph: Graph, timestamps: WordTimestamp[]): TitleCardPlan | undefined {
  const node = graph.nodes.find((n) => n.type === "ShowTitleCard");
  if (!node || node.type !== "ShowTitleCard" || timestamps.length === 0) return undefined;

  const last = timestamps.findIndex((w) => /[.!?…]["'”’)]*$/.test(w.word));
  const wordCount = last === -1 ? timestamps.length : last + 1;
  const words = timestamps.slice(0, wordCount);

  const naturalEndSeconds = words[words.length - 1]!.endMs / 1000 + 0.15;
  const minDurationSeconds = (node.config.minDurationMs ?? 1500) / 1000;

  return {
    config: resolveCardConfig(node.config),
    // Título explícito (job-scheduler, ex. "Título — Parte 2") pula a derivação;
    // senão, título de post normalmente não termina em ponto final.
    title: node.config.title ?? words.map((w) => w.word).join(" ").replace(/\.$/, ""),
    startSeconds: 0,
    // ponytail: minDurationMs só estende o card, não recalcula wordCount pras
    // palavras ditas durante essa folga — overlap breve e cosmético com a
    // legenda; upgrade se incomodar: contar palavras por endSeconds final.
    endSeconds: Math.max(naturalEndSeconds, minDurationSeconds),
    wordCount,
  };
}
