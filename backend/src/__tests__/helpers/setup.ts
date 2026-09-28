import { mock } from "bun:test";
import { Elysia } from "elysia";
import { createMockDatabase } from "./mock-db";
import { mockAuth } from "./mock-session";

export const mockDatabase = createMockDatabase();

export const mockMinio = {
  putObject: mock(() => Promise.resolve()),
  removeObject: mock(() => Promise.resolve()),
  presignedGetObject: mock(() => Promise.resolve("https://minio.test/presigned-url")),
};

export const mockRenderQueue = {
  add: mock(() => Promise.resolve({ id: "bull-job-1" })),
  getJob: mock(() => Promise.resolve(null)),
};

export const mockAudioQueue = {
  add: mock(() => Promise.resolve({ id: "bull-audio-job-1" })),
  getJob: mock(() => Promise.resolve(null)),
};

export const mockSchedulerQueue = {
  add: mock(() => Promise.resolve({ id: "bull-scheduler-job-1" })),
  upsertJobScheduler: mock(() => Promise.resolve()),
  removeJobScheduler: mock(() => Promise.resolve(true)),
  getJobScheduler: mock(() => Promise.resolve(null)),
  getJobSchedulers: mock(() => Promise.resolve([])),
};

export const mockAssetImportQueue = {
  add: mock(() => Promise.resolve({ id: "bull-asset-import-job-1" })),
  getJob: mock(() => Promise.resolve(null)),
};

const mockQueueEvents = {
  on: mock(() => {}),
};

export const mockLogger = {
  info: mock(() => {}),
  error: mock(() => {}),
  warn: mock(() => {}),
  debug: mock(() => {}),
};

// Mock all external modules
mock.module("../../database/index", () => ({ database: mockDatabase }));
mock.module("../../database", () => ({ database: mockDatabase }));
mock.module("../../auth/auth", () => ({ auth: mockAuth }));
mock.module("../../lib/minio", () => ({
  minio: mockMinio,
  BUCKET_ASSETS: "test-assets",
  BUCKET_VIDEOS: "test-videos",
}));
mock.module("../../lib/queue", () => ({
  renderQueue: mockRenderQueue,
  audioQueue: mockAudioQueue,
  schedulerQueue: mockSchedulerQueue,
  assetImportQueue: mockAssetImportQueue,
  renderQueueEvents: mockQueueEvents,
  audioQueueEvents: mockQueueEvents,
  assetImportQueueEvents: mockQueueEvents,
}));
mock.module("../../lib/logger", () => ({ logger: mockLogger }));

// Mock rate-limit as no-op to prevent flaky tests
mock.module("elysia-rate-limit", () => ({
  rateLimit: () => new Elysia(),
}));
