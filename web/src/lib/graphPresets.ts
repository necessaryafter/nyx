import type { Graph } from "./types";
import { DEFAULT_GRAPH } from "./defaultGraph";

export interface GraphPreset {
  id: string;
  label: string;
  description: string;
  tags: string[];
  graph: Graph;
}

function cloneGraph(graph: Graph): Graph {
  return JSON.parse(JSON.stringify(graph)) as Graph;
}

const simple = cloneGraph(DEFAULT_GRAPH);
simple.nodes = simple.nodes.filter((n) => !["SetSubtitleStyle", "OnSentence"].includes(n.type));
simple.edges = simple.edges.filter((e) => !["on-sentence", "subtitle"].includes(e.from) && !["on-sentence", "subtitle"].includes(e.to));

const overlay = cloneGraph(DEFAULT_GRAPH);
overlay.nodes.push(
  { id: "on-word", kind: "event", type: "OnWord", config: { match: "contains", caseSensitive: false } },
  { id: "overlay", kind: "action", type: "ShowOverlay", config: { startOffsetMs: 0, durationMs: 1200, position: { x: 420, y: 680, width: 240, height: 240 } } },
);
overlay.edges.push(
  { id: "e10", from: "narration", to: "on-word", role: "narration" },
  { id: "e11", from: "on-word", to: "overlay", role: "trigger" },
  { id: "e12", from: "overlay", to: "render" },
);

const reddit = cloneGraph(DEFAULT_GRAPH);
reddit.nodes = [
  { id: "narration", kind: "source", type: "NarrationSource", config: { mode: "job-input", provider: "talkify" } },
  { id: "background", kind: "source", type: "AssetSource", config: { assetIds: [], assetType: "video" } },
  { id: "on-sentence", kind: "event", type: "OnSentence", config: {} },
  { id: "subtitle", kind: "action", type: "SetSubtitleStyle", config: { wordsPerGroup: 2, style: { position: "center", fontSize: 72, color: "#ffffff", strokeColor: "#000000", strokeWidth: 8, highlightColor: "#FFD700" } } },
  { id: "title-card", kind: "action", type: "ShowTitleCard", config: { subreddit: "r/historias", username: "", timeAgo: "há 5h", flair: "", upvotes: "18.4k", comments: "1.2k" } },
  { id: "render", kind: "output", type: "Render", config: {} },
];
reddit.edges = [
  { id: "e1", from: "narration", to: "on-sentence", role: "narration" },
  { id: "e2", from: "on-sentence", to: "subtitle", role: "trigger" },
  { id: "e3", from: "subtitle", to: "render" },
  { id: "e4", from: "title-card", to: "render" },
];

export const GRAPH_PRESETS: GraphPreset[] = [
  {
    id: "v2-scenes",
    label: "V2 Cenas + Legenda",
    description: "Narração, slots de cena, legenda por frase e camera effect.",
    tags: ["V2", "Scenes", "Subtitle"],
    graph: DEFAULT_GRAPH,
  },
  {
    id: "v2-simple",
    label: "V2 Simples",
    description: "Narração e mídia por cena sem legenda.",
    tags: ["V2", "Simple"],
    graph: simple,
  },
  {
    id: "reddit-video",
    label: "Reddit Video",
    description: "Vídeo fixo no fundo (gameplay/parkour) com narração e legenda karaoke no centro.",
    tags: ["Reddit", "Background Video", "Subtitle"],
    graph: reddit,
  },
  {
    id: "v2-overlay",
    label: "V2 Overlay por Palavra",
    description: "Dispara overlay a partir de OnWord.",
    tags: ["V2", "OnWord", "Overlay"],
    graph: overlay,
  },
];
