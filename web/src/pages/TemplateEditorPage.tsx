import { useEffect, useCallback, useRef, useState } from "react";
import { useParams, useLocation, Link, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  MiniMap,
  Panel as FlowPanel,
  useReactFlow,
  type MiniMapNodeProps,
} from "@xyflow/react";
import { Panel, Group as PanelGroup, Separator as PanelResizeHandle } from "react-resizable-panels";
import {
  ArrowLeft,
  Check,
  AlertCircle,
  Play,
  Monitor,
  Undo2,
  Redo2,
  Grid3x3,
  Maximize2,
  X,
} from "lucide-react";
import "@xyflow/react/dist/style.css";

import { useEditorStore, graphToFlow, flowToGraph } from "../stores/editorStore";
import { nodeTypes } from "../components/editor/nodes";
import { NodePalette } from "../components/editor/NodePalette";
import { PropertiesPanel } from "../components/editor/PropertiesPanel";
import { ValidationBar } from "../components/editor/ValidationBar";
import { cn } from "../lib/cn";
import { api } from "../lib/api";
import { DEFAULT_GRAPH } from "../lib/defaultGraph";
import { NODE_DEFINITIONS } from "../lib/nodeDefaults";
import type { NodeType, TemplateWithGraph } from "../lib/types";

const AUTO_SAVE_INTERVAL = 30_000;

function SaveStatus() {
  const isDirty = useEditorStore((s) => s.isDirty);
  const lastSavedAt = useEditorStore((s) => s.lastSavedAt);

  if (!isDirty && lastSavedAt) {
    return (
      <motion.span
        key="saved"
        initial={{ opacity: 0, y: -3 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 3 }}
        transition={{ duration: 0.16, ease: [0.25, 1, 0.5, 1] }}
        className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-nyx-text-muted"
      >
        <Check className="h-3 w-3 text-green-400" />
        Sincronizado
      </motion.span>
    );
  }
  if (isDirty) {
    return (
      <motion.span
        key="dirty"
        initial={{ opacity: 0, y: -3 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 3 }}
        transition={{ duration: 0.16, ease: [0.25, 1, 0.5, 1] }}
        className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-orange-400"
      >
        <AlertCircle className="h-3 w-3" />
        Alterações pendentes
      </motion.span>
    );
  }
  return null;
}

function EditorTopBar({ onSave, onCreateJob }: { onSave: () => Promise<void>; onCreateJob: () => void }) {
  const { templateName, setTemplateName, isDirty, templateId, validate } = useEditorStore();
  const validation = validate();
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const handleSave = useCallback(async () => {
    if (saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      await onSave();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao salvar";
      setSaveError(msg);
      setTimeout(() => setSaveError(null), 4000);
    } finally {
      setSaving(false);
    }
  }, [saving, onSave]);

  return (
    <div className="flex h-14 shrink-0 items-center justify-between border-b border-nyx-border bg-nyx-deep px-4 z-20">
      <div className="flex items-center gap-4">
        <Link to="/templates" className="flex items-center gap-1.5 text-xs text-nyx-cyan-500 hover:text-nyx-cyan-400 transition-colors">
          <ArrowLeft className="h-4 w-4" />
          Templates
        </Link>
        <div className="h-4 w-px bg-nyx-border" />
        <input
          type="text"
          value={templateName}
          onChange={(e) => setTemplateName(e.target.value)}
          className="bg-transparent font-display text-sm font-bold text-nyx-text-primary outline-none focus:ring-1 focus:ring-nyx-cyan-500/30 rounded px-1 transition-all"
          placeholder="Nome do template"
        />
        <AnimatePresence mode="wait">
          <SaveStatus />
        </AnimatePresence>
        {saveError && (
          <span className="text-[10px] text-nyx-error font-mono">{saveError}</span>
        )}
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className={cn(
            "flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-semibold transition-all",
            isDirty
              ? "border-nyx-cyan-500 bg-nyx-cyan-500/10 text-nyx-cyan-400 hover:bg-nyx-cyan-500/20 shadow-sm shadow-nyx-cyan-500/10"
              : "border-nyx-border text-nyx-text-muted hover:border-nyx-hover hover:text-nyx-text-secondary",
            "disabled:pointer-events-none disabled:opacity-40"
          )}
        >
          <Check className="h-3 w-3" />
          {saving ? "Salvando..." : "Salvar"}
        </button>

        <button
          onClick={onCreateJob}
          disabled={!validation.valid || !templateId}
          title={!templateId ? "Template não foi criado ainda" : !validation.valid ? "Pipeline inválido" : ""}
          className={cn(
            "flex items-center gap-2 rounded-md px-4 py-1.5 text-xs font-bold uppercase tracking-tight text-white transition-all",
            "bg-nyx-orange-600 hover:bg-nyx-orange-500 shadow-lg shadow-nyx-orange-900/20",
            "disabled:cursor-not-allowed disabled:opacity-30 disabled:grayscale"
          )}
        >
          <Play className="h-3.5 w-3.5 fill-current" />
          Criar vídeo
        </button>
      </div>
    </div>
  );
}

