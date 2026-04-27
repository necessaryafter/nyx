import { z } from "zod";

// ── Asset schemas ──

export const uploadAssetSchema = z.object({
  name: z.string().min(1),
  type: z.enum(["video", "audio", "text", "image"]),
});

const mediaPoolConfigSchema = z.object({
  assetIds: z.array(z.string().uuid()),
  assetType: z.enum(["video", "audio", "image"]),
});

const sceneSlotConfigSchema = z.object({
  label: z.string().min(1),
  assetType: z.enum(["video", "audio", "image"]),
  assetIds: z.array(z.uuid()), // can be empty in template
});

const videoFitConfigSchema = z.object({
  mode: z.enum(["random-loop", "sequential", "once"]).default("random-loop"),
});

const ttsConfigSchema = z.object({
  text: z.string().min(1).optional(), // optional in template — injected at job creation
  provider: z.enum(["talkify", "custom", "precomputed"]),
  voice: z.string().optional(),
  speed: z.number().positive().optional(),
  providerConfig: z.record(z.unknown()).optional(), // pass-through for advanced provider params
});

const subtitleStyleSchema = z.object({
  fontFamily: z.string().optional(),
  fontSize: z.number().positive().optional(),
  color: z.string().optional(),
  highlightColor: z.string().optional(),
  strokeColor: z.string().optional(),
  strokeWidth: z.number().nonnegative().optional(),
  position: z.enum(["top", "center", "bottom"]).optional(),
});

const subtitleConfigSchema = z.object({
  wordsPerGroup: z.number().int().min(1).max(10),
  startSeconds: z.number().nonnegative().optional(),
  endSeconds: z.number().nonnegative().optional(),
  style: subtitleStyleSchema.optional(),
});

const layerConfigSchema = z.object({});

