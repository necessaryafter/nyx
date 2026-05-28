import { z } from "zod";

export const uploadAssetSchema = z.object({
  name: z.string().min(1),
  type: z.enum(["video", "audio", "text", "image"]),
});

const renderSettingsSchema = z.object({
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  fps: z.number().int().positive(),
  format: z.enum(["mp4", "webm"]).optional(),
  musicVolume: z.number().min(0).max(1).optional(),
});

const assetTypeSchema = z.enum(["video", "audio", "image"]);

const narrationSourceConfigSchema = z.object({
  mode: z.enum(["job-input", "tts", "audio", "precomputed"]).default("job-input"),
  text: z.string().min(1).optional(),
  provider: z.enum(["talkify", "custom", "precomputed", "edge"]).default("talkify"),
  voice: z.string().optional(),
  speed: z.number().positive().optional(),
  audioKey: z.string().optional(),
  providerConfig: z.record(z.string(), z.unknown()).optional(),
});

const assetSourceConfigSchema = z.object({
  assetIds: z.array(z.string().uuid()),
  assetType: assetTypeSchema,
});

const sceneSourceConfigSchema = z.object({
  strategy: z.enum(["job-slots", "paragraphs", "silence", "even"]).default("job-slots"),
  fit: z.enum(["cover", "contain"]).optional(),
  transitionMs: z.number().nonnegative().optional(),
});

const musicSourceConfigSchema = z.object({
  assetIds: z.array(z.string().uuid()),
  volume: z.number().min(0).max(1).optional(),
  mode: z.enum(["random-loop", "sequential"]).default("random-loop"),
});

const onTimeConfigSchema = z.object({
  atMs: z.number().nonnegative(),
  durationMs: z.number().positive().optional(),
});

const onWordConfigSchema = z.object({
  word: z.string().min(1).optional(),
  match: z.enum(["exact", "contains"]).default("contains"),
  caseSensitive: z.boolean().default(false),
});

const onSentenceConfigSchema = z.object({});

const onSilenceConfigSchema = z.object({
  minDurationMs: z.number().positive().default(500),
});

const onSceneConfigSchema = z.object({});

const subtitleStyleSchema = z.object({
  fontFamily: z.string().optional(),
  fontSize: z.number().positive().optional(),
  color: z.string().optional(),
  highlightColor: z.string().optional(),
  strokeColor: z.string().optional(),
  strokeWidth: z.number().nonnegative().optional(),
  position: z.enum(["top", "center", "bottom"]).optional(),
});

