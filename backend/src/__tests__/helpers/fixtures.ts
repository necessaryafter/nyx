import type { GraphInput } from "../../lib/schemas";

// Valid v4 UUIDs for fixtures
const UUID_ASSET = "a0000000-0000-4000-8000-000000000001";
const UUID_TEMPLATE = "b0000000-0000-4000-8000-000000000099";
const UUID_JOB = "c0000000-0000-4000-8000-000000000088";
const UUID_JOB_DONE = "c0000000-0000-4000-8000-000000000087";
const UUID_CREDIT_TX = "d0000000-0000-4000-8000-000000000066";

export const VALID_GRAPH: GraphInput = {
  version: 2,
  settings: { width: 1080, height: 1920, fps: 30, format: "mp4", musicVolume: 0.15 },
  nodes: [
    { id: "narration", kind: "source", type: "NarrationSource", config: { mode: "tts", text: "Hello world", provider: "talkify" } },
    { id: "assets", kind: "source", type: "AssetSource", config: { assetIds: [UUID_ASSET], assetType: "video", mode: "random-loop" } },
    { id: "on-sentence", kind: "event", type: "OnSentence", config: {} },
    { id: "subtitle", kind: "action", type: "SetSubtitleStyle", config: { wordsPerGroup: 3 } },
    { id: "media", kind: "action", type: "SetMedia", config: { target: "main" } },
    { id: "render1", kind: "output", type: "Render", config: {} },
  ],
  edges: [
    { id: "e1", from: "narration", to: "on-sentence", role: "narration" },
    { id: "e2", from: "on-sentence", to: "subtitle", role: "trigger" },
    { id: "e3", from: "assets", to: "media", role: "media" },
    { id: "e4", from: "media", to: "render1" },
    { id: "e5", from: "subtitle", to: "render1" },
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
