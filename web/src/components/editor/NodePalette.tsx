import { useCallback } from "react";
import {
  Database,
  Film,
  Mic,
  Scissors,
  Captions,
  Layers,
  Clapperboard,
  ImagePlay,
  ChevronLeft,
  ChevronRight,
  Shuffle,
  ZoomIn,
  Waves,
} from "lucide-react";
import { cn } from "../../lib/cn";
import type { NodeType } from "../../lib/types";

const NODE_SECTIONS = [
  {
    label: "Fontes",
    nodes: [
      {
        type: "MediaPool" as NodeType,
        label: "MediaPool",
        desc: "Pool de mídia (vídeo/áudio/imagem)",
        icon: Database,
        color: "text-nyx-cyan-500",
      },
      {
        type: "SceneSlot" as NodeType,
        label: "SceneSlot",
        desc: "Slot de cena por render",
        icon: Film,
        color: "text-nyx-cyan-500",
      },
      {
        type: "TTS" as NodeType,
        label: "TTS",
        desc: "Text-to-Speech",
        icon: Mic,
        color: "text-nyx-cyan-500",
      },
    ],
  },
  {
    label: "Processamento",
    nodes: [
      {
        type: "VideoFit" as NodeType,
        label: "VideoFit",
        desc: "Monta vídeo a partir de pool",
        icon: Scissors,
        color: "text-nyx-orange-500",
      },
      {
        type: "Subtitle" as NodeType,
        label: "Subtitle",
        desc: "Legendas com timing",
        icon: Captions,
        color: "text-nyx-orange-500",
      },
    ],
  },
  {
    label: "Efeitos",
    nodes: [
      {
        type: "Transition" as NodeType,
        label: "Transition",
        desc: "Transição entre clipes",
        icon: Shuffle,
        color: "text-violet-400",
      },
      {
        type: "Zoom" as NodeType,
        label: "Zoom",
        desc: "Zoom uniforme nos clipes",
        icon: ZoomIn,
        color: "text-violet-400",
      },
      {
        type: "Shake" as NodeType,
        label: "Shake",
        desc: "Camera shake nos clipes",
        icon: Waves,
        color: "text-violet-400",
      },
    ],
  },
  {
    label: "Composição",
    nodes: [
      {
        type: "Layer" as NodeType,
        label: "Layer",
        desc: "Camadas",
        icon: Layers,
        color: "text-cyan-400",
      },
      {
        type: "Overlay" as NodeType,
        label: "Overlay",
        desc: "Imagem/vídeo com timing",
        icon: ImagePlay,
        color: "text-cyan-400",
      },
    ],
  },
  {
    label: "Output",
    nodes: [
      {
        type: "Render" as NodeType,
        label: "Render",
        desc: "Saída final",
        icon: Clapperboard,
        color: "text-nyx-orange-400",
      },
    ],
  },
];

interface NodePaletteProps {
  collapsed: boolean;
  onToggle: () => void;
  onDragStart: (type: NodeType) => void;
}

export function NodePalette({
  collapsed,
  onToggle,
  onDragStart,
}: NodePaletteProps) {
  const handleDragStart = useCallback(
    (e: React.DragEvent, type: NodeType) => {
      e.dataTransfer.setData("application/nyx-node-type", type);
      e.dataTransfer.effectAllowed = "move";
      onDragStart(type);
    },
    [onDragStart],
  );

  return (
    <div
      className={cn(
        "flex h-full flex-col border-r border-nyx-border bg-nyx-deep transition-[width] duration-250",
        collapsed ? "w-12" : "w-[220px]",
      )}
    >
      {/* Toggle */}
      <button
        onClick={onToggle}
        className="flex h-10 w-full items-center justify-center border-b border-nyx-border text-nyx-text-muted hover:bg-nyx-hover hover:text-nyx-text-primary"
        title={collapsed ? "Expandir paleta" : "Colapsar paleta"}
      >
        {collapsed ? (
          <ChevronRight className="h-4 w-4" />
        ) : (
          <ChevronLeft className="h-4 w-4" />
        )}
      </button>

      {/* Nodes */}
      <div className="flex-1 overflow-y-auto py-3">
        {NODE_SECTIONS.map((section) => (
          <div key={section.label} className="mb-4">
            {!collapsed && (
              <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-wider text-nyx-text-muted">
                {section.label}
              </p>
            )}
            <div className="space-y-1 px-2">
              {section.nodes.map((node) => (
                <div
                  key={node.type}
                  draggable
                  onDragStart={(e) => handleDragStart(e, node.type)}
                  title={collapsed ? `${node.label} — ${node.desc}` : undefined}
                  className={cn(
                    "flex cursor-grab items-center gap-2.5 rounded-lg border border-nyx-border bg-nyx-surface p-2.5 transition-all duration-100 active:cursor-grabbing",
                    "hover:border-nyx-hover hover:shadow-md",
                    collapsed && "justify-center",
                  )}
                >
                  <node.icon className={cn("h-4 w-4 shrink-0", node.color)} />
                  {!collapsed && (
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-nyx-text-primary">
                        {node.label}
                      </p>
                      <p className="text-[10px] text-nyx-text-muted">{node.desc}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
