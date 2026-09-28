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

  return {
    config: node.config,
    // Título de post normalmente não termina em ponto final.
    title: words.map((w) => w.word).join(" ").replace(/\.$/, ""),
    startSeconds: 0,
    endSeconds: words[words.length - 1]!.endMs / 1000 + 0.15,
    wordCount,
  };
}