function DeletionRecoveryToast() {
  const deletionNotice = useEditorStore((s) => s.deletionNotice);
  const undo = useEditorStore((s) => s.undo);
  const clearDeletionNotice = useEditorStore((s) => s.clearDeletionNotice);

  return (
    <AnimatePresence>
      {deletionNotice && (
        <motion.div
          key="delete-recovery"
          initial={{ opacity: 0, y: 12, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.98 }}
          transition={{ duration: 0.2, ease: [0.25, 1, 0.5, 1] }}
          className="pointer-events-none absolute bottom-14 left-1/2 z-40 -translate-x-1/2"
        >
          <div className="pointer-events-auto flex items-center gap-3 rounded-lg border border-nyx-border bg-nyx-elevated px-3 py-2 shadow-2xl">
            <span className="text-xs text-nyx-text-secondary">
              {deletionNotice.nodeLabel} removido
              {deletionNotice.edgeCount > 0 ? ` com ${deletionNotice.edgeCount} conexão${deletionNotice.edgeCount > 1 ? "ões" : ""}` : ""}
            </span>
            <button
              onClick={undo}
              className="rounded-md bg-nyx-cyan-500/10 px-2 py-1 text-xs font-semibold text-nyx-cyan-400 hover:bg-nyx-cyan-500/20"
            >
              Desfazer
            </button>
            <button
              onClick={clearDeletionNotice}
              aria-label="Fechar aviso"
              className="rounded p-1 text-nyx-text-muted hover:bg-nyx-hover hover:text-nyx-text-primary"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

const MINIMAP_COLORS: Record<string, string> = {
  NarrationSource: "#06b6d4",
  AssetSource: "#06b6d4",
  SceneSource: "#06b6d4",
  MusicSource: "#06b6d4",
  OnTime: "#f97316",
  OnWord: "#f97316",
  OnSentence: "#f97316",
  OnSilence: "#f97316",
  OnSceneStart: "#f97316",
  OnSceneEnd: "#f97316",
  SetMedia: "#22d3ee",
  ShowOverlay: "#22d3ee",
  SetSubtitleStyle: "#22d3ee",
  PlaySfx: "#22d3ee",
  SetMusic: "#22d3ee",
  CameraEffect: "#22d3ee",
  Render: "#fb923c",
};

function MiniMapNode({ id, x, y, width, height, borderRadius }: MiniMapNodeProps) {
  const type = useEditorStore((s) => s.nodes.find((n) => n.id === id)?.data?.type as NodeType | undefined);
  const color = MINIMAP_COLORS[type ?? ""] ?? "#6b7280";
  const label = type ? NODE_DEFINITIONS[type]?.label ?? type : "";
  const fs = Math.min(8, height * 0.2);
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} rx={borderRadius ?? 4} fill={color} fillOpacity={0.9} />
      {label && width > 68 && height > 26 && (
        <text
          x={x + width / 2} y={y + height / 2}
          textAnchor="middle" dominantBaseline="middle"
          fill="white" fontSize={fs}
          fontFamily="system-ui,sans-serif" fontWeight="700"
          style={{ pointerEvents: "none", userSelect: "none" }}
        >
          {label}
        </text>
      )}
    </g>
  );
}

function EditorCanvas() {
  const { nodes, edges, onNodesChange, onEdgesChange, onConnect, addNode, setSelectedNodeId, isGridVisible } = useEditorStore();
  const { screenToFlowPosition } = useReactFlow();

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const type = e.dataTransfer.getData("application/nyx-node-type") as NodeType;
    if (!type) return;

    const position = screenToFlowPosition({ x: e.clientX, y: e.clientY });
    addNode(type, position);
  }, [screenToFlowPosition, addNode]);

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  return (
    <div className="relative h-full w-full bg-[#09090b]" onDrop={onDrop} onDragOver={onDragOver}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={(_, node) => setSelectedNodeId(node.id)}
        onPaneClick={() => setSelectedNodeId(null)}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.25 }}
        minZoom={0.25}
        maxZoom={1.75}
        snapToGrid
        snapGrid={[10, 10]}
        deleteKeyCode={null}
        connectionLineStyle={{ stroke: "#06b6d4", strokeWidth: 2 }}
        proOptions={{ hideAttribution: true }}
        className="nyx-flow"
      >
        {isGridVisible && (
          <Background
            variant={BackgroundVariant.Lines}
            gap={24}
            size={1}
            color="rgba(255,255,255,0.07)"
            className="nyx-flow-grid"
          />
        )}
        <MiniMap
          style={{ background: "#0c0c0e", border: "1px solid #1f1f23" }}
          maskColor="rgba(0,0,0,0.6)"
          nodeComponent={MiniMapNode}
          zoomable pannable
        />
        <FlowPanel position="bottom-left" className="m-4">
          <CanvasToolbar />
        </FlowPanel>
      </ReactFlow>
    </div>
  );
}