const overlayPositionSchema = z.object({
  x: z.number().int().nonnegative(),
  y: z.number().int().nonnegative(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});

const transitionTypeEnum = z.enum([
  "fade", "fadewhite", "fadegrays", "dissolve", "distance", "pixelize", "hblur",
  "wipeleft", "wipeup", "wipetr", "wipebl", "wipebr",
  "slideright", "slideup", "slidedown",
  "circleopen", "circleclose", "circlecrop", "rectcrop",
  "radial",
  "smoothleft", "smoothright", "smoothup", "smoothdown",
  "coverleft", "coverright", "coverup", "coverdown",
  "revealleft", "revealright", "revealup", "revealdown",
  "horzopen", "horzclose", "vertopen", "vertclose",
  "hlslice", "hrslice", "vuslice", "vdslice",
  "hlwind", "hrwind", "vuwind",
  "squeezeh", "squeezev",
  "diagtl", "diagtr", "diagbl", "diagbr",
  "zoomin",
]);

const setMediaConfigSchema = z.object({
  target: z.string().default("main"),
  fit: z.enum(["cover", "contain"]).optional(),
  transitionMs: z.number().nonnegative().optional(),
});

const showOverlayConfigSchema = z.object({
  assetId: z.string().uuid().optional(),
  startOffsetMs: z.number().default(0),
  durationMs: z.number().positive().default(1000),
  position: overlayPositionSchema.default({ x: 0, y: 0, width: 240, height: 240 }),
  opacity: z.number().min(0).max(1).optional(),
  blendMode: z.enum(["normal", "screen"]).optional(),
});

const setSubtitleStyleConfigSchema = z.object({
  wordsPerGroup: z.number().int().min(1).max(10).default(3),
  style: subtitleStyleSchema.optional(),
});

const playSfxConfigSchema = z.object({
  assetId: z.string().uuid().optional(),
  startOffsetMs: z.number().default(0),
  volume: z.number().min(0).max(1).optional(),
});

const setMusicConfigSchema = z.object({
  volume: z.number().min(0).max(1).optional(),
});

const cameraEffectConfigSchema = z.object({
  zoom: z.object({
    factor: z.number().min(1).max(1.3).default(1.05),
    direction: z.enum(["in", "out", "random"]).default("in"),
  }).optional(),
  shake: z.object({
    intensity: z.number().min(0).max(10).default(0),
  }).optional(),
  transition: z.object({
    types: z.array(transitionTypeEnum).min(1).default(["fade"]),
    mode: z.enum(["random", "sequential"]).default("random"),
    duration: z.number().positive().max(3).default(0.5),
  }).optional(),
});

const renderConfigSchema = z.object({});

const blueprintNodeSchema = z.discriminatedUnion("type", [
  z.object({ id: z.string(), kind: z.literal("source"), type: z.literal("NarrationSource"), config: narrationSourceConfigSchema }),
  z.object({ id: z.string(), kind: z.literal("source"), type: z.literal("AssetSource"), config: assetSourceConfigSchema }),
  z.object({ id: z.string(), kind: z.literal("source"), type: z.literal("SceneSource"), config: sceneSourceConfigSchema }),
  z.object({ id: z.string(), kind: z.literal("source"), type: z.literal("MusicSource"), config: musicSourceConfigSchema }),
  z.object({ id: z.string(), kind: z.literal("event"), type: z.literal("OnTime"), config: onTimeConfigSchema }),
  z.object({ id: z.string(), kind: z.literal("event"), type: z.literal("OnWord"), config: onWordConfigSchema }),
  z.object({ id: z.string(), kind: z.literal("event"), type: z.literal("OnSentence"), config: onSentenceConfigSchema }),
  z.object({ id: z.string(), kind: z.literal("event"), type: z.literal("OnSilence"), config: onSilenceConfigSchema }),
  z.object({ id: z.string(), kind: z.literal("event"), type: z.literal("OnSceneStart"), config: onSceneConfigSchema }),
  z.object({ id: z.string(), kind: z.literal("event"), type: z.literal("OnSceneEnd"), config: onSceneConfigSchema }),
  z.object({ id: z.string(), kind: z.literal("action"), type: z.literal("SetMedia"), config: setMediaConfigSchema }),
  z.object({ id: z.string(), kind: z.literal("action"), type: z.literal("ShowOverlay"), config: showOverlayConfigSchema }),
  z.object({ id: z.string(), kind: z.literal("action"), type: z.literal("SetSubtitleStyle"), config: setSubtitleStyleConfigSchema }),
  z.object({ id: z.string(), kind: z.literal("action"), type: z.literal("PlaySfx"), config: playSfxConfigSchema }),
  z.object({ id: z.string(), kind: z.literal("action"), type: z.literal("SetMusic"), config: setMusicConfigSchema }),
  z.object({ id: z.string(), kind: z.literal("action"), type: z.literal("CameraEffect"), config: cameraEffectConfigSchema }),
  z.object({ id: z.string(), kind: z.literal("output"), type: z.literal("Render"), config: renderConfigSchema }),
]);

const blueprintEdgeSchema = z.object({
  id: z.string(),
  from: z.string(),
  to: z.string(),
  role: z.enum(["media", "sfx", "music", "overlay", "narration", "scene", "trigger"]).optional(),
});

export const graphSchema = z.object({
  version: z.literal(2),
  settings: renderSettingsSchema,
  nodes: z.array(blueprintNodeSchema).min(1),
  edges: z.array(blueprintEdgeSchema),
});

export const graphDraftSchema = z.object({
  version: z.literal(2),
  settings: renderSettingsSchema,
  nodes: z.array(blueprintNodeSchema),
  edges: z.array(blueprintEdgeSchema),
});

export type GraphInput = z.infer<typeof graphSchema>;
export type BlueprintNode = z.infer<typeof blueprintNodeSchema>;

const EDGE_RULES = new Set([
  "source:event",
  "source:action",
  "event:action",
  "action:output",
  "source:output",
]);

export function validateGraphStructure(graph: GraphInput): string[] {
  const errors: string[] = [];
  const nodeMap = new Map(graph.nodes.map((n) => [n.id, n]));

  const renderNodes = graph.nodes.filter((n) => n.type === "Render");
  if (renderNodes.length !== 1) {
    errors.push(`graph must have exactly 1 Render node, found ${renderNodes.length}`);
  }

  const hasSceneSource = graph.nodes.some((n) => n.type === "SceneSource");
  const visualAssetSource = graph.nodes.find(
    (n) => n.type === "AssetSource" && (n.config.assetType === "video" || n.config.assetType === "image"),
  );
  const hasSetMedia = graph.nodes.some((n) => n.type === "SetMedia");

  if (!hasSceneSource && !visualAssetSource && !hasSetMedia) {
    errors.push("graph must have a visual source (SceneSource or AssetSource) or SetMedia action");
  }

  if (!hasSceneSource && visualAssetSource && visualAssetSource.type === "AssetSource" && visualAssetSource.config.assetIds.length === 0) {
    errors.push("AssetSource has no assets assigned — add media files to the template before rendering");
  }

  for (const edge of graph.edges) {
    const fromNode = nodeMap.get(edge.from);
    const toNode = nodeMap.get(edge.to);

    if (!fromNode) {
      errors.push(`edge "${edge.id}": source node "${edge.from}" not found`);
      continue;
    }
    if (!toNode) {
      errors.push(`edge "${edge.id}": target node "${edge.to}" not found`);
      continue;
    }

    const rule = `${fromNode.kind}:${toNode.kind}`;
    if (!EDGE_RULES.has(rule)) {
      errors.push(`edge "${edge.id}": invalid connection ${fromNode.kind} -> ${toNode.kind}`);
    }
  }

  return errors;
}

export const createTemplateSchema = z.object({
  name: z.string().min(1),
  graph: graphDraftSchema,
});

export const updateTemplateSchema = z.object({
  name: z.string().min(1).optional(),
  graph: graphDraftSchema.optional(),
});

export const sceneSlotSchema = z.object({
  index: z.number().int().nonnegative(),
  startMs: z.number().nonnegative(),
  endMs: z.number().positive(),
  assetId: z.string().uuid().nullable(),
});

export type SceneSlot = z.infer<typeof sceneSlotSchema>;

export const createDraftJobSchema = z.object({
  templateId: z.string().uuid(),
});

export const startAudioSchema = z.object({
  narration: z.discriminatedUnion("type", [
    z.object({
      type: z.literal("tts"),
      text: z.string().min(1),
      provider: z.enum(["talkify", "edge"]),
      voice: z.string().optional(),
      speed: z.number().positive().optional(),
    }),
    z.object({ type: z.literal("audio"), assetId: z.string().uuid() }),
  ]),
});

export const updateSlotsSchema = z.object({
  slots: z.array(z.object({
    index: z.number().int().nonnegative(),
    assetId: z.string().uuid().nullable(),
    startMs: z.number().nonnegative().optional(),
    endMs: z.number().positive().optional(),
  })).min(1),
});


export const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  type: z.enum(["video", "audio", "text", "image"]).optional(),
  search: z.string().optional(),
});

export const creditFilterSchema = z.object({
  reason: z.enum(["render", "tts", "purchase"]).optional(),
  from: z.string().date().optional(),
  to: z.string().date().optional(),
});
