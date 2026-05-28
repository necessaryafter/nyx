import { useCallback, useState } from "react";
import {
  Captions,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clapperboard,
  Clock,
  Database,
  Film,
  Image,
  ImagePlay,
  Info,
  Mic,
  Music,
  Pilcrow,
  Sparkles,
  StepBack,
  StepForward,
  Volume2,
  VolumeX,
  WholeWord,
} from "lucide-react";
import { cn } from "../../lib/cn";
import { NODE_DEFINITIONS } from "../../lib/nodeDefaults";
import type { NodeType } from "../../lib/types";

const NODE_SECTIONS = [
  {
    label: "Fontes",
    hint: "Materiais de entrada",
    nodes: [
      { type: "NarrationSource" as NodeType, label: "Narração", icon: Mic, color: "text-nyx-cyan-500" },
      { type: "AssetSource" as NodeType, label: "Biblioteca", icon: Database, color: "text-nyx-cyan-500" },
      { type: "SceneSource" as NodeType, label: "Cenas do job", icon: Film, color: "text-nyx-cyan-500" },
      { type: "MusicSource" as NodeType, label: "Trilha", icon: Music, color: "text-nyx-cyan-500" },
    ],
  },
  {
    label: "Reações",
    hint: "Disparos do pipeline",
    nodes: [
      { type: "OnTime" as NodeType, label: "Tempo", icon: Clock, color: "text-nyx-orange-500" },
      { type: "OnWord" as NodeType, label: "Palavra", icon: WholeWord, color: "text-nyx-orange-500" },
      { type: "OnSentence" as NodeType, label: "Frase", icon: Pilcrow, color: "text-nyx-orange-500" },
      { type: "OnSilence" as NodeType, label: "Pausa", icon: VolumeX, color: "text-nyx-orange-500" },
      { type: "OnSceneStart" as NodeType, label: "Início de cena", icon: StepForward, color: "text-nyx-orange-500" },
      { type: "OnSceneEnd" as NodeType, label: "Fim de cena", icon: StepBack, color: "text-nyx-orange-500" },
    ],
  },
  {
    label: "Montagem",
    hint: "Operações de timeline",
    nodes: [
      { type: "SetMedia" as NodeType, label: "Trocar mídia", icon: ImagePlay, color: "text-cyan-400" },
      { type: "ShowOverlay" as NodeType, label: "Overlay", icon: Image, color: "text-cyan-400" },
      { type: "SetSubtitleStyle" as NodeType, label: "Legenda", icon: Captions, color: "text-cyan-400" },
      { type: "PlaySfx" as NodeType, label: "Efeito sonoro", icon: Volume2, color: "text-cyan-400" },
      { type: "SetMusic" as NodeType, label: "Ajustar trilha", icon: Music, color: "text-cyan-400" },
      { type: "CameraEffect" as NodeType, label: "Efeito de câmera", icon: Sparkles, color: "text-cyan-400" },
    ],
  },
  {
    label: "Entrega",
    hint: "Saída renderizável",
    nodes: [
      { type: "Render" as NodeType, label: "Render final", icon: Clapperboard, color: "text-nyx-orange-400" },
    ],
  },
];

interface NodePaletteProps {
  collapsed: boolean;
  onToggle: () => void;
  onDragStart: (type: NodeType) => void;
}