const overlayPositionSchema = z.object({
  x: z.number().int().nonnegative(),
  y: z.number().int().nonnegative(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});

const overlayConfigSchema = z.object({
  assetId: z.string().uuid(),
  soundAssetId: z.string().uuid().optional(),
  startSeconds: z.number().nonnegative(),
  durationSeconds: z.number().positive(),
  position: overlayPositionSchema,
  opacity: z.number().min(0).max(1).optional(),
  blendMode: z.enum(["normal", "screen"]).optional(),
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

const transitionConfigSchema = z.object({
  types: z.array(transitionTypeEnum).min(1),
  mode: z.enum(["random", "sequential"]).default("random"),
  duration: z.number().positive().max(3).default(0.5),
});

const zoomConfigSchema = z.object({
  factor: z.number().min(1.0).max(1.3).default(1.05),
  direction: z.enum(["in", "out", "random"]).default("in"),
});

const shakeConfigSchema = z.object({
  intensity: z.number().min(0).max(10).default(3),
});

const sceneMediaConfigSchema = z.object({
  fit: z.enum(["cover", "contain"]).optional(),
  transitionMs: z.number().nonnegative().optional(),
});

const renderConfigSchema = z.object({
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  fps: z.number().int().positive(),
  format: z.enum(["mp4", "webm"]).optional(),
  musicVolume: z.number().min(0).max(1).optional(),
});

const graphNodeSchema = z.discriminatedUnion("type", [
  z.object({ id: z.string(), type: z.literal("MediaPool"), config: mediaPoolConfigSchema }),
  z.object({ id: z.string(), type: z.literal("SceneSlot"), config: sceneSlotConfigSchema }),
  z.object({ id: z.string(), type: z.literal("VideoFit"), config: videoFitConfigSchema }),
  z.object({ id: z.string(), type: z.literal("TTS"), config: ttsConfigSchema }),
  z.object({ id: z.string(), type: z.literal("Subtitle"), config: subtitleConfigSchema }),
  z.object({ id: z.string(), type: z.literal("Layer"), config: layerConfigSchema }),
  z.object({ id: z.string(), type: z.literal("Render"), config: renderConfigSchema }),
  z.object({ id: z.string(), type: z.literal("Overlay"), config: overlayConfigSchema }),
  z.object({ id: z.string(), type: z.literal("Transition"), config: transitionConfigSchema }),
  z.object({ id: z.string(), type: z.literal("Zoom"), config: zoomConfigSchema }),
  z.object({ id: z.string(), type: z.literal("Shake"), config: shakeConfigSchema }),
  z.object({ id: z.string(), type: z.literal("SceneMedia"), config: sceneMediaConfigSchema }),
]);

const graphEdgeSchema = z.object({
  id: z.string(),
  from: z.string(),
  fromHandle: z.string(),
  to: z.string(),
  toHandle: z.string(),
  order: z.number().int().nonnegative().optional(),
});

// Strict schema used by the renderer / job creation (requires at least 1 node)
export const graphSchema = z.object({
  version: z.literal(1),
  nodes: z.array(graphNodeSchema).min(1),
  edges: z.array(graphEdgeSchema),
});

// Permissive schema used when saving a template (canvas can be empty)
export const graphDraftSchema = z.object({
  version: z.literal(1),
  nodes: z.array(graphNodeSchema),
  edges: z.array(graphEdgeSchema),
});

export type GraphInput = z.infer<typeof graphSchema>;

// ── Graph structural validation ──

const VALID_OUTPUTS: Record<string, string[]> = {
  MediaPool: ["items"],
  SceneSlot: ["items"],
  VideoFit: ["video", "audio"],
  TTS: ["audio", "timestamps"],
  Subtitle: ["filter"],
  Layer: ["video"],
  Render: ["file"],
  Overlay: ["overlay", "sfx"],
  Transition: ["effect"],
  Zoom: ["effect"],
  Shake: ["effect"],
  SceneMedia: ["video"],
};

const VALID_INPUTS: Record<string, string[]> = {
  MediaPool: [],
  SceneSlot: [],
  VideoFit: ["intro", "items", "audio", "effects"],
  TTS: [],
  Subtitle: ["timestamps"],
  Layer: ["base", "overlay"],
  Render: ["video", "audio", "music", "sfx"],
  Overlay: [],
  Transition: [],
  Zoom: [],
  Shake: [],
  SceneMedia: [],
};

export function validateGraphStructure(graph: GraphInput): string[] {
  const errors: string[] = [];
  const nodeMap = new Map(graph.nodes.map((n) => [n.id, n]));

  // Exactly 1 Render node
  const renderNodes = graph.nodes.filter((n) => n.type === "Render");
  if (renderNodes.length !== 1) {
    errors.push(`graph must have exactly 1 Render node, found ${renderNodes.length}`);
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

    const validOutputs = VALID_OUTPUTS[fromNode.type] ?? [];
    if (!validOutputs.includes(edge.fromHandle)) {
      errors.push(`edge "${edge.id}": invalid output handle "${edge.fromHandle}" for ${fromNode.type}`);
    }

    const validInputs = VALID_INPUTS[toNode.type] ?? [];
    if (!validInputs.includes(edge.toHandle)) {
      errors.push(`edge "${edge.id}": invalid input handle "${edge.toHandle}" for ${toNode.type}`);
    }
  }

  return errors;
}

// ── Template schemas ──

export const createTemplateSchema = z.object({
  name: z.string().min(1),
  graph: graphDraftSchema,
});

export const updateTemplateSchema = z.object({
  name: z.string().min(1).optional(),
  graph: graphDraftSchema.optional(),
});

// ── SceneSlot ──

export const sceneSlotSchema = z.object({
  index: z.number().int().nonnegative(),
  startMs: z.number().nonnegative(),
  endMs: z.number().positive(),
  assetId: z.string().uuid().nullable(),
});

export type SceneSlot = z.infer<typeof sceneSlotSchema>;

// ── Job schemas ──

export const narrationSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("tts"), text: z.string().min(1) }),
  z.object({ type: z.literal("audio"), assetId: z.string().uuid() }),
]);

/** Cria job em draft (fluxo staged) */
export const createDraftJobSchema = z.object({
  templateId: z.string().uuid(),
});

/** Enfileira áudio (etapa 2 do fluxo staged) */
export const startAudioSchema = z.object({
  narration: z.discriminatedUnion("type", [
    z.object({
      type: z.literal("tts"),
      text: z.string().min(1),
      provider: z.enum(["talkify"]),
      voice: z.string().optional(),
      speed: z.number().positive().optional(),
    }),
    z.object({ type: z.literal("audio"), assetId: z.string().uuid() }),
  ]),
});

/** Atualiza slots de mídia (etapa 3 do fluxo staged) */
export const updateSlotsSchema = z.object({
  slots: z.array(z.object({
    index: z.number().int().nonnegative(),
    assetId: z.string().uuid().nullable(),
    startMs: z.number().nonnegative().optional(),
    endMs: z.number().positive().optional(),
  })).min(1),
});

/** Cria job diretamente (fluxo legado / quick render) */
export const createJobSchema = z.object({
  templateId: z.string().uuid(),
  narration: narrationSchema,
  sceneOverrides: z.array(z.object({
    nodeId: z.string(),
    assetId: z.string().uuid(),
  })).optional(),
  mediaPoolOverrides: z.array(z.object({
    nodeId: z.string(),
    assetIds: z.array(z.string().uuid()),
  })).optional(),
});

// ── Pagination schemas ──

export const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  type: z.enum(["video", "audio", "text"]).optional(),
  search: z.string().optional(),
});

// ── Credit filter schemas ──

export const creditFilterSchema = z.object({
  reason: z.enum(["render", "tts", "purchase"]).optional(),
  from: z.string().date().optional(),
  to: z.string().date().optional(),
});
