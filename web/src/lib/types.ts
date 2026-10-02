export type JobStatus =
  | "draft"
  | "audio_processing"
  | "audio_ready"
  | "ready"
  | "rendering"
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
  narrationText?: string;
}

export interface JobGraph {
  nodes: Array<{ type: string; config?: Record<string, unknown> }>;
}

export interface Job {
  id: string;
  status: JobStatus;
  templateId: string;
  templateName?: string | null;
  graph?: JobGraph | null;
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

// ── job-scheduler ──

export type SchedulerMode = "single" | "parts";
export type SchedulerRunStatus = "pending" | "scripting" | "rendering" | "done" | "partial" | "failed";

export interface Scheduler {
  id: string;
  name: string;
  templateId: string;
  templateName: string | null;
  theme: string;
  assetIds: string[];
  musicAssetIds: string[];
  mode: SchedulerMode;
  totalMinutes: number | null;
  partsCount: number | null;
  minutesPerPart: number | null;
  noRepeatAssetsAcrossParts: boolean;
  randomizeAssetOrder: boolean;
  backgroundSpeed: number;
  narration: SchedulerNarration | null;
  ctaTemplate: string;
  finalCtaTemplate: string | null;
  finalPartEnabled: boolean;
  finalPartLabel: string;
  aiProvider: string;
  aiModel: string;
  cronPattern: string | null;
  timezone: string;
  enabled: boolean;
  lastRunAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SchedulerListItem extends Scheduler {
  lastRun: { id: string; status: SchedulerRunStatus; partsDone: number; partsTotal: number; createdAt: string } | null;
  nextRunAt: string | null;
}

export interface RunPart {
  jobId: string;
  partIndex: number | null;
  status: JobStatus;
  durationSeconds: number | null;
  hasVideo: boolean;
}

export interface SchedulerRun {
  id: string;
  schedulerId: string;
  status: SchedulerRunStatus;
  triggeredBy: "manual" | "schedule";
  title: string | null;
  partsTotal: number;
  partsDone: number;
  error: string | null;
  createdAt: string;
  completedAt: string | null;
  parts: RunPart[];
}

export interface SchedulerDetail extends Scheduler {
  nextRunAt: string | null;
  runs: SchedulerRun[];
}

export interface SeriesScriptPart {
  index: number;
  text: string;
  body: string;
  targetWords: number;
  actualWords: number;
  outOfBudget: boolean;
}

export interface SeriesScript {
  title: string;
  parts: SeriesScriptPart[];
  model: string;
}

export interface SchedulerEstimate {
  partsTotal: number;
  minutesPerPart: number;
  wordsPerPart: number;
  creditsPerPart: number;
  creditsTotal: number;
}

export interface Asset {
  id: string;
  name: string;
  type: "video" | "audio" | "text" | "image";
  sizeBytes: number | null;
  category: string | null; // null = avulso (fora de qualquer categoria)
  importBatchId: string | null;
  createdAt: string;
}

export interface AssetCategories {
  categories: { category: string; count: number }[];
  none: number; // quantos estão avulsos
  total: number;
}

/** Filtro de categoria nas listagens: undefined = todas, NO_CATEGORY = só avulsos, senão o nome. */
export const NO_CATEGORY = "__none__";

// ── asset-import ──

export type ImportBatchStatus =
  | "detecting" | "awaiting_fallback_choice" | "awaiting_review" | "done" | "discarded" | "failed";

export interface ImportSegment {
  index: number;
  startMs: number;
  endMs: number;
  thumbnailUrl: string;
  clipUrl: string;
  selected: boolean;
  name?: string;
}

export interface ImportBatch {
  id: string;
  sourceName: string;
  status: ImportBatchStatus;
  segments: ImportSegment[];
  error: string | null;
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

export interface RenderSettings {
  width: number;
  height: number;
  fps: number;
  format?: "mp4" | "webm";
  musicVolume?: number;
}

export type NodeKind = "source" | "event" | "action" | "output";

export type NodeType =
  | "NarrationSource"
  | "AssetSource"
  | "SceneSource"
  | "MusicSource"
  | "OnTime"
  | "OnWord"
  | "OnSentence"
  | "OnSilence"
  | "OnSceneStart"
  | "OnSceneEnd"
  | "SetMedia"
  | "ShowOverlay"
  | "SetSubtitleStyle"
  | "PlaySfx"
  | "SetMusic"
  | "CameraEffect"
  | "ShowTitleCard"
  | "ShowWatermark"
  | "Render";

export interface GraphEdge {
  id: string;
  from: string;
  to: string;
  role?: "media" | "sfx" | "music" | "overlay" | "narration" | "scene" | "trigger";
}

/** Config de voz: nó Narração e voz própria do scheduler (mesmo formato no backend). */
export interface VoiceConfig {
  voice?: string;
  speed?: number;
  // Só gemini:
  model?: string;
  paceMode?: "style" | "slider";
  stylePreset?: "rapido" | "moderado" | "lento" | "custom";
  style?: string;
}

/** Voz própria do scheduler; null = usa a do nó Narração do template. */
export type SchedulerNarration = { provider: "edge" | "gemini" } & VoiceConfig;

export interface NarrationSourceConfig extends VoiceConfig {
  mode?: "job-input" | "tts" | "audio" | "precomputed";
  text?: string;
  provider?: "talkify" | "custom" | "precomputed" | "edge" | "gemini";
  audioKey?: string;
  providerConfig?: Record<string, unknown>;
}

export interface AssetSourceConfig {
  assetIds: string[];
  assetType: "video" | "audio" | "image";
  mode?: "random-loop" | "sequential";
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
  fadeInMs?: number;
  fadeOutMs?: number;
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

/** Card estilo post do Reddit; o título é sempre a primeira frase da narração. */
/** Marca d'água do vídeo: imagem pequena no canto inferior direito, do primeiro ao último frame. */
export interface ShowWatermarkConfig {
  assetId?: string | null;
  widthPercent?: number; // % da largura do vídeo
  opacity?: number; // 0.1..1
  marginPercent?: number; // % da largura
}

export type TitleCardField = "subreddit" | "username" | "timeAgo" | "flair" | "upvotes" | "comments";

export interface ShowTitleCardConfig {
  auto?: TitleCardField[]; // campos sorteados a cada vídeo quando vazios
  avatarAssetId?: string | null; // imagem (asset) no lugar da letra do avatar
  subreddit?: string;
  username?: string;
  timeAgo?: string;
  flair?: string;
  upvotes?: string;
  comments?: string;
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

export type GraphNode =
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
  | { id: string; kind: "action"; type: "ShowTitleCard"; config: ShowTitleCardConfig }
  | { id: string; kind: "action"; type: "ShowWatermark"; config: ShowWatermarkConfig }
  | { id: string; kind: "output"; type: "Render"; config: Record<string, never> };

export interface Graph {
  version: 2;
  settings: RenderSettings;
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface TemplateWithGraph extends Template {
  graph: Graph;
}

