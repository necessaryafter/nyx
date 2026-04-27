import type { GraphInput } from "../../lib/schemas";

// Valid v4 UUIDs for fixtures
const UUID_ASSET = "a0000000-0000-4000-8000-000000000001";
const UUID_TEMPLATE = "b0000000-0000-4000-8000-000000000099";
const UUID_JOB = "c0000000-0000-4000-8000-000000000088";
const UUID_JOB_DONE = "c0000000-0000-4000-8000-000000000087";
const UUID_CREDIT_TX = "d0000000-0000-4000-8000-000000000066";

export const VALID_GRAPH: GraphInput = {
  version: 1,
  nodes: [
    { id: "vp1", type: "MediaPool", config: { assetIds: [UUID_ASSET], assetType: "video" } },
    { id: "tts1", type: "TTS", config: { text: "Hello world", provider: "talkify" } },
    { id: "vfit1", type: "VideoFit", config: { mode: "random-loop" } },
    { id: "sub1", type: "Subtitle", config: { wordsPerGroup: 3 } },
    { id: "layer1", type: "Layer", config: {} },
    { id: "render1", type: "Render", config: { width: 1080, height: 1920, fps: 30 } },
  ],
  edges: [
    { id: "e1", from: "vp1", fromHandle: "items", to: "vfit1", toHandle: "items" },
    { id: "e2", from: "tts1", fromHandle: "audio", to: "vfit1", toHandle: "audio" },
    { id: "e3", from: "tts1", fromHandle: "timestamps", to: "sub1", toHandle: "timestamps" },
    { id: "e4", from: "vfit1", fromHandle: "video", to: "layer1", toHandle: "base" },
    { id: "e5", from: "sub1", fromHandle: "filter", to: "layer1", toHandle: "overlay" },
    { id: "e6", from: "layer1", fromHandle: "video", to: "render1", toHandle: "video" },
    { id: "e7", from: "tts1", fromHandle: "audio", to: "render1", toHandle: "audio" },
  ],
};

export const TEMPLATE_ROW = {
  id: UUID_TEMPLATE,
  userId: "user-test-123",
  name: "Test Template",
  graph: VALID_GRAPH,
  isPublic: false,
  createdAt: new Date("2025-01-01"),
  updatedAt: new Date("2025-01-01"),
};

export const JOB_ROW = {
  id: UUID_JOB,
  userId: "user-test-123",
  templateId: UUID_TEMPLATE,
  status: "pending" as const,
  graph: VALID_GRAPH,
  videoKey: null,
  durationSeconds: null,
  creditsCharged: 15,
  error: null,
  createdAt: new Date("2025-01-01"),
  updatedAt: new Date("2025-01-01"),
  completedAt: null,
};

export const DONE_JOB_ROW = {
  ...JOB_ROW,
  id: UUID_JOB_DONE,
  status: "done" as const,
  videoKey: `user-test-123/${UUID_JOB_DONE}/output.mp4`,
  durationSeconds: 60,
  completedAt: new Date("2025-01-02"),
};

export const ASSET_ROW = {
  id: "e0000000-0000-4000-8000-000000000077",
  userId: "user-test-123",
  name: "bg-video.mp4",
  type: "video" as const,
  storageKey: "user-test-123/e0000000-0000-4000-8000-000000000077/bg-video.mp4",
  sizeBytes: 1024000,
  createdAt: new Date("2025-01-01"),
};

export const CREDIT_TX_ROW = {
  id: UUID_CREDIT_TX,
  userId: "user-test-123",
  amount: -15,
  reason: "render" as const,
  jobId: UUID_JOB,
  createdAt: new Date("2025-01-15"),
};
