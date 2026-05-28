/**
 * OBSOLETE: Graph V1 migration script.
 * Graph V2 is a reset without V1 compatibility. Do not run this for V2 data.
 *
 * Migration: adiciona edge VideoFit.audio → Render.audio em templates antigos.
 *
 * Para cada template:
 *  1. Se já tem a edge VideoFit.audio → Render.audio: skip.
 *  2. Se tem TTS.audio → Render.audio: substitui por VideoFit.audio → Render.audio.
 *  3. Se não tem nenhuma edge de audio para o Render mas tem VideoFit: adiciona a nova edge.
 */
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";

const client = postgres(process.env.DATABASE_URL!);
const db = drizzle(client);

interface GraphEdge {
  id: string;
  from: string;
  fromHandle: string;
  to: string;
  toHandle: string;
  order?: number;
}

interface GraphNode {
  id: string;
  type: string;
}

interface Graph {
  version: number;
  nodes: GraphNode[];
  edges: GraphEdge[];
}

const result = await client`SELECT id, name, graph FROM templates`;

let updated = 0;
let skipped = 0;

for (const row of result) {
  const graph = row.graph as Graph;
  const nodes = graph.nodes ?? [];
  const edges = graph.edges ?? [];

  const videoFitNode = nodes.find((n) => n.type === "VideoFit");
  const renderNode = nodes.find((n) => n.type === "Render");

  if (!videoFitNode || !renderNode) {
    skipped++;
    continue;
  }

  const alreadyHas = edges.some(
    (e) => e.from === videoFitNode.id && e.fromHandle === "audio" && e.to === renderNode.id && e.toHandle === "audio",
  );

  if (alreadyHas) {
    skipped++;
    continue;
  }

  // Remove edge TTS → Render.audio se existir (TTS.audio agora passa por VideoFit)
  const filteredEdges = edges.filter(
    (e) => !(e.to === renderNode.id && e.toHandle === "audio"),
  );

  // Adiciona VideoFit.audio → Render.audio
  const newEdge: GraphEdge = {
    id: `e-videofit-audio-${Date.now()}`,
    from: videoFitNode.id,
    fromHandle: "audio",
    to: renderNode.id,
    toHandle: "audio",
  };

  const newGraph = { ...graph, edges: [...filteredEdges, newEdge] };

  await client`UPDATE templates SET graph = ${JSON.stringify(newGraph)}::jsonb WHERE id = ${row.id}`;

  console.log(`✓ ${row.name} (${row.id})`);
  updated++;
}

console.log(`\nPronto: ${updated} atualizados, ${skipped} ignorados.`);
await client.end();
