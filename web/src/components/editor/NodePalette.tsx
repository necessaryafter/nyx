import { useCallback, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowRight,
  Captions,
  Clapperboard,
  Clock,
  Database,
  Film,
  Image,
  ImagePlay,
  Info,
  MessageSquareText,
  Mic,
  Music,
  Pilcrow,
  Pin,
  PinOff,
  Sparkles,
  StepBack,
  StepForward,
  Volume2,
  VolumeX,
  WholeWord,
} from "lucide-react";
import { cn } from "../../lib/cn";
import { NODE_DEFINITIONS, NODE_HANDLES } from "../../lib/nodeDefaults";
import type { NodeType } from "../../lib/types";

const HANDLE_LABELS: Record<string, string> = {
  narration: "Narração",
  media: "Mídia",
  scene: "Cenas",
  music: "Trilha",
  event: "Gatilho",
  action: "Ação",
  sfx: "SFX",
  overlay: "Overlay",
  source: "Fonte",
};

const HANDLE_COLORS: Record<string, string> = {
  narration: "bg-nyx-cyan-500/20 text-nyx-cyan-400 border-nyx-cyan-500/30",
  media: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
  scene: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
  music: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  event: "bg-nyx-orange-500/20 text-nyx-orange-400 border-nyx-orange-500/30",
  action: "bg-nyx-orange-400/20 text-nyx-orange-300 border-nyx-orange-400/30",
  sfx: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  overlay: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
  source: "bg-nyx-cyan-500/20 text-nyx-cyan-400 border-nyx-cyan-500/30",
};

function HandleTag({ name }: { name: string }) {
  return (
    <span className={cn("rounded border px-1.5 py-0.5 text-[10px] font-medium", HANDLE_COLORS[name] ?? "bg-nyx-void text-nyx-text-muted border-nyx-border")}>
      {HANDLE_LABELS[name] ?? name}
    </span>
  );
}

function ConnectionHint({ type }: { type: NodeType }) {
  const { inputs, outputs } = NODE_HANDLES[type];
  if (inputs.length === 0 && outputs.length === 0) return null;
  return (
    <div className="mt-2 flex items-center gap-1.5 flex-wrap">
      {inputs.length > 0 && (
        <div className="flex items-center gap-1 flex-wrap">
          {inputs.map((h) => <HandleTag key={h} name={h} />)}
        </div>
      )}
      {inputs.length > 0 && outputs.length > 0 && (
        <ArrowRight className="h-3 w-3 shrink-0 text-nyx-text-muted" />
      )}
      {outputs.length > 0 && (
        <div className="flex items-center gap-1 flex-wrap">
          {outputs.map((h) => <HandleTag key={h} name={h} />)}
        </div>
      )}
    </div>
  );
}

