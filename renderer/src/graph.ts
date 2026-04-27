// Schema do grafo — espelha o CLAUDE.md
// Fonte de verdade: CLAUDE.md § Schema do Grafo

export interface Graph {
  version: 1;
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface GraphEdge {
  id: string;
  from: string;
  fromHandle: string;
  to: string;
  toHandle: string;
  order?: number; // z-index para handles que aceitam múltiplas edges (ex: Layer.overlay)
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

export type NodeType = GraphNode["type"];

export interface MediaPoolConfig {
  assetIds: string[];
  assetType: "video" | "audio" | "image";
}

export interface SceneSlotConfig {
  label: string;
  assetType: "video" | "audio" | "image";
  assetIds: string[]; // empty in template; filled by backend at job creation
}

export interface VideoFitConfig {
  mode: "random-loop" | "sequential" | "once";
}

export interface SceneMediaConfig {
  fit?: "cover" | "contain";
  transitionMs?: number; // crossfade entre slides em ms (default: 0)
}

export interface TTSConfig {
  text?: string; // optional in template — injected at job creation
  provider: "talkify" | "custom" | "precomputed";
  voice?: string; // assetId (custom) ou storageKey (precomputed)
  speed?: number;
  providerConfig?: Record<string, unknown>; // pass-through for advanced provider params (e.g. Talkify effects)
}

export interface SubtitleConfig {
  wordsPerGroup: number;
  startSeconds?: number;
  endSeconds?: number;
  style?: {
    fontFamily?: string;
    fontSize?: number;
    color?: string;
    highlightColor?: string;
    strokeColor?: string;
    strokeWidth?: number;
    position?: "top" | "center" | "bottom";
  };
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
  opacity?: number; // 0.0–1.0, default 1.0
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
  duration: number; // seconds, default 0.5
}

export interface ZoomConfig {
  factor: number; // 1.05 = zoom-in 5%
  direction: "in" | "out" | "random";
}

export interface ShakeConfig {
  intensity: number; // 0–10
}

// EffectConfig — discriminated union emitido pelos nodes de efeito (Transition, Zoom, Shake)
// Todos os nodes de efeito outputam no mesmo handle "effect"; VideoFit recebe um array via "effects"
export type EffectConfig =
  | ({ type: "transition" } & TransitionConfig)
  | ({ type: "zoom" } & ZoomConfig)
  | ({ type: "shake" } & ShakeConfig);

export interface RenderConfig {
  width: number;
  height: number;
  fps: number;
  format?: "mp4" | "webm";
  musicVolume?: number; // 0.0-1.0, volume of background music relative to narration (default 0.15)
}

export interface WordTimestamp {
  word: string;
  startMs: number;
  endMs: number;
}
