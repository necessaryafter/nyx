import type { Graph, GraphEdge } from "./graph";
import { withSentry } from "./lib/sentry";
import type { HandleData, HandleInputs } from "./nodes/executor";
import type { BaseNodeExecutor, ExecutionContext } from "./nodes/executor";
import { createExecutor } from "./nodes/factory";

/**
 * Resolve o grafo em níveis topológicos e retorna a lista de níveis,
 * cada nível contendo os node IDs que podem executar em paralelo.
 */
export function topologicalLevels(graph: Graph): string[][] {
  const inDegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();

  for (const node of graph.nodes) {
    inDegree.set(node.id, 0);
    adjacency.set(node.id, []);
  }

  // Usa pares únicos (from→to) para contar in-degrees e construir adjacências.
  // Um node pode ter múltiplas edges para o mesmo destino (ex: videofit→render via video e audio),
  // mas para a ordenação topológica só importa se existe dependência entre os nodes, não quantas edges há.
  const seen = new Set<string>();
  for (const edge of graph.edges) {
    const pair = `${edge.from}→${edge.to}`;
    if (seen.has(pair)) continue;
    seen.add(pair);
    inDegree.set(edge.to, (inDegree.get(edge.to) ?? 0) + 1);
    adjacency.get(edge.from)!.push(edge.to);
  }

  const levels: string[][] = [];
  let queue = [...inDegree.entries()].filter(([, d]) => d === 0).map(([id]) => id);

  while (queue.length > 0) {
    levels.push(queue);

    const next: string[] = [];
    for (const nodeId of queue) {
      for (const neighbor of adjacency.get(nodeId) ?? []) {
        const deg = (inDegree.get(neighbor) ?? 1) - 1;
        inDegree.set(neighbor, deg);
        if (deg === 0) next.push(neighbor);
      }
    }
    queue = next;
  }

  const totalResolved = levels.reduce((sum, l) => sum + l.length, 0);
  if (totalResolved !== graph.nodes.length) {
    throw new Error("graph has a cycle — cannot resolve topological order");
  }

  return levels;
}

/**
 * Coleta os inputs de um node a partir dos outputs dos nodes anteriores,
 * seguindo as edges do grafo.
 */
export function collectInputs(
  nodeId: string,
  edges: GraphEdge[],
  results: Map<string, Record<string, HandleData>>,
): HandleInputs {
  const incoming = edges.filter((e) => e.to === nodeId);
  const inputs: HandleInputs = {};

  // Agrupa edges pelo handle de destino
  const byHandle = new Map<string, GraphEdge[]>();
  for (const edge of incoming) {
    const group = byHandle.get(edge.toHandle) ?? [];
    group.push(edge);
    byHandle.set(edge.toHandle, group);
  }

  for (const [handle, handleEdges] of byHandle) {
    if (handleEdges.length === 1) {
      // Handle com uma única edge: valor direto
      const edge = handleEdges[0]!;
      const source = results.get(edge.from);
      if (!source) throw new Error(`missing output from node ${edge.from}`);
      inputs[handle] = source[edge.fromHandle]!;
    } else {
      // Handle com múltiplas edges: array ordenado por edge.order
      const sorted = [...handleEdges].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      inputs[handle] = sorted.map((edge) => {
        const source = results.get(edge.from);
        if (!source) throw new Error(`missing output from node ${edge.from}`);
        return source[edge.fromHandle]!;
      });
    }
  }

  return inputs;
}

/**
 * Executa o grafo completo: cria executors, resolve ordem, roda nível a nível.
 * Retorna o mapa completo de outputs de todos os nodes.
 */
export async function executeGraph(
  graph: Graph,
  workDir: string,
  context: ExecutionContext = {},
): Promise<Map<string, Record<string, HandleData>>> {
  // Cria executors para cada node
  const executors = new Map<string, BaseNodeExecutor>();
  for (const node of graph.nodes) {
    executors.set(node.id, createExecutor(node, workDir, context));
  }

  // Resolve ordem topológica
  const levels = topologicalLevels(graph);

  // Mapa de outputs: nodeId → { handleName: value }
  const results = new Map<string, Record<string, HandleData>>();
  const nodeTypeMap = new Map(graph.nodes.map(n => [n.id, n.type]));

  // IDs dos nós Subtitle no grafo
  const subtitleNodeIds = graph.nodes
    .filter((n) => n.type === "Subtitle")
    .map((n) => n.id);

  // Executa nível a nível
  for (const level of levels) {
    await Promise.all(
      level.map(async (nodeId) => {
        const executor = executors.get(nodeId)!;
        const inputs = collectInputs(nodeId, graph.edges, results);

        // Inject subtitle filters into Render node automatically,
        // so Subtitle only needs to connect to TTS — no explicit edge to Render required.
        if (nodeTypeMap.get(nodeId) === "Render" && inputs.subtitle == null) {
          const filters = subtitleNodeIds
            .map((sid) => results.get(sid)?.filter as string | undefined)
            .filter(Boolean) as string[];
          if (filters.length > 0) inputs.subtitle = filters.join(",");
        }

        const outputs = await withSentry(
          executor.execute(inputs),
          {
            nodeId,
            nodeType: graph.nodes.find(n => n.id === nodeId)?.type,
            extra: {
              inputs: inputs instanceof Map ? Object.fromEntries(inputs) : inputs
            },
            tags: { node_type: nodeTypeMap.get(nodeId) ?? "unknown" }
          }
        )

        results.set(nodeId, outputs);
      }),
    );
  }

  return results;
}
