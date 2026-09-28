import type { NodeKind, NodeType } from "./types";

export interface NodeDefinition {
  label: string;
  description: string;
  icon: string;
  color: string;
  kind: NodeKind;
  defaultConfig: Record<string, unknown>;
}

export const NODE_DEFINITIONS: Record<NodeType, NodeDefinition> = {
  NarrationSource: {
    label: "Narração",
    description: "Texto ou áudio que guia o vídeo",
    icon: "Mic",
    color: "nyx-cyan-500",
    kind: "source",
    defaultConfig: { mode: "job-input", provider: "talkify" },
  },
  AssetSource: {
    label: "Biblioteca",
    description: "Conjunto de mídias reutilizáveis",
    icon: "Database",
    color: "nyx-cyan-500",
    kind: "source",
    defaultConfig: { assetIds: [], assetType: "video" },
  },
  SceneSource: {
    label: "Cenas do job",
    description: "Mídia por cena baseada nos slots do job",
    icon: "Film",
    color: "nyx-cyan-500",
    kind: "source",
    defaultConfig: { strategy: "job-slots", fit: "cover", transitionMs: 250 },
  },
  MusicSource: {
    label: "Trilha",
    description: "Trilha de fundo",
    icon: "Music",
    color: "nyx-cyan-500",
    kind: "source",
    defaultConfig: { assetIds: [], mode: "random-loop", volume: 0.15 },
  },
  OnTime: {
    label: "Quando tempo passar",
    description: "Dispara em um tempo fixo",
    icon: "Clock",
    color: "nyx-orange-500",
    kind: "event",
    defaultConfig: { atMs: 0, durationMs: 1000 },
  },
  OnWord: {
    label: "Quando palavra aparecer",
    description: "Dispara quando a narração contém uma palavra",
    icon: "WholeWord",
    color: "nyx-orange-500",
    kind: "event",
    defaultConfig: { match: "contains", caseSensitive: false },
  },
  OnSentence: {
    label: "Quando frase terminar",
    description: "Dispara a cada frase",
    icon: "Pilcrow",
    color: "nyx-orange-500",
    kind: "event",
    defaultConfig: {},
  },
  OnSilence: {
    label: "Quando houver pausa",
    description: "Dispara em pausas longas",
    icon: "VolumeX",
    color: "nyx-orange-500",
    kind: "event",
    defaultConfig: { minDurationMs: 500 },
  },
  OnSceneStart: {
    label: "Início de cena",
    description: "Dispara no início de cada cena",
    icon: "StepForward",
    color: "nyx-orange-500",
    kind: "event",
    defaultConfig: {},
  },
  OnSceneEnd: {
    label: "Fim de cena",
    description: "Dispara no fim de cada cena",
    icon: "StepBack",
    color: "nyx-orange-500",
    kind: "event",
    defaultConfig: {},
  },
  SetMedia: {
    label: "Trocar mídia",
    description: "Define a mídia visual da timeline",
    icon: "ImagePlay",
    color: "cyan-400",
    kind: "action",
    defaultConfig: { target: "main", fit: "cover", transitionMs: 250 },
  },
  ShowOverlay: {
    label: "Mostrar overlay",
    description: "Mostra uma mídia sobre o vídeo",
    icon: "Image",
    color: "cyan-400",
    kind: "action",
    defaultConfig: { startOffsetMs: 0, durationMs: 1000, position: { x: 0, y: 0, width: 240, height: 240 }, blendMode: "normal" },
  },
  SetSubtitleStyle: {
    label: "Configurar legenda",
    description: "Estilo de legenda",
    icon: "Captions",
    color: "cyan-400",
    kind: "action",
    defaultConfig: { wordsPerGroup: 3, style: { position: "bottom" } },
  },
  PlaySfx: {
    label: "Tocar efeito",
    description: "Toca efeito sonoro",
    icon: "Volume2",
    color: "cyan-400",
    kind: "action",
    defaultConfig: { startOffsetMs: 0, volume: 1 },
  },
  SetMusic: {
    label: "Ajustar trilha",
    description: "Configura trilha",
    icon: "Music2",
    color: "cyan-400",
    kind: "action",
    defaultConfig: { volume: 0.15 },
  },
  ShowTitleCard: {
    label: "Card de título",
    description: "Mostra a primeira frase como post do Reddit",
    icon: "MessageSquareText",
    color: "cyan-400",
    kind: "action",
    defaultConfig: { subreddit: "r/historias", username: "", timeAgo: "há 5h", flair: "", upvotes: "18.4k", comments: "1.2k" },
  },
  CameraEffect: {
    label: "Efeito de câmera",
    description: "Zoom, shake e transições",
    icon: "Sparkles",
    color: "cyan-400",
    kind: "action",
    defaultConfig: { zoom: { factor: 1.05, direction: "in" } },
  },
  Render: {
    label: "Render final",
    description: "Saída final",
    icon: "Clapperboard",
    color: "nyx-orange-400",
    kind: "output",
    defaultConfig: {},
  },
};

export const NODE_HANDLES: Record<NodeType, { inputs: string[]; outputs: string[] }> = {
  NarrationSource: { inputs: [], outputs: ["narration"] },
  AssetSource: { inputs: [], outputs: ["media"] },
  SceneSource: { inputs: [], outputs: ["scene"] },
  MusicSource: { inputs: [], outputs: ["music"] },
  OnTime: { inputs: ["source"], outputs: ["event"] },
  OnWord: { inputs: ["source"], outputs: ["event"] },
  OnSentence: { inputs: ["source"], outputs: ["event"] },
  OnSilence: { inputs: ["source"], outputs: ["event"] },
  OnSceneStart: { inputs: ["source"], outputs: ["event"] },
  OnSceneEnd: { inputs: ["source"], outputs: ["event"] },
  SetMedia: { inputs: ["event", "media"], outputs: ["action"] },
  ShowOverlay: { inputs: ["event", "overlay"], outputs: ["action"] },
  SetSubtitleStyle: { inputs: ["event"], outputs: ["action"] },
  PlaySfx: { inputs: ["event", "sfx"], outputs: ["action"] },
  SetMusic: { inputs: ["event", "music"], outputs: ["action"] },
  CameraEffect: { inputs: ["event"], outputs: ["action"] },
  ShowTitleCard: { inputs: [], outputs: ["action"] },
  Render: { inputs: ["action", "music"], outputs: [] },
};

export interface NodeCategory {
  label: string;
  nodes: NodeType[];
}

export const NODE_CATEGORIES: NodeCategory[] = [
  { label: "ENTRADAS", nodes: ["NarrationSource", "AssetSource", "SceneSource", "MusicSource"] },
  { label: "GATILHOS", nodes: ["OnTime", "OnWord", "OnSentence", "OnSilence", "OnSceneStart", "OnSceneEnd"] },
  { label: "AÇÕES", nodes: ["SetMedia", "ShowOverlay", "SetSubtitleStyle", "PlaySfx", "SetMusic", "CameraEffect", "ShowTitleCard"] },
  { label: "SAÍDA", nodes: ["Render"] },
];
