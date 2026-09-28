import type { Graph, WordTimestamp } from "../graph";
import type { ResolvedSceneSlot, SceneAsset } from "../prepare/scenes";
import { buildEventTimeline } from "./events";
import { resolveActions } from "./actions";
import { extractCamera, type CameraEffects } from "./camera";
import { extractSubtitles, type SubtitleConfig } from "./subtitles";
import { extractOverlays, type PendingOverlay } from "./overlays";
import { extractSfx, type PendingSfx } from "./sfx";
import { extractMusic, type MusicConfig } from "./music";
import { extractMediaPool, type MediaPool } from "./pool";
import { extractTitleCard, type TitleCardPlan } from "./titleCard";

export type { TitleCardPlan, SceneAsset, CameraEffects, SubtitleConfig, PendingOverlay, PendingSfx, MusicConfig, MediaPool };

export interface RenderPlan {
  settings: Graph["settings"];
  audioPath: string;
  timestamps: WordTimestamp[];
  scenes: SceneAsset[];
  pool: MediaPool;
  camera: CameraEffects;
  overlays: PendingOverlay[];
  subtitles?: SubtitleConfig;
  music: MusicConfig;
  sfx: PendingSfx[];
  titleCard?: TitleCardPlan;
}

export interface CompilePlanInput {
  graph: Graph;
  audioPath: string;
  timestamps: WordTimestamp[];
  assetMap: Map<string, string>;
  sceneAssets: SceneAsset[];
}

export function compilePlan({ graph, audioPath, timestamps, assetMap, sceneAssets }: CompilePlanInput): RenderPlan {
  const slotLike: ResolvedSceneSlot[] = sceneAssets.map((s) => ({
    index: s.index,
    startMs: s.startMs,
    endMs: s.endMs,
    assetId: s.localPath,
  }));

  const events = buildEventTimeline(graph, timestamps, slotLike);
  const actions = resolveActions(graph, events);

  return {
    settings: graph.settings,
    audioPath,
    timestamps,
    scenes: sceneAssets,
    pool: extractMediaPool(graph, sceneAssets, assetMap),
    camera: extractCamera(graph),
    overlays: extractOverlays(actions, assetMap),
    subtitles: extractSubtitles(graph, actions),
    music: extractMusic(graph, assetMap),
    sfx: extractSfx(actions, assetMap),
    titleCard: extractTitleCard(graph, timestamps),
  };
}
