import { type ReactNode, memo } from "react";
import { Handle, NodeToolbar, Position, type NodeProps } from "@xyflow/react";
import { motion } from "motion/react";
import { Trash2 } from "lucide-react";
import { cn } from "../../../lib/cn";
import { useEditorStore } from "../../../stores/editorStore";

type HandleDef = { id: string; label: string };

export interface NodeCategoryStyle {
  borderColor: string;
  iconColor: string;
  glowColor?: string;
}

const CATEGORY_STYLES: Record<string, NodeCategoryStyle> = {
  source: { borderColor: "border-nyx-cyan-500", iconColor: "text-nyx-cyan-500" },
  event: { borderColor: "border-nyx-orange-500", iconColor: "text-nyx-orange-500" },
  action: { borderColor: "border-cyan-400", iconColor: "text-cyan-400" },
  processing: { borderColor: "border-nyx-orange-500", iconColor: "text-nyx-orange-500" },
  effects: { borderColor: "border-violet-500", iconColor: "text-violet-400" },
  composition: { borderColor: "border-cyan-400", iconColor: "text-cyan-400" },
  output: {
    borderColor: "border-nyx-orange-400",
    iconColor: "text-nyx-orange-400",
    glowColor: "shadow-[0_0_20px_rgba(251,146,60,0.15)]",
  },
};

export function getNodeCategory(type: string): keyof typeof CATEGORY_STYLES {
  if (["NarrationSource", "AssetSource", "SceneSource", "MusicSource"].includes(type)) return "source";
  if (["OnTime", "OnWord", "OnSentence", "OnSilence", "OnSceneStart", "OnSceneEnd"].includes(type)) return "event";
  if (["SetMedia", "ShowOverlay", "SetSubtitleStyle", "PlaySfx", "SetMusic", "CameraEffect", "ShowTitleCard"].includes(type)) return "action";
  return "output";
}

interface BaseNodeProps extends NodeProps {
  icon: ReactNode;
  label: string;
  technicalLabel?: string;
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
  technicalLabel,
  category,
  inputs = [],
  outputs = [],
  statusBadge,
  children,
}: BaseNodeProps) {
  const removeNode = useEditorStore((s) => s.removeNode);
  const style = CATEGORY_STYLES[category];
  const catBorderTop = style.borderColor.replace("border-", "border-t-");

  return (
    <>
      <NodeToolbar
        isVisible={selected}
        position={Position.Top}
        align="end"
        offset={6}
        className="nodrag nopan"
      >
        <motion.div
          initial={{ opacity: 0, y: 4, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.14, ease: [0.25, 1, 0.5, 1] }}
          className="flex items-center overflow-hidden rounded-md border border-nyx-border bg-nyx-elevated shadow-xl"
        >
          <button
            onClick={() => removeNode(id)}
            aria-label={`Remover ${label}`}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium text-red-400 transition-colors hover:bg-red-500/10"
          >
            <Trash2 className="h-3 w-3" />
            Remover
          </button>
        </motion.div>
      </NodeToolbar>

      <div
        className={cn(
          "relative min-w-[180px] rounded-xl border bg-nyx-surface shadow-lg transition-all duration-150",
          selected ? cn(style.borderColor, style.glowColor ?? "") : "border-nyx-border hover:border-nyx-hover",
          "border-t-[3px]",
          catBorderTop,
        )}
      >
        <div className="flex items-center px-3 pb-2 pt-3">
          <div className="flex min-w-0 items-center gap-2">
            <span className={cn("shrink-0", style.iconColor)}>{icon}</span>
            <span className="truncate text-sm font-semibold text-nyx-text-primary" title={technicalLabel}>{label}</span>
          </div>
        </div>

        {(inputs.length > 0 || outputs.length > 0) && (
          <div className="flex justify-between px-3 pb-2">
            <div className="flex flex-col gap-2">
              {inputs.map((handle) => (
                <span key={handle.id} className="py-1 text-[10px] leading-none text-nyx-text-muted">
                  {handle.label}
                </span>
              ))}
            </div>

            <div className="flex flex-col items-end gap-2">
              {outputs.map((handle) => (
                <span key={handle.id} className="py-1 text-[10px] leading-none text-nyx-text-muted">
                  {handle.label}
                </span>
              ))}
            </div>
          </div>
        )}

        {children && <div className="px-3 pb-2">{children}</div>}

        {statusBadge && (
          <div className="border-t border-nyx-border px-3 py-1.5">{statusBadge}</div>
        )}

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
    </>
  );
});
