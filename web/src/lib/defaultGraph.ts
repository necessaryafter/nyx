import type { Graph } from "./types";

function id(name: string) { return name; }

/**
 * Template padrão: Dark Video com legenda karaokê
 * MediaPool(video) → VideoFit → Layer → Render
 * TTS → VideoFit (audio+timestamps) → Subtitle → Layer
 * VideoFit.audio → Render.audio
 * MediaPool(audio) → Render.music
 */
export const DEFAULT_GRAPH: Graph = {
  version: 1,
  nodes: [
    { id: id("pool-video"), type: "MediaPool", config: { assetIds: [], assetType: "video" } },
    { id: id("pool-audio"), type: "MediaPool", config: { assetIds: [], assetType: "audio" } },
    { id: id("tts"),        type: "TTS",       config: { provider: "talkify" } },
    { id: id("videofit"),   type: "VideoFit",  config: { mode: "random-loop" } },
    { id: id("subtitle"),   type: "Subtitle",  config: { wordsPerGroup: 3 } },
    { id: id("layer"),      type: "Layer",     config: {} },
    { id: id("render"),     type: "Render",    config: { width: 1080, height: 1920, fps: 30, musicVolume: 0.15 } },
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
