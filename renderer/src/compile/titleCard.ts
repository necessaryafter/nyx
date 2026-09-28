import type { Graph, ShowTitleCardConfig, WordTimestamp } from "../graph";

export interface TitleCardPlan {
  config: ShowTitleCardConfig;
  title: string;
  startSeconds: number;
  endSeconds: number;
  /** Palavras que formam o título — ficam fora da legenda enquanto o card está na tela. */
  wordCount: number;
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
    config: node.config,
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