const NODE_SECTIONS = [
  {
    label: "Fontes",
    color: "text-nyx-cyan-500",
    nodes: [
      { type: "NarrationSource" as NodeType, label: "Narração", icon: Mic, color: "text-nyx-cyan-500" },
      { type: "AssetSource" as NodeType, label: "Biblioteca", icon: Database, color: "text-nyx-cyan-500" },
      { type: "SceneSource" as NodeType, label: "Cenas do job", icon: Film, color: "text-nyx-cyan-500" },
      { type: "MusicSource" as NodeType, label: "Trilha", icon: Music, color: "text-nyx-cyan-500" },
    ],
  },
  {
    label: "Reações",
    color: "text-nyx-orange-500",
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
    color: "text-cyan-400",
    nodes: [
      { type: "SetMedia" as NodeType, label: "Trocar mídia", icon: ImagePlay, color: "text-cyan-400" },
      { type: "ShowOverlay" as NodeType, label: "Overlay", icon: Image, color: "text-cyan-400" },
      { type: "SetSubtitleStyle" as NodeType, label: "Legenda", icon: Captions, color: "text-cyan-400" },
      { type: "PlaySfx" as NodeType, label: "Efeito sonoro", icon: Volume2, color: "text-cyan-400" },
      { type: "SetMusic" as NodeType, label: "Ajustar trilha", icon: Music, color: "text-cyan-400" },
      { type: "CameraEffect" as NodeType, label: "Efeito de câmera", icon: Sparkles, color: "text-cyan-400" },
      { type: "ShowTitleCard" as NodeType, label: "Card de título", icon: MessageSquareText, color: "text-cyan-400" },
    ],
  },
  {
    label: "Entrega",
    color: "text-nyx-orange-400",
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
  const [openHelp, setOpenHelp] = useState<Partial<Record<NodeType, boolean>>>({});
  const [isHovered, setIsHovered] = useState(false);

  // expanded = hovered OR pinned (collapsed=false)
  const isExpanded = isHovered || !collapsed;

  const handleDragStart = useCallback(
    (e: React.DragEvent, type: NodeType) => {
      e.dataTransfer.setData("application/nyx-node-type", type);
      e.dataTransfer.effectAllowed = "move";
      onDragStart(type);
    },
    [onDragStart],
  );

  return (
    <div className="pointer-events-none absolute left-0 right-0 top-3 z-10 flex justify-center">
    <motion.div
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      className="pointer-events-auto overflow-hidden rounded-xl border border-nyx-border bg-nyx-deep/95 shadow-2xl backdrop-blur-sm"
    >
      {/* Top bar: section tabs */}
      <div className="flex items-center gap-1 px-2 py-2">
        {NODE_SECTIONS.map((section) => {
          const Icon = section.nodes[0].icon;
          return (
            <div
              key={section.label}
              className="flex items-center gap-2 rounded-lg px-4 py-2"
            >
              <Icon className={cn("h-4 w-4 shrink-0", section.color)} />
              <span className="whitespace-nowrap text-xs font-semibold uppercase tracking-wider text-nyx-text-secondary">
                {section.label}
              </span>
              <span className="font-mono text-[11px] text-nyx-text-muted">{section.nodes.length}</span>
            </div>
          );
        })}

        {/* Divider + pin button */}
        <div className="mx-1.5 h-4 w-px bg-nyx-border" />
        <button
          onClick={onToggle}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-nyx-text-muted transition-colors hover:bg-nyx-hover hover:text-nyx-text-primary"
          title={collapsed ? "Fixar aberto" : "Recolher"}
        >
          {collapsed ? <Pin className="h-4 w-4" /> : <PinOff className="h-4 w-4" />}
        </button>
      </div>

      {/* Expanded grid: columns per section */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            variants={{
              open:   { height: "auto", opacity: 1, transition: { type: "spring", stiffness: 340, damping: 30, mass: 0.7 } },
              closed: { height: 0,      opacity: 0, transition: { duration: 0.18, ease: [0.4, 0, 1, 1] } },
            }}
            initial="closed"
            animate="open"
            exit="closed"
            style={{ overflow: "hidden" }}
          >
            <div className="flex gap-3 border-t border-nyx-border px-4 pb-4 pt-3">
              {NODE_SECTIONS.map((section, si) => (
                <motion.div
                  key={section.label}
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0, transition: { delay: si * 0.05, duration: 0.22, ease: [0.16, 1, 0.3, 1] } }}
                  exit={{ opacity: 0, transition: { duration: 0 } }}
                  className="flex flex-col gap-1.5"
                >
                  <p className={cn("mb-1 whitespace-nowrap text-[11px] font-semibold uppercase tracking-wider", section.color)}>
                    {section.label}
                  </p>

                  {section.nodes.map((node) => {
                    const definition = NODE_DEFINITIONS[node.type];
                    const helpOpen = openHelp[node.type] === true;

                    return (
                      <div
                        key={node.type}
                        draggable
                        onDragStart={(e) => handleDragStart(e, node.type)}
                        title={`${node.label} — ${definition.description}`}
                        className="group relative cursor-grab rounded-lg border border-nyx-border bg-nyx-surface transition-colors hover:border-nyx-hover hover:bg-nyx-elevated active:cursor-grabbing"
                      >
                        <div className="flex min-w-[160px] items-center gap-2.5 px-3 py-2">
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-nyx-void">
                            <node.icon className={cn("h-4 w-4", node.color)} />
                          </span>
                          <span className="flex-1 truncate text-sm font-medium text-nyx-text-primary">
                            {node.label}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenHelp((c) => ({ ...c, [node.type]: !helpOpen }));
                            }}
                            onMouseDown={(e) => e.stopPropagation()}
                            className={cn(
                              "flex h-5 w-5 shrink-0 items-center justify-center rounded transition-colors",
                              helpOpen
                                ? "bg-nyx-hover text-nyx-text-secondary"
                                : "text-nyx-text-muted opacity-0 group-hover:opacity-100 hover:bg-nyx-hover",
                            )}
                          >
                            <Info className="h-3.5 w-3.5" />
                          </button>
                        </div>

                        {helpOpen && (
                          <div className="border-t border-nyx-border/70 px-3 pb-2.5 pt-2 space-y-1.5">
                            <p className="text-xs leading-snug text-nyx-text-muted">{definition.description}</p>
                            <ConnectionHint type={node.type} />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
    </div>
  );
}
