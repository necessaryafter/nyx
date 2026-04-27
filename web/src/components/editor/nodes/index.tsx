import { memo } from "react";
import {
  Database,
  Film,
  Mic,
  Captions,
  Layers,
  Clapperboard,
  CheckCircle2,
  AlertTriangle,
  ImagePlay,
  Scissors,
  Shuffle,
  ZoomIn,
  Waves,
} from "lucide-react";
import type { NodeProps } from "@xyflow/react";
import { BaseNode, getNodeCategory } from "./BaseNode";
import { cn } from "../../../lib/cn";

// Status badge helper
function StatusBadge({
  ok,
  okLabel,
  warnLabel,
}: {
  ok: boolean;
  okLabel: string;
  warnLabel: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-[10px]",
        ok ? "text-green-400" : "text-orange-400",
      )}
    >
      {ok ? <CheckCircle2 className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
      {ok ? okLabel : warnLabel}
    </span>
  );
}

const ASSET_TYPE_LABEL: Record<string, string> = {
  video: "Vídeos",
  audio: "Áudios",
  image: "Imagens",
};

export const SceneSlotNode = memo(function SceneSlotNode(props: NodeProps) {
  const config = (props.data?.config ?? {}) as {
    label?: string;
    assetType?: "video" | "audio" | "image";
  };
  const typeLabel = ASSET_TYPE_LABEL[config.assetType ?? "video"] ?? "Items";

  return (
    <BaseNode
      {...props}
      icon={<Film className="h-4 w-4" />}
      label={config.label ?? "SceneSlot"}
      category={getNodeCategory("SceneSlot")}
      outputs={[{ id: "items", label: "items" }]}
      statusBadge={
        <span className="text-[10px] text-nyx-text-muted">
          {typeLabel} · fornecido por render
        </span>
      }
    />
  );
});

export const MediaPoolNode = memo(function MediaPoolNode(props: NodeProps) {
  const config = (props.data?.config ?? {}) as {
    assetIds?: string[];
    assetType?: "video" | "audio" | "image";
  };
  const count = config.assetIds?.length ?? 0;
  const typeLabel = ASSET_TYPE_LABEL[config.assetType ?? "video"] ?? "Items";

  return (
    <BaseNode
      {...props}
      icon={<Database className="h-4 w-4" />}
      label="MediaPool"
      category={getNodeCategory("MediaPool")}
      outputs={[{ id: "items", label: "items" }]}
      statusBadge={
        <StatusBadge
          ok={count > 0}
          okLabel={`${count} ${typeLabel.toLowerCase()} no pool`}
          warnLabel={`Sem ${typeLabel.toLowerCase()} ⚠`}
        />
      }
    />
  );
});

const MODE_LABEL: Record<string, string> = {
  "random-loop": "Aleatório",
  sequential: "Sequencial",
  once: "Uma vez",
};

export const VideoFitNode = memo(function VideoFitNode(props: NodeProps) {
  const config = (props.data?.config ?? {}) as { mode?: string };
  const modeLabel = MODE_LABEL[config.mode ?? "random-loop"] ?? "Aleatório";

  return (
    <BaseNode
      {...props}
      icon={<Scissors className="h-4 w-4" />}
      label="VideoFit"
      category={getNodeCategory("VideoFit")}
      inputs={[
        { id: "items", label: "items" },
        { id: "audio", label: "audio" },
        { id: "effects", label: "effects" },
      ]}
      outputs={[{ id: "video", label: "video" }]}
      statusBadge={
        <span className="text-[10px] text-nyx-text-muted">{modeLabel}</span>
      }
    />
  );
});

export const TTSNode = memo(function TTSNode(props: NodeProps) {
  const config = (props.data?.config ?? {}) as {
    provider?: string;
    voice?: string;
  };
  const hasProvider = !!config.provider;

  return (
    <BaseNode
      {...props}
      icon={<Mic className="h-4 w-4" />}
      label="TTS"
      category={getNodeCategory("TTS")}
      outputs={[
        { id: "audio", label: "audio" },
        { id: "timestamps", label: "timestamps" },
      ]}
      statusBadge={
        <StatusBadge
          ok={hasProvider}
          okLabel={config.provider ?? ""}
          warnLabel="Sem provider ⚠"
        />
      }
    />
  );
});

export const SubtitleNode = memo(function SubtitleNode(props: NodeProps) {
  const config = (props.data?.config ?? {}) as {
    wordsPerGroup?: number;
    startSeconds?: number;
    endSeconds?: number;
  };

  const timeLabel =
    config.startSeconds != null || config.endSeconds != null
      ? `${config.startSeconds ?? 0}s–${config.endSeconds != null ? `${config.endSeconds}s` : "fim"}`
      : null;

  return (
    <BaseNode
      {...props}
      icon={<Captions className="h-4 w-4" />}
      label="Subtitle"
      category={getNodeCategory("Subtitle")}
      inputs={[{ id: "timestamps", label: "timestamps" }]}
      outputs={[]}
      statusBadge={
        <span className="text-[10px] text-nyx-text-muted">
          {config.wordsPerGroup ?? 3} palavras/grupo{timeLabel ? ` · ${timeLabel}` : ""}
        </span>
      }
    />
  );
});

export const LayerNode = memo(function LayerNode(props: NodeProps) {
  return (
    <BaseNode
      {...props}
      icon={<Layers className="h-4 w-4" />}
      label="Layer"
      category={getNodeCategory("Layer")}
      inputs={[
        { id: "base", label: "base" },
        { id: "overlay", label: "overlay" },
      ]}
      outputs={[{ id: "video", label: "video" }]}
    />
  );
});

