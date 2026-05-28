export interface Graph {
  version: 2;
  settings: RenderSettings;
  nodes: BlueprintNode[];
  edges: BlueprintEdge[];
}

export interface RenderSettings {
  width: number;
  height: number;
  fps: number;
  format?: "mp4" | "webm";
  musicVolume?: number;
}

export type BlueprintKind = "source" | "event" | "action" | "output";

export interface BlueprintEdge {
  id: string;
  from: string;
  to: string;
  role?: "media" | "sfx" | "music" | "overlay" | "narration" | "scene" | "trigger";
}

export interface GraphEdge {
  id: string;
  from: string;
  fromHandle: string;
  to: string;
  toHandle: string;
  order?: number;
}

export type BlueprintNode =
  | { id: string; kind: "source"; type: "NarrationSource"; config: NarrationSourceConfig }
  | { id: string; kind: "source"; type: "AssetSource"; config: AssetSourceConfig }
  | { id: string; kind: "source"; type: "SceneSource"; config: SceneSourceConfig }
  | { id: string; kind: "source"; type: "MusicSource"; config: MusicSourceConfig }
  | { id: string; kind: "event"; type: "OnTime"; config: OnTimeConfig }
  | { id: string; kind: "event"; type: "OnWord"; config: OnWordConfig }
  | { id: string; kind: "event"; type: "OnSentence"; config: Record<string, never> }
  | { id: string; kind: "event"; type: "OnSilence"; config: OnSilenceConfig }
  | { id: string; kind: "event"; type: "OnSceneStart"; config: Record<string, never> }
  | { id: string; kind: "event"; type: "OnSceneEnd"; config: Record<string, never> }
  | { id: string; kind: "action"; type: "SetMedia"; config: SetMediaConfig }
  | { id: string; kind: "action"; type: "ShowOverlay"; config: ShowOverlayConfig }
  | { id: string; kind: "action"; type: "SetSubtitleStyle"; config: SetSubtitleStyleConfig }
  | { id: string; kind: "action"; type: "PlaySfx"; config: PlaySfxConfig }
  | { id: string; kind: "action"; type: "SetMusic"; config: SetMusicConfig }
  | { id: string; kind: "action"; type: "CameraEffect"; config: CameraEffectConfig }
  | { id: string; kind: "output"; type: "Render"; config: Record<string, never> };

export interface NarrationSourceConfig {
  mode?: "job-input" | "tts" | "audio" | "precomputed";
  text?: string;
  provider?: "talkify" | "xtts" | "custom" | "precomputed" | "edge";
  voice?: string;
  speed?: number;
  audioKey?: string;
  providerConfig?: Record<string, unknown>;
}

export interface AssetSourceConfig {
  assetIds: string[];
  assetType: "video" | "audio" | "image";
}

export interface SceneSourceConfig {
  strategy?: "job-slots" | "paragraphs" | "silence" | "even";
  fit?: "cover" | "contain";
  transitionMs?: number;
}

export interface MusicSourceConfig {
  assetIds: string[];
  volume?: number;
  mode?: "random-loop" | "sequential";
}

export interface OnTimeConfig {
  atMs: number;
  durationMs?: number;
}

export interface OnWordConfig {
  word?: string;
  match?: "exact" | "contains";
  caseSensitive?: boolean;
}

export interface OnSilenceConfig {
  minDurationMs?: number;
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

export interface SetMediaConfig {
  target?: string;
  fit?: "cover" | "contain";
  transitionMs?: number;
}

export interface ShowOverlayConfig {
  assetId?: string;
  startOffsetMs?: number;
  durationMs?: number;
  position?: { x: number; y: number; width: number; height: number };
  opacity?: number;
  blendMode?: "normal" | "screen";
}

export interface SetSubtitleStyleConfig {
  wordsPerGroup?: number;
  style?: SubtitleStyle;
}

export interface PlaySfxConfig {
  assetId?: string;
  startOffsetMs?: number;
  volume?: number;
}

export interface SetMusicConfig {
  volume?: number;
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

export interface CameraEffectConfig {
  zoom?: { factor?: number; direction?: "in" | "out" | "random" };
  shake?: { intensity?: number };
  transition?: { types?: TransitionType[]; mode?: "random" | "sequential"; duration?: number };
}

export interface WordTimestamp {
  word: string;
  startMs: number;
  endMs: number;
}

export type TTSConfig = NarrationSourceConfig;
export type EffectConfig =
  | ({ type: "transition" } & NonNullable<CameraEffectConfig["transition"]>)
  | ({ type: "zoom" } & NonNullable<CameraEffectConfig["zoom"]>)
  | ({ type: "shake" } & NonNullable<CameraEffectConfig["shake"]>);
export type TransitionConfig = NonNullable<CameraEffectConfig["transition"]>;
export type ZoomConfig = NonNullable<CameraEffectConfig["zoom"]>;
export type ShakeConfig = NonNullable<CameraEffectConfig["shake"]>;
