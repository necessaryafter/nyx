import type { Edge, Node } from "@xyflow/react";
import type { NodeKind } from "./types";

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export function validateGraph(nodes: Node[], edges: Edge[]): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const renderNodes = nodes.filter((n) => n.type === "Render");
  if (renderNodes.length === 0) errors.push("Nenhum node Render encontrado");
  if (renderNodes.length > 1) errors.push("Apenas 1 node Render e permitido");
  if (!nodes.some((n) => n.type === "NarrationSource")) errors.push("Nenhum NarrationSource encontrado");
  if (!nodes.some((n) => ["SceneSource", "AssetSource", "SetMedia"].includes(String(n.type)))) {
    errors.push("Adicione uma fonte visual ou SetMedia");
  }

  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  for (const edge of edges) {
    const source = nodeMap.get(edge.source);
    const target = nodeMap.get(edge.target);
    if (!source || !target) {
      errors.push(`Edge referencia node inexistente: ${edge.id}`);
      continue;
    }
    
    const sourceKind = source.data?.kind as NodeKind | undefined;
    const targetKind = target.data?.kind as NodeKind | undefined;
    const ok =
      (sourceKind === "source" && targetKind === "event") ||
      (sourceKind === "source" && targetKind === "action") ||
      (sourceKind === "event" && targetKind === "action") ||
      (sourceKind === "action" && targetKind === "output") ||
      (sourceKind === "source" && targetKind === "output");
    if (!ok) errors.push(`Conexao invalida: ${source.type} -> ${target.type}`);
  }

  for (const node of nodes) {
    if (node.type === "AssetSource") {
      const config = node.data?.config as { assetIds?: string[] } | undefined;
      if (!config?.assetIds?.length) warnings.push(`${node.id}: AssetSource sem assets`);
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}
