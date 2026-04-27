import type { NodeType } from "./types";

export interface NodeDefinition {
  label: string;
  description: string;
  icon: string;
  color: string;
  defaultConfig: Record<string, unknown>;
}

export const NODE_DEFINITIONS: Record<NodeType, NodeDefinition> = {
  MediaPool: {
    label: "MediaPool",
    description: "Pool de assets de mídia",
    icon: "Database",
    color: "nyx-cyan-500",
    defaultConfig: { assetIds: [], assetType: "video" },
  },
  SceneSlot: {
    label: "SceneSlot",
    description: "Slot de asset por render",
    icon: "Film",
    color: "nyx-cyan-500",
    defaultConfig: { label: "Cena", assetType: "video", assetIds: [] },
  },
  VideoFit: {
    label: "VideoFit",
    description: "Monta vídeo a partir de pool",
    icon: "Scissors",
    color: "nyx-orange-500",
    defaultConfig: { mode: "random-loop" },
  },
  TTS: {
    label: "TTS",
    description: "Text-to-Speech",
    icon: "Mic",
    color: "nyx-cyan-500",
    defaultConfig: { provider: "talkify" },
  },
  Subtitle: {
    label: "Subtitle",
    description: "Legendas karaokê",
    icon: "Captions",
    color: "nyx-orange-500",
    defaultConfig: { wordsPerGroup: 3 },
  },
  Layer: {
    label: "Layer",
    description: "Composição de camadas",
    icon: "Layers",
    color: "cyan-400",
    defaultConfig: {},
  },
  Overlay: {
    label: "Overlay",
    description: "Imagem/vídeo com timing",
    icon: "ImagePlay",
    color: "cyan-400",
    defaultConfig: { startSeconds: 0, durationSeconds: 5, position: { x: 0, y: 0, width: 200, height: 200 }, blendMode: "normal" },
  },
  Render: {
    label: "Render",
    description: "Saída final do vídeo",
    icon: "Clapperboard",
    color: "nyx-orange-400",
    defaultConfig: { width: 1080, height: 1920, fps: 30 },
  },
  Transition: {
    label: "Transition",
    description: "Transição entre clipes",
    icon: "Shuffle",
    color: "nyx-orange-500",
    defaultConfig: { types: ["fade"], mode: "random", duration: 0.5 },
  },
  Zoom: {
    label: "Zoom",
    description: "Zoom uniforme nos clipes",
    icon: "ZoomIn",
    color: "nyx-orange-500",
    defaultConfig: { factor: 1.05, direction: "in" },
  },
  Shake: {
    label: "Shake",
    description: "Camera shake nos clipes",
    icon: "Waves",
    color: "nyx-orange-500",
    defaultConfig: { intensity: 3 },
  },
};

export const NODE_HANDLES: Record<NodeType, { inputs: string[]; outputs: string[] }> = {
  MediaPool: { inputs: [], outputs: ["items"] },
  SceneSlot: { inputs: [], outputs: ["items"] },
  VideoFit: { inputs: ["intro", "items", "audio", "effects"], outputs: ["video", "audio"] },
  TTS: { inputs: [], outputs: ["audio", "timestamps"] },
  Subtitle: { inputs: ["timestamps"], outputs: ["filter"] },
  Layer: { inputs: ["base", "overlay"], outputs: ["video"] },
  Overlay: { inputs: [], outputs: ["overlay", "sfx"] },
  Render: { inputs: ["video", "audio", "music", "sfx"], outputs: ["file"] },
  Transition: { inputs: [], outputs: ["effect"] },
  Zoom: { inputs: [], outputs: ["effect"] },
  Shake: { inputs: [], outputs: ["effect"] },
};

export interface NodeCategory {
  label: string;
  nodes: NodeType[];
}

export const NODE_CATEGORIES: NodeCategory[] = [
  { label: "FONTES", nodes: ["MediaPool", "SceneSlot", "TTS"] },
  { label: "PROCESSAMENTO", nodes: ["VideoFit", "Subtitle"] },
  { label: "EFEITOS", nodes: ["Transition", "Zoom", "Shake"] },
  { label: "COMPOSIÇÃO", nodes: ["Layer", "Overlay"] },
  { label: "OUTPUT", nodes: ["Render"] },
];