function CanvasToolbar() {
  const { fitView, zoomIn, zoomOut } = useReactFlow();
  const { toggleGrid, undo, redo, isGridVisible } = useEditorStore();

  const btnClass = "p-1.5 text-nyx-text-muted hover:bg-nyx-hover hover:text-nyx-text-primary rounded transition-colors";

  return (
    <div className="flex gap-2 rounded-lg border border-nyx-border bg-nyx-surface p-1 shadow-xl">
      <button onClick={() => zoomIn()} className={btnClass} title="Aumentar Zoom"><span className="text-xs">+</span></button>
      <button onClick={() => zoomOut()} className={btnClass} title="Diminuir Zoom"><span className="text-xs">−</span></button>
      <div className="w-px bg-nyx-border mx-1" />
      <button onClick={() => fitView()} className={btnClass} title="Enquadrar"><Maximize2 className="h-3.5 w-3.5" /></button>
      <button onClick={toggleGrid} className={cn(btnClass, isGridVisible && "text-nyx-cyan-500 bg-nyx-cyan-500/10")} title="Grade"><Grid3x3 className="h-3.5 w-3.5" /></button>
      <div className="w-px bg-nyx-border mx-1" />
      <button onClick={undo} className={btnClass} title="Desfazer"><Undo2 className="h-3.5 w-3.5" /></button>
      <button onClick={redo} className={btnClass} title="Refazer"><Redo2 className="h-3.5 w-3.5" /></button>
    </div>
  );
}

