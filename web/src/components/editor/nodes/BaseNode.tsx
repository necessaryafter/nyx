import { type ReactNode, memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { MoreVertical, Trash2 } from "lucide-react";
import { cn } from "../../../lib/cn";
import { useEditorStore } from "../../../stores/editorStore";
import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";

type HandleDef = { id: string; label: string };

export interface NodeCategoryStyle {
  borderColor: string;
  iconColor: string;
  glowColor?: string;
}

const CATEGORY_STYLES: Record<string, NodeCategoryStyle> = {
  source: { borderColor: "border-nyx-cyan-500", iconColor: "text-nyx-cyan-500" },
  processing: { borderColor: "border-nyx-orange-500", iconColor: "text-nyx-orange-500" },
  effects: { borderColor: "border-violet-500", iconColor: "text-violet-400" },
  composition: { borderColor: "border-cyan-400", iconColor: "text-cyan-400" },
  output: {
    borderColor: "border-nyx-orange-400",
    iconColor: "text-nyx-orange-400",
    glowColor: "shadow-[0_0_20px_rgba(251,146,60,0.15)]",
  },
};

export function getNodeCategory(
  type: string,
): keyof typeof CATEGORY_STYLES {
  if (["MediaPool", "SceneSlot", "TTS"].includes(type)) return "source";
  if (["VideoFit", "Subtitle"].includes(type)) return "processing";
  if (["Transition", "Zoom", "Shake"].includes(type)) return "effects";
  if (["Layer", "Overlay"].includes(type)) return "composition";
  return "output";
}

interface BaseNodeProps extends NodeProps {
  icon: ReactNode;
  label: string;
  category: keyof typeof CATEGORY_STYLES;
  inputs?: HandleDef[];
  outputs?: HandleDef[];
  statusBadge?: ReactNode;
  children?: ReactNode;
}

export const BaseNode = memo(function BaseNode({
  id,
  selected,
  icon,
  label,
  category,
  inputs = [],
  outputs = [],
  statusBadge,
  children,
}: BaseNodeProps) {
  const removeNode = useEditorStore((s) => s.removeNode);
  const style = CATEGORY_STYLES[category];
  const [menuOpen, setMenuOpen] = useState(false);

  const catBorderTop = style.borderColor.replace("border-", "border-t-");

  return (
    <div
      className={cn(
        "relative min-w-[180px] rounded-xl border bg-nyx-surface shadow-lg transition-all duration-150",
        selected
          ? cn(style.borderColor, style.glowColor ?? "")
          : "border-nyx-border hover:border-nyx-hover",
        "border-t-[3px]",
        catBorderTop,
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 pb-2 pt-3">
        <div className="flex items-center gap-2">
          <span className={cn("shrink-0", style.iconColor)}>{icon}</span>
          <span className="text-sm font-semibold text-nyx-text-primary">{label}</span>
        </div>

        <div className="relative">
          <button
            onClick={() => setMenuOpen((o) => !o)}
            className="rounded p-0.5 text-nyx-text-muted hover:bg-nyx-hover hover:text-nyx-text-primary"
          >
            <MoreVertical className="h-3.5 w-3.5" />
          </button>
          <AnimatePresence>
            {menuOpen && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: -4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -4 }}
                transition={{ duration: 0.1 }}
                className="absolute right-0 top-6 z-50 overflow-hidden rounded-lg border border-nyx-border bg-nyx-surface shadow-xl"
              >
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    removeNode(id);
                  }}
                  className="flex items-center gap-2 px-3 py-2 text-xs text-red-400 hover:bg-red-500/10"
                >
                  <Trash2 className="h-3 w-3" />
                  Deletar
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Handles Row - inputs à esquerda, outputs à direita */}
      {(inputs.length > 0 || outputs.length > 0) && (
        <div className="flex justify-between px-3 pb-2">
          {/* Input labels (esquerda) */}
          <div className="flex flex-col gap-2">
            {inputs.map((handle) => (
              <span key={handle.id} className="text-[10px] text-nyx-text-muted leading-none py-1">
                {handle.label}
              </span>
            ))}
          </div>
          
          {/* Output labels (direita) */}
          <div className="flex flex-col gap-2 items-end">
            {outputs.map((handle) => (
              <span key={handle.id} className="text-[10px] text-nyx-text-muted leading-none py-1">
                {handle.label}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Content */}
      {children && <div className="px-3 pb-2">{children}</div>}

      {/* Status badge */}
      {statusBadge && (
        <div className="border-t border-nyx-border px-3 py-1.5">{statusBadge}</div>
      )}

      {/* Actual Handles - posicionados na borda */}
      {inputs.map((handle, i) => (
        <Handle
          key={handle.id}
          type="target"
          position={Position.Left}
          id={handle.id}
          style={{ top: `${49 + i * 26}px` }}
          className={cn(
            "!h-3 !w-3 !border-2 !border-nyx-border !bg-nyx-surface transition-all",
            "hover:!scale-125 hover:!border-nyx-cyan-500",
            selected ? `!border-current ${style.iconColor}` : "",
          )}
        />
      ))}

      {outputs.map((handle, i) => (
        <Handle
          key={handle.id}
          type="source"
          position={Position.Right}
          id={handle.id}
          style={{ top: `${49 + i * 26}px` }}
          className={cn(
            "!h-3 !w-3 !border-2 !border-nyx-border !bg-nyx-surface transition-all",
            "hover:!scale-125 hover:!border-nyx-cyan-500",
            selected ? `!border-current ${style.iconColor}` : "",
          )}
        />
      ))}
    </div>
  );
});