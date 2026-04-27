 import type { Graph } from "./types";

export interface GraphPreset {
  id: string;
  label: string;
  description: string;
  tags: string[];
  graph: Graph;
}

/** Preset 1: Dark Video Padrão — pool de vídeos + TTS + legenda karaokê + música */
const darkVideoPadrao: Graph = {
  version: 1,
  nodes: [
    { id: "pool-video", type: "MediaPool", config: { assetIds: [], assetType: "video" } },
    { id: "pool-audio", type: "MediaPool", config: { assetIds: [], assetType: "audio" } },
    { id: "tts",        type: "TTS",       config: { provider: "talkify" } },
    { id: "videofit",   type: "VideoFit",  config: { mode: "random-loop" } },
    { id: "subtitle",   type: "Subtitle",  config: { wordsPerGroup: 3 } },
    { id: "layer",      type: "Layer",     config: {} },
    { id: "render",     type: "Render",    config: { width: 1080, height: 1920, fps: 30, musicVolume: 0.15 } },
  ],
  edges: [
    { id: "e1", from: "pool-video", fromHandle: "items",      to: "videofit", toHandle: "items" },
    { id: "e2", from: "tts",        fromHandle: "audio",      to: "videofit", toHandle: "audio" },
    { id: "e3", from: "tts",        fromHandle: "timestamps", to: "subtitle", toHandle: "timestamps" },
    { id: "e4", from: "videofit",   fromHandle: "video",      to: "layer",    toHandle: "base" },
    { id: "e5", from: "subtitle",   fromHandle: "filter",     to: "layer",    toHandle: "overlay" },
    { id: "e6", from: "layer",      fromHandle: "video",      to: "render",   toHandle: "video" },
    { id: "e7", from: "videofit",   fromHandle: "audio",      to: "render",   toHandle: "audio" },
    { id: "e8", from: "pool-audio", fromHandle: "items",      to: "render",   toHandle: "music" },
  ],
};

/** Preset 2: Com Intro — SceneSlot como intro fixo + pool de vídeos para o restante */
const comIntro: Graph = {
  version: 1,
  nodes: [
    { id: "scene-intro", type: "SceneSlot", config: { label: "Intro", assetType: "video", assetIds: [] } },
    { id: "pool-video",  type: "MediaPool", config: { assetIds: [], assetType: "video" } },
    { id: "pool-audio",  type: "MediaPool", config: { assetIds: [], assetType: "audio" } },
    { id: "tts",         type: "TTS",       config: { provider: "talkify" } },
    { id: "videofit",    type: "VideoFit",  config: { mode: "random-loop" } },
    { id: "subtitle",    type: "Subtitle",  config: { wordsPerGroup: 3 } },
    { id: "layer",       type: "Layer",     config: {} },
    { id: "render",      type: "Render",    config: { width: 1080, height: 1920, fps: 30, musicVolume: 0.15 } },
  ],
  edges: [
    { id: "e1", from: "scene-intro", fromHandle: "items",      to: "videofit", toHandle: "intro" },
    { id: "e2", from: "pool-video",  fromHandle: "items",      to: "videofit", toHandle: "items" },
    { id: "e3", from: "tts",         fromHandle: "audio",      to: "videofit", toHandle: "audio" },
    { id: "e4", from: "tts",         fromHandle: "timestamps", to: "subtitle", toHandle: "timestamps" },
    { id: "e5", from: "videofit",    fromHandle: "video",      to: "layer",    toHandle: "base" },
    { id: "e6", from: "subtitle",    fromHandle: "filter",     to: "layer",    toHandle: "overlay" },
    { id: "e7", from: "layer",       fromHandle: "video",      to: "render",   toHandle: "video" },
    { id: "e8", from: "videofit",    fromHandle: "audio",      to: "render",   toHandle: "audio" },
    { id: "e9", from: "pool-audio",  fromHandle: "items",      to: "render",   toHandle: "music" },
  ],
};

