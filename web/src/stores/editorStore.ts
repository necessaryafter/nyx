import { create } from "zustand";
import {
  type Node,
  type Edge,
  type XYPosition,
  type Connection,
  addEdge as rfAddEdge,
  applyNodeChanges,
  applyEdgeChanges,
} from "@xyflow/react";
import type { GraphEdge, GraphNode, NodeKind, NodeType } from "../lib/types";
import { NODE_DEFINITIONS } from "../lib/nodeDefaults";

function genId(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 12);
}

type GraphSnapshot = { nodes: Node[]; edges: Edge[] };

export interface ValidationResult {
  valid: boolean;
  warnings: string[];
  errors: string[];
  issues: ValidationIssue[];
}

export interface ValidationIssue {
  id: string;
  level: "error" | "warning";
  message: string;
  nodeId?: string;
  edgeId?: string;
}

export interface DeletionNotice {
  nodeLabel: string;
  edgeCount: number;
}

const NODE_COPY: Partial<Record<NodeType, string>> = {
  NarrationSource: "Narração",
  AssetSource: "Biblioteca",
  SceneSource: "Cenas do job",
  MusicSource: "Trilha",
  OnTime: "Quando tempo passar",
  OnWord: "Quando palavra aparecer",
  OnSentence: "Quando frase terminar",
  OnSilence: "Quando houver pausa",
  OnSceneStart: "Início de cena",
  OnSceneEnd: "Fim de cena",
  SetMedia: "Trocar mídia",
  ShowOverlay: "Mostrar overlay",
  SetSubtitleStyle: "Configurar legenda",
  PlaySfx: "Tocar efeito",
  SetMusic: "Ajustar trilha",
  CameraEffect: "Efeito de câmera",
  ShowTitleCard: "Card de título",
  Render: "Render final",
};

function nodeLabel(type: unknown): string {
  return NODE_COPY[type as NodeType] ?? String(type ?? "node");
}

function edgeRole(sourceKind?: NodeKind, targetKind?: NodeKind): GraphEdge["role"] {
  if (sourceKind === "event" && targetKind === "action") return "trigger";
  if (sourceKind === "source" && targetKind === "output") return "music";
  if (sourceKind === "source" && targetKind === "event") return "narration";
  return undefined;
}

function validate(nodes: Node[], edges: Edge[]): ValidationResult {
  const issues: ValidationIssue[] = [];

  const renderNodes = nodes.filter((n) => n.data?.type === "Render");
  if (renderNodes.length === 0) {
    issues.push({ id: "missing-render", level: "error", message: "Adicione um Render final para definir a saída do vídeo" });
  }
  if (renderNodes.length > 1) {
    issues.push({
      id: "multiple-render",
      level: "error",
      message: "Mantenha apenas um Render final no template",
      nodeId: renderNodes[1]?.id,
    });
  }
  if (!nodes.some((n) => n.data?.type === "NarrationSource")) {
    issues.push({ id: "missing-narration", level: "error", message: "Adicione uma Narração como entrada do template" });
  }
  if (!nodes.some((n) => ["SceneSource", "AssetSource", "SetMedia"].includes(String(n.data?.type)))) {
    issues.push({ id: "missing-visual", level: "error", message: "Adicione Biblioteca, Cenas do job ou Trocar mídia para alimentar o vídeo" });
  }

  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  for (const edge of edges) {
    const sourceKind = nodeMap.get(edge.source)?.data?.kind as NodeKind | undefined;
    const targetKind = nodeMap.get(edge.target)?.data?.kind as NodeKind | undefined;
    const ok =
      (sourceKind === "source" && targetKind === "event") ||
      (sourceKind === "source" && targetKind === "action") ||
      (sourceKind === "event" && targetKind === "action") ||
      (sourceKind === "action" && targetKind === "output") ||
      (sourceKind === "source" && targetKind === "output");
    if (!ok) {
      const source = nodeMap.get(edge.source);
      const target = nodeMap.get(edge.target);
      issues.push({
        id: `invalid-edge-${edge.id}`,
        level: "error",
        message: `Conexão inválida: ${nodeLabel(source?.data?.type)} -> ${nodeLabel(target?.data?.type)}`,
        nodeId: target?.id ?? source?.id,
        edgeId: edge.id,
      });
    }
  }

  const emptyAssetSources = nodes.filter((n) => n.data?.type === "AssetSource" && !((n.data.config as { assetIds?: string[] }).assetIds?.length));
  for (const node of emptyAssetSources) {
    issues.push({
      id: `empty-assets-${node.id}`,
      level: "warning",
      message: "Biblioteca sem mídias selecionadas",
      nodeId: node.id,
    });
  }

  const errors = issues.filter((issue) => issue.level === "error").map((issue) => issue.message);
  const warnings = issues.filter((issue) => issue.level === "warning").map((issue) => issue.message);
  return { valid: errors.length === 0, warnings, errors, issues };
}

