import type { Node, Edge } from "@xyflow/react";
import { NODE_HANDLES } from "./nodeDefaults";
import type { NodeType } from "./types";

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export function validateGraph(
  nodes: Node[],
  edges: Edge[],
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 1. Exactly 1 Render node
  const renderNodes = nodes.filter((n) => n.type === "Render");
  if (renderNodes.length === 0) {
    errors.push("Nenhum node Render encontrado");
  } else if (renderNodes.length > 1) {
    errors.push("Apenas 1 node Render é permitido");
  }

  // 2. Validate edges reference existing nodes and valid handles
  for (const edge of edges) {
    const sourceNode = nodes.find((n) => n.id === edge.source);
    const targetNode = nodes.find((n) => n.id === edge.target);

    if (!sourceNode) {
      errors.push(`Edge referencia node inexistente: ${edge.source}`);
      continue;
    }
    if (!targetNode) {
      errors.push(`Edge referencia node inexistente: ${edge.target}`);
      continue;
    }

    const sourceType = sourceNode.type as NodeType;
    const targetType = targetNode.type as NodeType;

    if (sourceType && NODE_HANDLES[sourceType]) {
      const validOutputs = NODE_HANDLES[sourceType].outputs;
      if (edge.sourceHandle && !validOutputs.includes(edge.sourceHandle)) {
        errors.push(
          `Handle de saída "${edge.sourceHandle}" inválido para ${sourceType}`,
        );
      }
    }

    if (targetType && NODE_HANDLES[targetType]) {
      const validInputs = NODE_HANDLES[targetType].inputs;
      if (edge.targetHandle && !validInputs.includes(edge.targetHandle)) {
        errors.push(
          `Handle de entrada "${edge.targetHandle}" inválido para ${targetType}`,
        );
      }
    }
  }

  // 3. Render node has video and audio inputs connected
  if (renderNodes.length === 1) {
    const renderId = renderNodes[0].id;
    const renderInputs = edges
      .filter((e) => e.target === renderId)
      .map((e) => e.targetHandle);

    if (!renderInputs.includes("video")) {
      errors.push("Render: input 'video' não conectado");
    }
    if (!renderInputs.includes("audio")) {
      errors.push("Render: input 'audio' não conectado");
    }
    if (!renderInputs.includes("music")) {
      warnings.push("Render: input 'music' não conectado (opcional)");
    }
  }

  // 4. Check for cycles (topological sort)
  const inDegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();
  for (const node of nodes) {
    inDegree.set(node.id, 0);
    adjacency.set(node.id, []);
  }
  for (const edge of edges) {
    const current = inDegree.get(edge.target) ?? 0;
    inDegree.set(edge.target, current + 1);
    adjacency.get(edge.source)?.push(edge.target);
  }

  const queue: string[] = [];
  for (const [id, deg] of inDegree) {
    if (deg === 0) queue.push(id);
  }
  let visited = 0;
  while (queue.length > 0) {
    const current = queue.shift()!;
    visited++;
    for (const neighbor of adjacency.get(current) ?? []) {
      const deg = (inDegree.get(neighbor) ?? 1) - 1;
      inDegree.set(neighbor, deg);
      if (deg === 0) queue.push(neighbor);
    }
  }
  if (visited < nodes.length) {
    errors.push("Ciclo detectado no grafo");
  }

  // 5. Check required configs
  for (const node of nodes) {
    const data = node.data as Record<string, unknown>;
    const config = (data?.config ?? {}) as Record<string, unknown>;
    const type = node.type as NodeType;

    switch (type) {
      case "VideoPool": {
        const assetIds = config.assetIds as string[] | undefined;
        if (!assetIds || assetIds.length === 0) {
          warnings.push(`${type} "${node.id}": nenhum vídeo selecionado`);
        }
        break;
      }
      case "MusicPool": {
        const assetIds = config.assetIds as string[] | undefined;
        if (!assetIds || assetIds.length === 0) {
          warnings.push(`${type} "${node.id}": nenhuma música selecionada`);
        }
        break;
      }
      case "TTS": {
        if (!config.provider) {
          warnings.push(`${type} "${node.id}": provider não configurado`);
        }
        break;
      }
      case "Render": {
        if (!config.width || !config.height || !config.fps) {
          warnings.push(
            `${type} "${node.id}": dimensões ou FPS não configurados`,
          );
        }
        break;
      }
      case "Subtitle": {
        if (!config.wordsPerGroup) {
          warnings.push(
            `${type} "${node.id}": palavras por grupo não configurado`,
          );
        }
        break;
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
