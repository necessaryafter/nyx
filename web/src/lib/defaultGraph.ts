import type { Graph } from "./types";

function id(name: string) { return name; }

export const DEFAULT_GRAPH: Graph = {
  version: 2,
  settings: { width: 1080, height: 1920, fps: 30, format: "mp4", musicVolume: 0.15 },
  nodes: [
    { id: id("narration"), kind: "source", type: "NarrationSource", config: { mode: "job-input", provider: "talkify" } },
    { id: id("scenes"), kind: "source", type: "SceneSource", config: { strategy: "job-slots", fit: "cover", transitionMs: 250 } },
    { id: id("music"), kind: "source", type: "MusicSource", config: { assetIds: [], mode: "random-loop", volume: 0.15 } },
    { id: id("on-sentence"), kind: "event", type: "OnSentence", config: {} },
    { id: id("on-scene-start"), kind: "event", type: "OnSceneStart", config: {} },
    { id: id("subtitle"), kind: "action", type: "SetSubtitleStyle", config: { wordsPerGroup: 3, style: { position: "bottom" } } },
    { id: id("media"), kind: "action", type: "SetMedia", config: { target: "main", fit: "cover", transitionMs: 250 } },
    { id: id("camera"), kind: "action", type: "CameraEffect", config: { zoom: { factor: 1.05, direction: "in" } } },
    { id: id("render"), kind: "output", type: "Render", config: {} },
  ],
  edges: [
    { id: "e1", from: "narration", to: "on-sentence", role: "narration" },
    { id: "e2", from: "narration", to: "on-scene-start", role: "narration" },
    { id: "e3", from: "on-sentence", to: "subtitle", role: "trigger" },
    { id: "e4", from: "on-scene-start", to: "media", role: "trigger" },
    { id: "e5", from: "on-scene-start", to: "camera", role: "trigger" },
    { id: "e6", from: "media", to: "render" },
    { id: "e7", from: "subtitle", to: "render" },
    { id: "e8", from: "camera", to: "render" },
    { id: "e9", from: "music", to: "render", role: "music" },
  ],
};