function EditorInner({ templateId }: { templateId: string | undefined }) {
  const store = useEditorStore();
  const navigate = useNavigate();
  const location = useLocation();
  const presetGraph = (location.state as { graph?: unknown } | null)?.graph;
  const [initError, setInitError] = useState<string | null>(null);
  const [initing, setIniting] = useState(true);
  const currentTemplateId = useEditorStore((s) => s.templateId);
  const loadedRef = useRef(false);

  // UseRefs para evitar re-declaração do auto-save toda vez que o state muda
  const stateRef = useRef({
    nodes: store.nodes,
    edges: store.edges,
    templateName: store.templateName,
    isDirty: store.isDirty
  });

  useEffect(() => {
    stateRef.current = {
        nodes: store.nodes,
        edges: store.edges,
        templateName: store.templateName,
        isDirty: store.isDirty
    };
  }, [store.nodes, store.edges, store.templateName, store.isDirty]);

  // Carregamento Inicial
  const runInit = useCallback(async () => {
    setIniting(true);
    setInitError(null);
    try {
      if (templateId) {
        const t = await api.get<TemplateWithGraph>(`/api/templates/${templateId}`);
        store.setTemplateId(t.id);
        store.setTemplateName(t.name);
        const { nodes, edges } = graphToFlow(t.graph.nodes, t.graph.edges);
        store.loadGraph(nodes, edges);
      } else {
        const initialGraph = (presetGraph as typeof DEFAULT_GRAPH | undefined) ?? DEFAULT_GRAPH;
        const t = await api.post<{ id: string; name: string }>("/api/templates", {
          name: "Novo Template",
          graph: initialGraph,
        });
        store.setTemplateId(t.id);
        store.setTemplateName(t.name);
        const { nodes, edges } = graphToFlow(initialGraph.nodes, initialGraph.edges);
        store.loadGraph(nodes, edges);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao conectar com o servidor";
      setInitError(msg);
      console.error("Falha ao inicializar editor:", err);
    } finally {
      setIniting(false);
    }
  }, [templateId]);

  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    runInit();
  }, [runInit]);

  const handleSave = useCallback(async () => {
    const { nodes, edges, templateName } = stateRef.current;
    const currentId = useEditorStore.getState().templateId;
    if (!currentId) throw new Error("Template não encontrado. Recarregue a página");
    const { graphNodes, graphEdges } = flowToGraph(nodes, edges);
    await api.put(`/api/templates/${currentId}`, {
      name: templateName,
      graph: { version: 2, settings: DEFAULT_GRAPH.settings, nodes: graphNodes, edges: graphEdges },
    });
    useEditorStore.getState().markSaved();
  }, []);

  // Auto-save
  useEffect(() => {
    const timer = setInterval(async () => {
      if (!stateRef.current.isDirty) return;
      try { await handleSave(); } catch {}
    }, AUTO_SAVE_INTERVAL);
    return () => clearInterval(timer);
  }, [handleSave]);

  // Ctrl+S
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        handleSave().catch(console.error);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleSave]);

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-nyx-void text-nyx-text-primary">
      <div className="md:hidden flex-1"><MobileGuard /></div>

      <ReactFlowProvider>
        <div className="hidden h-full flex-col md:flex">
          <EditorTopBar onSave={handleSave} onCreateJob={() => currentTemplateId && navigate(`/render/${currentTemplateId}`)} />

          {/* Init loading / error overlay */}
          {(initing || initError) && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-nyx-void/80 backdrop-blur-sm">
              {initing && (
                <p className="text-sm text-nyx-text-muted animate-pulse">Carregando editor...</p>
              )}
              {initError && (
                <div className="flex flex-col items-center gap-4 rounded-2xl border border-nyx-error/30 bg-nyx-surface p-8 text-center shadow-2xl">
                  <AlertCircle className="h-8 w-8 text-nyx-error" />
                  <div>
                    <p className="text-sm font-semibold text-nyx-text-primary">Falha ao conectar</p>
                    <p className="mt-1 text-xs text-nyx-text-muted">{initError}</p>
                  </div>
                  <button
                    onClick={() => { loadedRef.current = false; runInit(); }}
                    className="rounded-lg bg-nyx-cyan-500 px-4 py-2 text-xs font-semibold text-white hover:opacity-90"
                  >
                    Tentar novamente
                  </button>
                </div>
              )}
            </div>
          )}

          <div className="flex-1 min-h-0 h-full">
            <PanelGroup orientation="horizontal" className="h-full">
              <Panel defaultSize={20} minSize={15} className="bg-nyx-deep border-r border-nyx-border">
                <NodePalette
                    collapsed={store.isPaletteCollapsed}
                    onToggle={store.togglePalette}
                    onDragStart={() => {}}
                />
              </Panel>

              <PanelResizeHandle className="w-px bg-nyx-border hover:bg-nyx-cyan-500 transition-colors" />

              <Panel defaultSize={55} minSize={30}>
                <EditorCanvas />
              </Panel>

              <PanelResizeHandle className="w-px bg-nyx-border hover:bg-nyx-cyan-500 transition-colors" />

              <Panel defaultSize={25} minSize={20} className="bg-nyx-deep border-l border-nyx-border">
                <PropertiesPanel />
              </Panel>
            </PanelGroup>
          </div>

          <ValidationBar />
        </div>
      </ReactFlowProvider>
      <DeletionRecoveryToast />
    </div>
  );
}

function MobileGuard() {
  return (
    <div className="flex flex-col items-center justify-center h-full p-10 text-center gap-4">
      <Monitor className="h-12 w-12 text-nyx-border" />
      <h2 className="text-sm font-bold uppercase tracking-widest text-nyx-text-secondary">Apenas desktop</h2>
      <p className="text-xs text-nyx-text-muted">O editor de fluxos exige precisão de mouse e espaço de tela.</p>
      <Link to="/dashboard" className="text-xs text-nyx-cyan-500 underline">Voltar</Link>
    </div>
  );
}

export function TemplateEditorPage() {
  const { id } = useParams<{ id?: string }>();
  return <EditorInner templateId={id} />;
}
