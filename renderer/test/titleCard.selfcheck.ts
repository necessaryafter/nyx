/**
 * Auto-checagem do extractTitleCard (job-scheduler): título explícito e
 * duração mínima do card. Não é bun:test — segue o padrão de test/e2e.ts
 * (script rodável direto, sem framework).
 *
 * Run: bun run test/titleCard.selfcheck.ts
 */
import assert from "assert";
import { extractTitleCard } from "../src/compile/titleCard";
import type { Graph, WordTimestamp } from "../src/graph";

function graphWithCard(config: Record<string, unknown>): Graph {
  return {
    version: 2,
    settings: { width: 1080, height: 1920, fps: 30 },
    nodes: [{ id: "card", kind: "action", type: "ShowTitleCard", config } as never],
    edges: [],
  };
}

const shortWords: WordTimestamp[] = [
  { word: "Parte", startMs: 0, endMs: 200 },
  { word: "2.", startMs: 200, endMs: 400 },
  { word: "resto", startMs: 400, endMs: 800 },
];

// 1. Sem título explícito: deriva da primeira frase da narração (comportamento original).
{
  const words: WordTimestamp[] = [
    { word: "Eu", startMs: 0, endMs: 100 },
    { word: "sou", startMs: 100, endMs: 300 },
    { word: "o", startMs: 300, endMs: 350 },
    { word: "babaca?", startMs: 350, endMs: 900 },
  ];
  const plan = extractTitleCard(graphWithCard({}), words);
  assert(plan, "plan deveria existir");
  assert.strictEqual(plan.title, "Eu sou o babaca?");
  assert.strictEqual(plan.wordCount, 4);
}

// 2. Título explícito (scheduler) substitui o derivado da narração.
{
  const plan = extractTitleCard(graphWithCard({ title: "Um título — Parte 2" }), shortWords);
  assert(plan, "plan deveria existir");
  assert.strictEqual(plan.title, "Um título — Parte 2");
}

// 3. minDurationMs garante um piso, mesmo quando a fala é curtíssima ("Parte 2.").
{
  const plan = extractTitleCard(graphWithCard({ title: "T — Parte 2", minDurationMs: 2500 }), shortWords);
  assert(plan, "plan deveria existir");
  const durationSeconds = plan.endSeconds - plan.startSeconds;
  assert(durationSeconds >= 2.5, `duração deveria ser >= 2.5s, veio ${durationSeconds}`);
}

// 4. Sem minDurationMs, o card não fica maior que o necessário (usa o default de 1.5s como piso).
{
  const plan = extractTitleCard(graphWithCard({ title: "T — Parte 2" }), shortWords);
  assert(plan, "plan deveria existir");
  const durationSeconds = plan.endSeconds - plan.startSeconds;
  assert(durationSeconds >= 1.5, `duração deveria respeitar o piso default de 1.5s, veio ${durationSeconds}`);
}

console.log("titleCard.selfcheck: ok");
