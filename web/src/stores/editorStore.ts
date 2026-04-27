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
import type { NodeType, GraphNode, GraphEdge } from "../lib/types";
import { NODE_DEFINITIONS } from "../lib/nodeDefaults";

function genId(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 12);
}

type GraphSnapshot = { nodes: Node[]; edges: Edge[] };

export interface ValidationResult {
  valid: boolean;
  warnings: string[];
  errors: string[];
}

function validate(nodes: Node[], edges: Edge[]): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const renderNodes = nodes.filter((n) => n.data?.type === "Render");
  if (renderNodes.length === 0) errors.push("Nenhum node Render encontrado");
  if (renderNodes.length > 1) errors.push("Apenas um node Render é permitido");

  if (renderNodes.length === 1) {
    const renderId = renderNodes[0].id;
    const renderInputs = edges.filter((e) => e.target === renderId);
    const hasVideo = renderInputs.some((e) => e.targetHandle === "video");
    const hasAudio = renderInputs.some((e) => e.targetHandle === "audio");
    if (!hasVideo) errors.push("Render: input 'video' não conectado");
    if (!hasAudio) errors.push("Render: input 'audio' não conectado");
  }

  // Check VideoPool has assets
  nodes
    .filter((n) => n.data?.type === "VideoPool")
    .forEach((n) => {
      const config = n.data?.config as { assetIds?: string[] };
      if (!config?.assetIds?.length) warnings.push(`VideoPool: nenhum vídeo no pool`);
    });

  // Check MusicPool has assets
  nodes
    .filter((n) => n.data?.type === "MusicPool")
    .forEach((n) => {
      const config = n.data?.config as { assetIds?: string[] };
      if (!config?.assetIds?.length) warnings.push(`MusicPool: nenhuma música no pool`);
    });

  return {
    valid: errors.length === 0,
    warnings,
    errors,
  };
}

export function graphToFlow(
  graphNodes: GraphNode[],
  graphEdges: GraphEdge[],
): { nodes: Node[]; edges: Edge[] } {
  const spacing = { x: 280, y: 140 };
  const typeOrder = ["MediaPool", "SceneSlot", "TTS", "VideoFit", "Subtitle", "Transition", "Zoom", "Shake", "Layer", "Overlay", "Render"];

  const nodes: Node[] = graphNodes.map((gn, i) => {
    const col = typeOrder.indexOf(gn.type);
    return {
      id: gn.id,
      type: gn.type,
      position: { x: (col >= 0 ? col : i) * spacing.x, y: 50 },
      data: { type: gn.type, config: gn.config },
    };
  });

  const edges: Edge[] = graphEdges.map((ge) => ({
    id: ge.id,
    source: ge.from,
    sourceHandle: ge.fromHandle,
    target: ge.to,
    targetHandle: ge.toHandle,
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
    type: n.data?.type as NodeType,
    config: n.data?.config ?? {},
  })) as GraphNode[];

  const graphEdges = edges.map((e) => ({
    id: e.id,
    from: e.source,
    fromHandle: e.sourceHandle ?? "",
    to: e.target,
    toHandle: e.targetHandle ?? "",
  })) as GraphEdge[];

  return { graphNodes, graphEdges };
}

interface EditorStore {
  // Graph state
  nodes: Node[];
  edges: Edge[];

  // Selection
  selectedNodeId: string | null;

  // History
  past: GraphSnapshot[];
  future: GraphSnapshot[];

  // UI
  isPaletteCollapsed: boolean;
  isGridVisible: boolean;
  isSnapEnabled: boolean;

  // Template metadata
  templateId: string | null;
  templateName: string;
  isDirty: boolean;
  lastSavedAt: Date | null;

  // Render modal
  isRenderModalOpen: boolean;

  // Preview modal
  isPreviewOpen: boolean;

  // Actions
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
  openPreview: () => void;
  closePreview: () => void;
  markSaved: () => void;
  validate: () => ValidationResult;
}

export const useEditorStore = create<EditorStore>((set, get) => ({
  nodes: [],
  edges: [],
  selectedNodeId: null,
  past: [],
  future: [],
  isPaletteCollapsed: false,
  isGridVisible: true,
  isSnapEnabled: false,
  templateId: null,
  templateName: "Novo Template",
  isDirty: false,
  lastSavedAt: null,
  isRenderModalOpen: false,
  isPreviewOpen: false,

  setNodes: (nodes) => set({ nodes, isDirty: true }),
  setEdges: (edges) => set({ edges, isDirty: true }),

  onNodesChange: (changes) =>
    set((s) => ({ nodes: applyNodeChanges(changes, s.nodes), isDirty: true })),

  onEdgesChange: (changes) =>
    set((s) => ({ edges: applyEdgeChanges(changes, s.edges), isDirty: true })),

  onConnect: (connection) => {
    get().snapshot();
    set((s) => ({
      edges: rfAddEdge(
        {
          ...connection,
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
    const id = genId();
    const defaultConfig = NODE_DEFINITIONS[type]?.defaultConfig ?? {};
    const newNode: Node = {
      id,
      type,
      position,
      data: { type, config: defaultConfig },
    };
    set((s) => ({ nodes: [...s.nodes, newNode], isDirty: true }));
  },

  removeNode: (id) => {
    get().snapshot();
    set((s) => ({
      nodes: s.nodes.filter((n) => n.id !== id),
      edges: s.edges.filter((e) => e.source !== id && e.target !== id),
      selectedNodeId: s.selectedNodeId === id ? null : s.selectedNodeId,
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
    const prev = past[past.length - 1];
    set({
      nodes: prev.nodes,
      edges: prev.edges,
      past: past.slice(0, -1),
      future: [{ nodes, edges }, ...future],
      isDirty: true,
    });
  },

  redo: () => {
    const { future, nodes, edges, past } = get();
    if (future.length === 0) return;
    const next = future[0];
    set({
      nodes: next.nodes,
      edges: next.edges,
      past: [...past, { nodes, edges }],
      future: future.slice(1),
      isDirty: true,
    });
  },

  setTemplateName: (name) => set({ templateName: name, isDirty: true }),
  setTemplateId: (id) => set({ templateId: id }),

  loadGraph: (nodes, edges) =>
    set({ nodes, edges, isDirty: false, past: [], future: [] }),

  togglePalette: () => set((s) => ({ isPaletteCollapsed: !s.isPaletteCollapsed })),
  toggleGrid: () => set((s) => ({ isGridVisible: !s.isGridVisible })),
  toggleSnap: () => set((s) => ({ isSnapEnabled: !s.isSnapEnabled })),
  openRenderModal: () => set({ isRenderModalOpen: true }),
  closeRenderModal: () => set({ isRenderModalOpen: false }),
  openPreview: () => set({ isPreviewOpen: true }),
  closePreview: () => set({ isPreviewOpen: false }),
  markSaved: () => set({ isDirty: false, lastSavedAt: new Date() }),

  validate: () => validate(get().nodes, get().edges),
}));
