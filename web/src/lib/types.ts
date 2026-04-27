export type JobStatus =
  | "draft"
  | "audio_processing"
  | "audio_ready"
  | "ready"
  | "rendering"
  | "pending"
  | "processing"
  | "done"
  | "failed";

export const IN_PROGRESS_STATUSES: JobStatus[] = [
  "draft", "audio_processing", "audio_ready", "ready",
];

export interface SceneSlot {
  index: number;
  startMs: number;
  endMs: number;
  assetId: string | null;
}

export interface Job {
  id: string;
  status: JobStatus;
  templateId: string;
  templateName?: string | null;
  audioKey: string | null;
  sceneSlots: SceneSlot[] | null;
  videoKey: string | null;
  durationSeconds: number | null;
  creditsCharged: number | null;
  error: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface Template {
  id: string;
  name: string;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Asset {
  id: string;
  name: string;
  type: "video" | "audio" | "text";
  sizeBytes: number | null;
  createdAt: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  limit: number;
  offset: number;
}

export interface CreditsBalance {
  balance: number;
}

/* ── Graph types (mirrored from renderer/src/graph.ts) ── */

export type NodeType =
  | "MediaPool"
  | "SceneSlot"
  | "VideoFit"
  | "TTS"
  | "Subtitle"
  | "Layer"
  | "Render"
  | "Overlay"
  | "Transition"
  | "Zoom"
  | "Shake"
  | "SceneMedia";

export interface SceneMediaConfig {
  fit?: "cover" | "contain";
  transitionMs?: number;
}

export interface GraphEdge {
  id: string;
  from: string;
  fromHandle: string;
  to: string;
  toHandle: string;
  order?: number;
}

export interface MediaPoolConfig {
  assetIds: string[];
  assetType: "video" | "audio" | "image";
}
export interface SceneSlotConfig {
  label: string;
  assetType: "video" | "audio" | "image";
  assetIds: string[];
}
export interface VideoFitConfig {
  mode: "random-loop" | "sequential" | "once";
}
export interface TTSConfig {
  text?: string;
  provider: "talkify" | "custom";
  voice?: string;
  speed?: number;
  providerConfig?: Record<string, unknown>; // pass-through for advanced provider params (e.g. Talkify effects)
}
export interface SubtitleStyle {
  fontFamily?: string;
  fontSize?: number;
  color?: string;
  highlightColor?: string;
  strokeColor?: string;
  strokeWidth?: number;
  position?: "top" | "center" | "bottom";
}
export interface SubtitleConfig {
  wordsPerGroup: number;
  startSeconds?: number;
  endSeconds?: number;
  style?: SubtitleStyle;
}
export interface LayerConfig {}
export interface OverlayConfig {
  assetId: string;
  soundAssetId?: string;
  startSeconds: number;
  durationSeconds: number;
  position: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  opacity?: number;
  blendMode?: "normal" | "screen";
}

export type TransitionType =
  | "fade" | "fadewhite" | "fadegrays" | "dissolve" | "distance" | "pixelize" | "hblur"
  | "wipeleft" | "wipeup" | "wipetr" | "wipebl" | "wipebr"
  | "slideright" | "slideup" | "slidedown"
  | "circleopen" | "circleclose" | "circlecrop" | "rectcrop"
  | "radial"
  | "smoothleft" | "smoothright" | "smoothup" | "smoothdown"
  | "coverleft" | "coverright" | "coverup" | "coverdown"
  | "revealleft" | "revealright" | "revealup" | "revealdown"
  | "horzopen" | "horzclose" | "vertopen" | "vertclose"
  | "hlslice" | "hrslice" | "vuslice" | "vdslice"
  | "hlwind" | "hrwind" | "vuwind"
  | "squeezeh" | "squeezev"
  | "diagtl" | "diagtr" | "diagbl" | "diagbr"
  | "zoomin";

export interface TransitionConfig {
  types: TransitionType[];
  mode: "random" | "sequential";
  duration: number;
}

export interface ZoomConfig {
  factor: number;
  direction: "in" | "out" | "random";
}

export interface ShakeConfig {
  intensity: number;
}

export type EffectConfig =
  | ({ type: "transition" } & TransitionConfig)
  | ({ type: "zoom" } & ZoomConfig)
  | ({ type: "shake" } & ShakeConfig);

export interface RenderConfig {
  width: number;
  height: number;
  fps: number;
  format?: "mp4" | "webm";
  musicVolume?: number;
}

export type GraphNode =
  | { id: string; type: "MediaPool"; config: MediaPoolConfig }
  | { id: string; type: "SceneSlot"; config: SceneSlotConfig }
  | { id: string; type: "VideoFit"; config: VideoFitConfig }
  | { id: string; type: "TTS"; config: TTSConfig }
  | { id: string; type: "Subtitle"; config: SubtitleConfig }
  | { id: string; type: "Layer"; config: LayerConfig }
  | { id: string; type: "Render"; config: RenderConfig }
  | { id: string; type: "Overlay"; config: OverlayConfig }
  | { id: string; type: "Transition"; config: TransitionConfig }
  | { id: string; type: "Zoom"; config: ZoomConfig }
  | { id: string; type: "Shake"; config: ShakeConfig }
  | { id: string; type: "SceneMedia"; config: SceneMediaConfig };

export interface Graph {
  version: 1;
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface TemplateWithGraph extends Template {
  graph: Graph;
}