export const RenderNode = memo(function RenderNode(props: NodeProps) {
  const config = (props.data?.config ?? {}) as {
    width?: number;
    height?: number;
    fps?: number;
  };

  return (
    <BaseNode
      {...props}
      icon={<Clapperboard className="h-4 w-4" />}
      label="Render"
      category={getNodeCategory("Render")}
      inputs={[
        { id: "video", label: "video" },
        { id: "audio", label: "audio" },
        { id: "music", label: "music" },
        { id: "sfx", label: "sfx" },
      ]}
      statusBadge={
        <span className="font-mono text-[10px] text-nyx-text-muted">
          {config.width ?? 1080}×{config.height ?? 1920} · {config.fps ?? 30}fps
        </span>
      }
    />
  );
});

export const OverlayNode = memo(function OverlayNode(props: NodeProps) {
  const config = (props.data?.config ?? {}) as {
    assetId?: string;
    soundAssetId?: string;
    startSeconds?: number;
    durationSeconds?: number;
    blendMode?: string;
  };
  const hasAsset = !!config.assetId;

  return (
    <BaseNode
      {...props}
      icon={<ImagePlay className="h-4 w-4" />}
      label="Overlay"
      category={getNodeCategory("Overlay")}
      outputs={[
        { id: "overlay", label: "overlay" },
        { id: "sfx", label: "sfx" },
      ]}
      statusBadge={
        <StatusBadge
          ok={hasAsset}
          okLabel={`${config.startSeconds ?? 0}s · ${config.durationSeconds ?? 5}s${config.blendMode === "screen" ? " · screen" : ""}`}
          warnLabel="Sem asset ⚠"
        />
      }
    />
  );
});

const TRANSITION_TYPE_LABEL: Record<string, string> = {
  fade: "Fade", fadewhite: "Fade White", fadegrays: "Fade Gray",
  dissolve: "Dissolve", distance: "Distance", pixelize: "Pixelize", hblur: "H.Blur",
  wipeleft: "Wipe ←", wipeup: "Wipe ↑", wipetr: "Wipe ↗", wipebl: "Wipe ↙", wipebr: "Wipe ↘",
  slideright: "Slide →", slideup: "Slide ↑", slidedown: "Slide ↓",
  circleopen: "Circle Open", circleclose: "Circle Close", circlecrop: "Circle Crop", rectcrop: "Rect Crop",
  radial: "Radial",
  smoothleft: "Smooth ←", smoothright: "Smooth →", smoothup: "Smooth ↑", smoothdown: "Smooth ↓",
  coverleft: "Cover ←", coverright: "Cover →", coverup: "Cover ↑", coverdown: "Cover ↓",
  revealleft: "Reveal ←", revealright: "Reveal →", revealup: "Reveal ↑", revealdown: "Reveal ↓",
  horzopen: "Horiz Open", horzclose: "Horiz Close", vertopen: "Vert Open", vertclose: "Vert Close",
  hlslice: "HL Slice", hrslice: "HR Slice", vuslice: "VU Slice", vdslice: "VD Slice",
  hlwind: "HL Wind", hrwind: "HR Wind", vuwind: "VU Wind",
  squeezeh: "Squeeze H", squeezev: "Squeeze V",
  diagtl: "Diag ↖", diagtr: "Diag ↗", diagbl: "Diag ↙", diagbr: "Diag ↘",
  zoomin: "Zoom In",
};

export const TransitionNode = memo(function TransitionNode(props: NodeProps) {
  const config = (props.data?.config ?? {}) as {
    types?: string[];
    mode?: string;
    duration?: number;
  };
  const types = config.types ?? [];
  const label = types.length === 0
    ? "Sem transição ⚠"
    : types.length === 1
      ? (TRANSITION_TYPE_LABEL[types[0]!] ?? types[0]!)
      : `${types.length} transições`;

  return (
    <BaseNode
      {...props}
      icon={<Shuffle className="h-4 w-4" />}
      label="Transition"
      category={getNodeCategory("Transition")}
      outputs={[{ id: "effect", label: "effect" }]}
      statusBadge={
        <span className="text-[10px] text-nyx-text-muted">
          {label} · {config.mode ?? "random"} · {config.duration ?? 0.5}s
        </span>
      }
    />
  );
});

export const ZoomNode = memo(function ZoomNode(props: NodeProps) {
  const config = (props.data?.config ?? {}) as {
    factor?: number;
    direction?: string;
  };
  const factor = config.factor ?? 1.05;
  const pct = Math.round((factor - 1) * 100);

  return (
    <BaseNode
      {...props}
      icon={<ZoomIn className="h-4 w-4" />}
      label="Zoom"
      category={getNodeCategory("Zoom")}
      outputs={[{ id: "effect", label: "effect" }]}
      statusBadge={
        <span className="text-[10px] text-nyx-text-muted">
          +{pct}% · {config.direction ?? "in"}
        </span>
      }
    />
  );
});

export const ShakeNode = memo(function ShakeNode(props: NodeProps) {
  const config = (props.data?.config ?? {}) as { intensity?: number };
  const intensity = config.intensity ?? 3;

  return (
    <BaseNode
      {...props}
      icon={<Waves className="h-4 w-4" />}
      label="Shake"
      category={getNodeCategory("Shake")}
      outputs={[{ id: "effect", label: "effect" }]}
      statusBadge={
        <span className="text-[10px] text-nyx-text-muted">
          intensidade {intensity}/10
        </span>
      }
    />
  );
});

export const nodeTypes = {
  SceneSlot: SceneSlotNode,
  MediaPool: MediaPoolNode,
  VideoFit: VideoFitNode,
  TTS: TTSNode,
  Subtitle: SubtitleNode,
  Layer: LayerNode,
  Render: RenderNode,
  Overlay: OverlayNode,
  Transition: TransitionNode,
  Zoom: ZoomNode,
  Shake: ShakeNode,
};