export function graphToFlow(
  graphNodes: GraphNode[],
  graphEdges: GraphEdge[],
): { nodes: Node[]; edges: Edge[] } {
  const spacing = { x: 260, y: 130 };
  const typeOrder: NodeType[] = [
    "NarrationSource", "AssetSource", "SceneSource", "MusicSource",
    "OnTime", "OnWord", "OnSentence", "OnSilence", "OnSceneStart", "OnSceneEnd",
    "SetMedia", "ShowOverlay", "SetSubtitleStyle", "PlaySfx", "SetMusic", "CameraEffect", "ShowTitleCard",
    "Render",
  ];

  const nodes: Node[] = graphNodes.map((gn, i) => {
    const col = typeOrder.indexOf(gn.type);
    return {
      id: gn.id,
      type: gn.type,
      position: { x: (col >= 0 ? col : i) * spacing.x, y: 50 + (i % 4) * spacing.y },
      data: { type: gn.type, kind: gn.kind, config: gn.config },
    };
  });

  const edges: Edge[] = graphEdges.map((ge) => ({
    id: ge.id,
    source: ge.from,
    target: ge.to,
    data: { role: ge.role },
    type: "smoothstep",
    animated: true,
    style: { stroke: "#06b6d4", strokeWidth: 2 },
  }));

  return { nodes, edges };
}

export function flowToGraph(
  nodes: Node[],
  edges: Edge[],
): { graphNodes: GraphNode[]; graphEdges: GraphEdge[] } {
  const graphNodes = nodes.map((n) => ({
    id: n.id,
    kind: n.data?.kind as NodeKind,
    type: n.data?.type as NodeType,
    config: n.data?.config ?? {},
  })) as GraphNode[];

  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const graphEdges = edges.map((e) => {
    const data = e.data as { role?: GraphEdge["role"] } | undefined;
    return {
      id: e.id,
      from: e.source,
      to: e.target,
      role: data?.role ?? edgeRole(
        nodeMap.get(e.source)?.data?.kind as NodeKind | undefined,
        nodeMap.get(e.target)?.data?.kind as NodeKind | undefined,
      ),
    };
  }) as GraphEdge[];

  return { graphNodes, graphEdges };
}

interface EditorStore {
  nodes: Node[];
  edges: Edge[];
  selectedNodeId: string | null;
  past: GraphSnapshot[];
  future: GraphSnapshot[];
  isPaletteCollapsed: boolean;
  isGridVisible: boolean;
  isSnapEnabled: boolean;
  templateId: string | null;
  templateName: string;
  isDirty: boolean;
  lastSavedAt: Date | null;
  isRenderModalOpen: boolean;
  deletionNotice: DeletionNotice | null;
  setNodes: (nodes: Node[]) => void;
  setEdges: (edges: Edge[]) => void;
  onNodesChange: (changes: Parameters<typeof applyNodeChanges>[0]) => void;
  onEdgesChange: (changes: Parameters<typeof applyEdgeChanges>[0]) => void;
  onConnect: (connection: Connection) => void;
  addNode: (type: NodeType, position: XYPosition) => void;
  removeNode: (id: string) => void;
  updateNodeConfig: (id: string, config: Record<string, unknown>) => void;
  setSelectedNodeId: (id: string | null) => void;
  undo: () => void;
  redo: () => void;
  snapshot: () => void;
  setTemplateName: (name: string) => void;
  setTemplateId: (id: string) => void;
  loadGraph: (nodes: Node[], edges: Edge[]) => void;
  togglePalette: () => void;
  toggleGrid: () => void;
  toggleSnap: () => void;
  openRenderModal: () => void;
  closeRenderModal: () => void;
  clearDeletionNotice: () => void;
  markSaved: () => void;
  validate: () => ValidationResult;
}

