import { describe, it, expect, beforeEach, mock } from "bun:test";
import { Elysia } from "elysia";
import { mockDatabase, mockRenderQueue, mockMinio } from "./helpers/setup";
import { chainResult } from "./helpers/mock-db";
import { mockGetSession, authedRequest, TEST_SESSION } from "./helpers/mock-session";
import { TEMPLATE_ROW, JOB_ROW, DONE_JOB_ROW, VALID_GRAPH } from "./helpers/fixtures";

import { jobRoutes } from "../routes/jobs";

const app = new Elysia().use(jobRoutes);

beforeEach(() => {
  ((mockDatabase.select as any) as any).mockReset().mockReturnValue(chainResult([]));
  (mockDatabase.insert as any).mockReset().mockReturnValue(chainResult([]));
  (mockDatabase.delete as any).mockReset().mockReturnValue(chainResult(undefined));
  ((mockDatabase.transaction as any) as any).mockReset().mockImplementation(async (fn: Function) => fn(mockDatabase));
  mockRenderQueue.add.mockReset().mockResolvedValue({ id: "bull-1" });
  mockMinio.presignedGetObject.mockReset().mockResolvedValue("https://minio.test/presigned-url");
  mockGetSession.mockReset().mockResolvedValue(TEST_SESSION);
});

describe("POST /api/jobs", () => {
  it("returns 201, debits credits, and enqueues job", async () => {
    // First select: find template
    (mockDatabase.select as any).mockReturnValueOnce(chainResult([TEMPLATE_ROW]));

    // Transaction: balance check + job insert + credit insert
    const txMock = {
      select: mock(() => chainResult([{ total: "100" }])),
      insert: mock()
        .mockReturnValueOnce(chainResult([JOB_ROW]))
        .mockReturnValueOnce(chainResult([])),
    };
    (mockDatabase.transaction as any).mockImplementation(async (fn: Function) => fn(txMock));

    const res = await app.handle(authedRequest("/api/jobs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ templateId: TEMPLATE_ROW.id, narration: { type: "tts", text: "Hello world" } }),
    }));

    expect(res.ok).toBe(true);
    const body = await res.json();
    expect(body.id).toBe(JOB_ROW.id);
    expect(mockRenderQueue.add).toHaveBeenCalled();
  });

  it("returns 400 for invalid body", async () => {
    const res = await app.handle(authedRequest("/api/jobs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ templateId: "not-a-uuid", narration: { type: "tts", text: "Hello world" } }),
    }));

    expect(res.status).toBe(400);
  });

  it("returns 404 when template not found", async () => {
    (mockDatabase.select as any).mockReturnValue(chainResult([]));

    const res = await app.handle(authedRequest("/api/jobs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ templateId: TEMPLATE_ROW.id, narration: { type: "tts", text: "Hello world" } }),
    }));

    expect(res.status).toBe(404);
  });

  it("returns 400 when template graph is invalid", async () => {
    const badTemplate = { ...TEMPLATE_ROW, graph: { version: 1, nodes: [], edges: [] } };
    (mockDatabase.select as any).mockReturnValueOnce(chainResult([badTemplate]));

    const res = await app.handle(authedRequest("/api/jobs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ templateId: TEMPLATE_ROW.id, narration: { type: "tts", text: "Hello world" } }),
    }));

    expect(res.status).toBe(400);
  });

  it("returns 402 when insufficient credits", async () => {
    (mockDatabase.select as any).mockReturnValueOnce(chainResult([TEMPLATE_ROW]));

    const txMock = {
      select: mock(() => chainResult([{ total: "1" }])),
      insert: mock(() => chainResult([])),
    };
    (mockDatabase.transaction as any).mockImplementation(async (fn: Function) => fn(txMock));

    const res = await app.handle(authedRequest("/api/jobs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ templateId: TEMPLATE_ROW.id, narration: { type: "tts", text: "Hello world" } }),
    }));

    expect(res.status).toBe(402);
    const body = await res.json();
    expect(body.error).toBe("insufficient credits");
  });

  it("returns 401 when unauthenticated", async () => {
    mockGetSession.mockResolvedValueOnce(null);

    const res = await app.handle(authedRequest("/api/jobs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ templateId: TEMPLATE_ROW.id, narration: { type: "tts", text: "Hello world" } }),
    }));

    expect(res.status).toBe(401);
  });
});

describe("GET /api/jobs", () => {
  it("returns paginated list", async () => {
    (mockDatabase.select as any)
      .mockReturnValueOnce(chainResult([{
        id: JOB_ROW.id,
        status: JOB_ROW.status,
        videoKey: null,
        durationSeconds: null,
        creditsCharged: 15,
        error: null,
        createdAt: JOB_ROW.createdAt,
        completedAt: null,
      }]))
      .mockReturnValueOnce(chainResult([{ count: 1 }]));

    const res = await app.handle(authedRequest("/api/jobs"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(1);
    expect(body.total).toBe(1);
  });
});

describe("GET /api/jobs/:id", () => {
  it("returns job", async () => {
    (mockDatabase.select as any).mockReturnValue(chainResult([JOB_ROW]));

    const res = await app.handle(authedRequest(`/api/jobs/${JOB_ROW.id}`));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe(JOB_ROW.id);
  });

  it("returns 404 when not found", async () => {
    (mockDatabase.select as any).mockReturnValue(chainResult([]));

    const res = await app.handle(authedRequest("/api/jobs/nonexistent"));
    expect(res.status).toBe(404);
  });
});

describe("GET /api/jobs/:id/download", () => {
  it("returns presigned URL for done job", async () => {
    (mockDatabase.select as any).mockReturnValue(
      chainResult([{ status: "done", videoKey: "path/output.mp4" }]),
    );

    const res = await app.handle(authedRequest(`/api/jobs/${DONE_JOB_ROW.id}/download`));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.url).toBe("https://minio.test/presigned-url");
  });

  it("returns 400 when video not ready", async () => {
    (mockDatabase.select as any).mockReturnValue(
      chainResult([{ status: "processing", videoKey: null }]),
    );

    const res = await app.handle(authedRequest(`/api/jobs/${JOB_ROW.id}/download`));
    expect(res.status).toBe(400);
  });

  it("returns 404 when not found", async () => {
    (mockDatabase.select as any).mockReturnValue(chainResult([]));

    const res = await app.handle(authedRequest(`/api/jobs/${JOB_ROW.id}/download`));
    expect(res.status).toBe(404);
  });
});