export function NodePalette({ collapsed, onToggle, onDragStart }: NodePaletteProps) {
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(NODE_SECTIONS.map((section) => [section.label, true])),
  );
  const [openHelp, setOpenHelp] = useState<Partial<Record<NodeType, boolean>>>({});

  const handleDragStart = useCallback(
    (e: React.DragEvent, type: NodeType) => {
      e.dataTransfer.setData("application/nyx-node-type", type);
      e.dataTransfer.effectAllowed = "move";
      onDragStart(type);
    },
    [onDragStart],
  );

  return (
    <aside className={cn("flex h-full flex-col border-r border-nyx-border bg-nyx-deep transition-[width] duration-200", collapsed ? "w-12" : "w-full")}>
      <div className="flex h-11 items-center border-b border-nyx-border">
        {!collapsed && (
          <div className="min-w-0 flex-1 px-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-nyx-text-muted">Toolbox</p>
          </div>
        )}
        <button
          onClick={onToggle}
          className="flex h-11 w-11 shrink-0 items-center justify-center text-nyx-text-muted transition-colors hover:bg-nyx-hover hover:text-nyx-text-primary"
          title={collapsed ? "Expandir toolbox" : "Colapsar toolbox"}
          aria-label={collapsed ? "Expandir toolbox" : "Colapsar toolbox"}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto py-2">
        {NODE_SECTIONS.map((section) => {
          const isOpen = collapsed || openSections[section.label] !== false;

          return (
            <section key={section.label} className={cn("px-2.5", collapsed ? "mb-3" : "mb-4")}>
              {!collapsed && (
                <button
                  type="button"
                  onClick={() => setOpenSections((current) => ({ ...current, [section.label]: !isOpen }))}
                  className="mb-1 flex w-full items-center gap-2 rounded px-1 py-1.5 text-left transition-colors hover:bg-nyx-hover"
                >
                  <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 text-nyx-text-muted transition-transform", !isOpen && "-rotate-90")} />
                  <span className="min-w-0 flex-1 text-[11px] font-semibold uppercase tracking-wider text-nyx-text-secondary">
                    {section.label}
                  </span>
                  <span className="font-mono text-[10px] text-nyx-text-muted">{section.nodes.length}</span>
                </button>
              )}

              {isOpen && (
                <>
                  {!collapsed && (
                    <p className="mb-2 px-1 text-[11px] leading-tight text-nyx-text-muted">{section.hint}</p>
                  )}

                  <div className={cn(collapsed ? "space-y-1.5" : "space-y-1")}>
                    {section.nodes.map((node) => {
                      const definition = NODE_DEFINITIONS[node.type];
                      const hasInput = definition.kind !== "source";
                      const hasOutput = definition.kind !== "output";
                      const helpOpen = openHelp[node.type] === true;
                      const title = `${node.label} (${node.type}) - ${definition.description}`;

                      return (
                        <div
                          key={node.type}
                          draggable
                          onDragStart={(e) => handleDragStart(e, node.type)}
                          title={title}
                          className={cn(
                            "group relative rounded-md border border-nyx-border bg-nyx-surface transition-colors duration-100",
                            "hover:border-nyx-hover hover:bg-nyx-elevated",
                            collapsed ? "h-9" : "cursor-grab active:cursor-grabbing",
                          )}
                        >
                          <div className={cn("flex items-center", collapsed ? "h-9 justify-center" : "min-h-9 gap-2 px-2.5 py-2")}>
                            {!collapsed && (
                              <span className="flex w-3 shrink-0 justify-start" aria-hidden="true">
                                {hasInput && <span className="h-2 w-2 rounded-full border border-nyx-border bg-nyx-deep group-hover:border-nyx-cyan-500/60" />}
                              </span>
                            )}

                            <span className={cn("flex shrink-0 items-center justify-center", collapsed ? "h-6 w-6" : "h-6 w-6 rounded bg-nyx-void")}>
                              <node.icon className={cn("h-4 w-4", node.color)} />
                            </span>

                            {!collapsed && (
                              <>
                                <span className="min-w-0 flex-1 truncate text-[13px] font-semibold leading-none text-nyx-text-primary">
                                  {node.label}
                                </span>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setOpenHelp((current) => ({ ...current, [node.type]: !helpOpen }));
                                  }}
                                  onMouseDown={(e) => e.stopPropagation()}
                                  className={cn(
                                    "flex h-6 w-6 shrink-0 items-center justify-center rounded text-nyx-text-muted transition-colors",
                                    helpOpen ? "bg-nyx-hover text-nyx-text-secondary" : "hover:bg-nyx-hover hover:text-nyx-text-primary",
                                  )}
                                  aria-label={helpOpen ? `Ocultar ajuda de ${node.label}` : `Mostrar ajuda de ${node.label}`}
                                >
                                  <Info className="h-3.5 w-3.5" />
                                </button>
                                <span className="flex w-6 shrink-0 items-center justify-end gap-1 opacity-75" aria-hidden="true">
                                  {hasOutput && (
                                    <>
                                      <span className="h-px w-2.5 bg-nyx-border group-hover:bg-nyx-cyan-500/60" />
                                      <span className="h-2 w-2 rounded-full border border-nyx-border bg-nyx-deep group-hover:border-nyx-cyan-500/60" />
                                    </>
                                  )}
                                </span>
                              </>
                            )}
                          </div>

                          {!collapsed && helpOpen && (
                            <p className="border-t border-nyx-border/70 px-8 pb-2 pt-1.5 text-[11px] leading-snug text-nyx-text-muted">
                              {definition.description}
                              <span className="ml-1 font-mono text-[10px] uppercase tracking-wider text-nyx-text-muted/70">
                                {node.type}
                              </span>
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </section>
          );
        })}
      </div>
    </aside>
  );
}