export const useEditorStore = create<EditorStore>((set, get) => ({
  nodes: [],
  edges: [],
  selectedNodeId: null,
  past: [],
  future: [],
  isPaletteCollapsed: true,
  isGridVisible: true,
  isSnapEnabled: false,
  templateId: null,
  templateName: "Novo Template",
  isDirty: false,
  lastSavedAt: null,
  isRenderModalOpen: false,
  deletionNotice: null,

  setNodes: (nodes) => set({ nodes, isDirty: true }),
  setEdges: (edges) => set({ edges, isDirty: true }),
  onNodesChange: (changes) => set((s) => ({ nodes: applyNodeChanges(changes, s.nodes), isDirty: true })),
  onEdgesChange: (changes) => set((s) => ({ edges: applyEdgeChanges(changes, s.edges), isDirty: true })),

  onConnect: (connection) => {
    get().snapshot();
    const nodes = get().nodes;
    const source = nodes.find((n) => n.id === connection.source);
    const target = nodes.find((n) => n.id === connection.target);
    set((s) => ({
      edges: rfAddEdge(
        {
          ...connection,
          data: { role: edgeRole(source?.data?.kind as NodeKind | undefined, target?.data?.kind as NodeKind | undefined) },
          type: "smoothstep",
          animated: true,
          style: { stroke: "#06b6d4", strokeWidth: 2 },
        },
        s.edges,
      ),
      isDirty: true,
    }));
  },

  addNode: (type, position) => {
    get().snapshot();
    const definition = NODE_DEFINITIONS[type];
    const id = genId();
    const newNode: Node = {
      id,
      type,
      position,
      data: { type, kind: definition.kind, config: definition.defaultConfig },
    };
    set((s) => ({ nodes: [...s.nodes, newNode], isDirty: true }));
  },

  removeNode: (id) => {
    get().snapshot();
    set((s) => ({
      nodes: s.nodes.filter((n) => n.id !== id),
      edges: s.edges.filter((e) => e.source !== id && e.target !== id),
      selectedNodeId: s.selectedNodeId === id ? null : s.selectedNodeId,
      deletionNotice: {
        nodeLabel: nodeLabel(s.nodes.find((n) => n.id === id)?.data?.type),
        edgeCount: s.edges.filter((e) => e.source === id || e.target === id).length,
      },
      isDirty: true,
    }));
  },

  updateNodeConfig: (id, config) => {
    set((s) => ({
      nodes: s.nodes.map((n) =>
        n.id === id
          ? { ...n, data: { ...n.data, config: { ...(n.data.config as object), ...config } } }
          : n,
      ),
      isDirty: true,
    }));
  },

  setSelectedNodeId: (id) => set({ selectedNodeId: id }),
  snapshot: () => {
    const { nodes, edges, past } = get();
    set({ past: [...past.slice(-20), { nodes, edges }], future: [] });
  },
  undo: () => {
    const { past, nodes, edges, future } = get();
    if (past.length === 0) return;
    const prev = past[past.length - 1]!;
    set({ nodes: prev.nodes, edges: prev.edges, past: past.slice(0, -1), future: [{ nodes, edges }, ...future], deletionNotice: null, isDirty: true });
  },
  redo: () => {
    const { future, nodes, edges, past } = get();
    if (future.length === 0) return;
    const next = future[0]!;
    set({ nodes: next.nodes, edges: next.edges, past: [...past, { nodes, edges }], future: future.slice(1), isDirty: true });
  },
  setTemplateName: (name) => set({ templateName: name, isDirty: true }),
  setTemplateId: (id) => set({ templateId: id }),
  loadGraph: (nodes, edges) => set({ nodes, edges, isDirty: false, past: [], future: [] }),
  togglePalette: () => set((s) => ({ isPaletteCollapsed: !s.isPaletteCollapsed })),
  toggleGrid: () => set((s) => ({ isGridVisible: !s.isGridVisible })),
  toggleSnap: () => set((s) => ({ isSnapEnabled: !s.isSnapEnabled })),
  openRenderModal: () => set({ isRenderModalOpen: true }),
  closeRenderModal: () => set({ isRenderModalOpen: false }),
  clearDeletionNotice: () => set({ deletionNotice: null }),
  markSaved: () => set({ isDirty: false, lastSavedAt: new Date() }),
  validate: () => validate(get().nodes, get().edges),
}));