/** Preset 3: Simples — sem legenda, sem Layer, direto ao ponto */
const simples: Graph = {
  version: 1,
  nodes: [
    { id: "pool-video", type: "MediaPool", config: { assetIds: [], assetType: "video" } },
    { id: "pool-audio", type: "MediaPool", config: { assetIds: [], assetType: "audio" } },
    { id: "tts",        type: "TTS",       config: { provider: "talkify" } },
    { id: "videofit",   type: "VideoFit",  config: { mode: "random-loop" } },
    { id: "render",     type: "Render",    config: { width: 1080, height: 1920, fps: 30, musicVolume: 0.15 } },
  ],
  edges: [
    { id: "e1", from: "pool-video", fromHandle: "items", to: "videofit", toHandle: "items" },
    { id: "e2", from: "tts",        fromHandle: "audio", to: "videofit", toHandle: "audio" },
    { id: "e3", from: "videofit",   fromHandle: "video", to: "render",   toHandle: "video" },
    { id: "e4", from: "videofit",   fromHandle: "audio", to: "render",   toHandle: "audio" },
    { id: "e5", from: "pool-audio", fromHandle: "items", to: "render",   toHandle: "music" },
  ],
};

/** Preset 4: Efeitos Completos — Transition + Zoom + Shake, sem composição */
const efeitosCompletos: Graph = {
  version: 1,
  nodes: [
    { id: "pool-video",  type: "MediaPool",  config: { assetIds: [], assetType: "video" } },
    { id: "pool-audio",  type: "MediaPool",  config: { assetIds: [], assetType: "audio" } },
    { id: "tts",         type: "TTS",        config: { provider: "talkify" } },
    { id: "transition",  type: "Transition", config: { types: ["fade"], mode: "random", duration: 0.5 } },
    { id: "zoom",        type: "Zoom",       config: { factor: 1.05, direction: "in" } },
    { id: "shake",       type: "Shake",      config: { intensity: 3 } },
    { id: "videofit",    type: "VideoFit",   config: { mode: "random-loop" } },
    { id: "render",      type: "Render",     config: { width: 1080, height: 1920, fps: 30, musicVolume: 0.15 } },
  ],
  edges: [
    { id: "e1", from: "pool-video",  fromHandle: "items",  to: "videofit", toHandle: "items" },
    { id: "e2", from: "tts",         fromHandle: "audio",  to: "videofit", toHandle: "audio" },
    { id: "e3", from: "transition",  fromHandle: "effect", to: "videofit", toHandle: "effects" },
    { id: "e4", from: "zoom",        fromHandle: "effect", to: "videofit", toHandle: "effects" },
    { id: "e5", from: "shake",       fromHandle: "effect", to: "videofit", toHandle: "effects" },
    { id: "e6", from: "videofit",    fromHandle: "video",  to: "render",   toHandle: "video" },
    { id: "e7", from: "videofit",    fromHandle: "audio",  to: "render",   toHandle: "audio" },
    { id: "e8", from: "pool-audio",  fromHandle: "items",  to: "render",   toHandle: "music" },
  ],
};

export const GRAPH_PRESETS: GraphPreset[] = [
  {
    id: "dark-padrao",
    label: "Dark Video Padrão",
    description: "Pool de vídeos + TTS + legenda karaokê sincronizada + música de fundo.",
    tags: ["TTS", "Legenda", "Música"],
    graph: darkVideoPadrao,
  },
  {
    id: "com-intro",
    label: "Com Intro",
    description: "Vídeo de intro personalizado (escolhido por render) seguido do pool de clipes.",
    tags: ["Intro", "SceneSlot", "TTS", "Legenda"],
    graph: comIntro,
  },
  {
    id: "simples",
    label: "Simples",
    description: "Apenas vídeo + narração + música. Sem legenda, ideal para testes rápidos.",
    tags: ["TTS", "Música"],
    graph: simples,
  },
  {
    id: "efeitos-completos",
    label: "Efeitos Completos",
    description: "Transition + Zoom + Shake nos clipes. Sem composição — direto para o Render.",
    tags: ["Transition", "Zoom", "Shake", "TTS"],
    graph: efeitosCompletos,
  },
];
