import { useNavigate } from "react-router-dom";
import { X, Check } from "lucide-react";
import { GRAPH_PRESETS } from "../../lib/graphPresets";
import type { Graph } from "../../lib/types";
import { cn } from "../../lib/cn";

interface Props {
  onClose: () => void;
}

const TAG_COLORS: Record<string, string> = {
  TTS:        "bg-nyx-cyan-500/10 text-nyx-cyan-400 border-nyx-cyan-500/20",
  Legenda:    "bg-nyx-orange-500/10 text-nyx-orange-400 border-nyx-orange-500/20",
  Música:     "bg-purple-500/10 text-purple-400 border-purple-500/20",
  Intro:      "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  SceneSlot:  "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  Transition: "bg-nyx-orange-500/10 text-nyx-orange-400 border-nyx-orange-500/20",
  Zoom:       "bg-nyx-orange-500/10 text-nyx-orange-400 border-nyx-orange-500/20",
  Shake:      "bg-nyx-orange-500/10 text-nyx-orange-400 border-nyx-orange-500/20",
};

function PresetCard({
  preset,
  onSelect,
}: {
  preset: (typeof GRAPH_PRESETS)[0];
  onSelect: (graph: Graph) => void;
}) {
  return (
    <button
      onClick={() => onSelect(preset.graph)}
      className={cn(
        "group relative flex flex-col gap-3 rounded-xl border border-nyx-border bg-nyx-surface p-5 text-left",
        "transition-all hover:border-nyx-cyan-500/50 hover:bg-nyx-hover",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="font-display text-sm font-bold text-nyx-text-primary group-hover:text-nyx-cyan-400 transition-colors">
          {preset.label}
        </span>
        <Check className="h-4 w-4 shrink-0 text-nyx-cyan-500 opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>

      <p className="text-xs leading-relaxed text-nyx-text-muted">{preset.description}</p>

      <div className="flex flex-wrap gap-1.5">
        {preset.tags.map((tag) => (
          <span
            key={tag}
            className={cn(
              "rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
              TAG_COLORS[tag] ?? "bg-nyx-surface text-nyx-text-muted border-nyx-border",
            )}
          >
            {tag}
          </span>
        ))}
      </div>
    </button>
  );
}

export function TemplatePresetModal({ onClose }: Props) {
  const navigate = useNavigate();

  const handleSelect = (graph: Graph) => {
    navigate("/templates/new", { state: { graph } });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-3xl rounded-2xl border border-nyx-border bg-nyx-deep shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-nyx-border px-6 py-4">
          <div>
            <h2 className="font-display text-base font-bold text-nyx-text-primary">Novo Template</h2>
            <p className="mt-0.5 text-xs text-nyx-text-muted">Escolha um ponto de partida para o seu grafo</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-nyx-text-muted hover:bg-nyx-hover hover:text-nyx-text-primary transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Presets */}
        <div className="grid grid-cols-1 gap-3 p-6 sm:grid-cols-2 lg:grid-cols-4">
          {GRAPH_PRESETS.map((preset) => (
            <PresetCard key={preset.id} preset={preset} onSelect={handleSelect} />
          ))}
        </div>

        {/* Canvas vazio */}
        <div className="border-t border-nyx-border px-6 py-3 flex justify-end">
          <button
            onClick={() => navigate("/templates/new")}
            className="text-xs text-nyx-text-muted hover:text-nyx-text-secondary transition-colors"
          >
            Começar com canvas vazio
          </button>
        </div>
      </div>
    </div>
  );
}
