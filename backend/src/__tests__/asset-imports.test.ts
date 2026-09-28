import { describe, it, expect, beforeEach } from "bun:test";
import { Elysia } from "elysia";
import { mockDatabase, mockAssetImportQueue } from "./helpers/setup";
import { chainResult } from "./helpers/mock-db";
import { mockGetSession, authedRequest, TEST_SESSION } from "./helpers/mock-session";

import { assetImportRoutes } from "../routes/assetImports";

const app = new Elysia().use(assetImportRoutes);

const BATCH_ID = "e0000000-0000-4000-8000-000000000001";

const BATCH_ROW = {
  id: BATCH_ID,
  userId: TEST_SESSION.user.id,
  sourceName: "compilation.mp4",
  sourceStorageKey: `${TEST_SESSION.user.id}/imports/${BATCH_ID}/source-compilation.mp4`,
  sourceDurationMs: 60_000,
  status: "awaiting_review" as const,
  segments: [
    { index: 1, startMs: 0, endMs: 20_000, clipStorageKey: "k1", thumbnailKey: "t1", selected: true },
    { index: 2, startMs: 20_000, endMs: 40_000, clipStorageKey: "k2", thumbnailKey: "t2", selected: true },
    { index: 3, startMs: 40_000, endMs: 60_000, clipStorageKey: "k3", thumbnailKey: "t3", selected: true },
  ],
  error: null,
  createdAt: new Date("2025-01-01"),
  updatedAt: new Date("2025-01-01"),
  completedAt: null,
};

function jsonRequest(path: string, method: string, body?: unknown) {
  return authedRequest(path, {
    method,
    headers: { "content-type": "application/json" },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

beforeEach(() => {
  mockDatabase.select.mockReset().mockReturnValue(chainResult([]));
  mockDatabase.insert.mockReset().mockReturnValue(chainResult([]));
  mockDatabase.update.mockReset().mockReturnValue(chainResult([]));
  mockDatabase.delete.mockReset().mockReturnValue(chainResult(undefined));
  mockGetSession.mockReset().mockResolvedValue(TEST_SESSION);
  mockAssetImportQueue.add.mockReset().mockResolvedValue({ id: "bull-asset-import-job-1" });
});

describe("POST /api/asset-imports/upload/start", () => {
  it("returns 400 for invalid fields", async () => {
    const res = await app.handle(jsonRequest("/api/asset-imports/upload/start", "POST", { name: "" }));
    expect(res.status).toBe(400);
  });

  it("returns a batchId", async () => {
    const res = await app.handle(jsonRequest("/api/asset-imports/upload/start", "POST", { name: "compilation.mp4" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(typeof body.batchId).toBe("string");
  });
});

describe("PUT /api/asset-imports/upload/:batchId/chunk", () => {
  it("returns 404 when the upload was never started", async () => {
    const res = await app.handle(
      authedRequest("/api/asset-imports/upload/nonexistent/chunk?index=0", {
        method: "PUT",
        headers: { "content-type": "application/octet-stream" },
        body: new Uint8Array([1, 2, 3]),
      }),
    );
    expect(res.status).toBe(404);
  });

  it("returns 400 for an invalid chunk index", async () => {
    const res = await app.handle(
      authedRequest("/api/asset-imports/upload/some-id/chunk?index=-1", {
        method: "PUT",
        body: new Uint8Array([1]),
      }),
    );
    expect(res.status).toBe(400);
  });
});

describe("POST /api/asset-imports/upload/:batchId/complete", () => {
  it("returns 400 for invalid fields", async () => {
    const res = await app.handle(jsonRequest("/api/asset-imports/upload/some-id/complete", "POST", {}));
    expect(res.status).toBe(400);
  });
});

describe("GET /api/asset-imports", () => {
  it("lists in-progress batches for the user", async () => {
    mockDatabase.select.mockReturnValueOnce(chainResult([BATCH_ROW]));
    const res = await app.handle(authedRequest("/api/asset-imports"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(1);
  });
});

describe("GET /api/asset-imports/:id", () => {
  it("returns 404 when not found", async () => {
    mockDatabase.select.mockReturnValueOnce(chainResult([]));
    const res = await app.handle(authedRequest(`/api/asset-imports/${BATCH_ID}`));
    expect(res.status).toBe(404);
  });

  it("returns the batch with a thumbnail URL per segment", async () => {
    mockDatabase.select.mockReturnValueOnce(chainResult([BATCH_ROW]));
    const res = await app.handle(authedRequest(`/api/asset-imports/${BATCH_ID}`));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.segments).toHaveLength(3);
    expect(typeof body.segments[0].thumbnailUrl).toBe("string");
  });
});

describe("POST /api/asset-imports/:id/fallback", () => {
  it("returns 404 when not found", async () => {
    mockDatabase.select.mockReturnValueOnce(chainResult([]));
    const res = await app.handle(jsonRequest(`/api/asset-imports/${BATCH_ID}/fallback`, "POST", { mode: "single" }));
    expect(res.status).toBe(404);
  });

  it("returns 409 when the batch isn't awaiting a fallback choice", async () => {
    mockDatabase.select.mockReturnValueOnce(chainResult([BATCH_ROW])); // status = awaiting_review
    const res = await app.handle(jsonRequest(`/api/asset-imports/${BATCH_ID}/fallback`, "POST", { mode: "single" }));
    expect(res.status).toBe(409);
  });

  it("re-enqueues the job with the chosen mode", async () => {
    mockDatabase.select.mockReturnValueOnce(chainResult([{ ...BATCH_ROW, status: "awaiting_fallback_choice" }]));
    const res = await app.handle(jsonRequest(`/api/asset-imports/${BATCH_ID}/fallback`, "POST", { mode: "fixed" }));
    expect(res.status).toBe(200);
    expect(mockAssetImportQueue.add).toHaveBeenCalledWith("detect", { batchId: BATCH_ID, fallbackMode: "fixed" });
  });

  it("returns 400 for an invalid mode", async () => {
    const res = await app.handle(jsonRequest(`/api/asset-imports/${BATCH_ID}/fallback`, "POST", { mode: "bogus" }));
    expect(res.status).toBe(400);
  });
});

describe("POST /api/asset-imports/:id/confirm", () => {
  it("returns 404 when not found", async () => {
    mockDatabase.select.mockReturnValueOnce(chainResult([]));
    const res = await app.handle(jsonRequest(`/api/asset-imports/${BATCH_ID}/confirm`, "POST", { selectedIndexes: [1] }));
    expect(res.status).toBe(404);
  });

  it("returns 409 when the batch is already done", async () => {
    mockDatabase.select.mockReturnValueOnce(chainResult([{ ...BATCH_ROW, status: "done" }]));
    const res = await app.handle(jsonRequest(`/api/asset-imports/${BATCH_ID}/confirm`, "POST", { selectedIndexes: [1] }));
    expect(res.status).toBe(409);
  });

  it("confirms a subset while still detecting, without closing the batch", async () => {
    mockDatabase.select.mockReturnValueOnce(chainResult([{ ...BATCH_ROW, status: "detecting" }]));
    const insertBuilder = chainResult([]);
    mockDatabase.insert.mockReturnValue(insertBuilder);

    const res = await app.handle(jsonRequest(`/api/asset-imports/${BATCH_ID}/confirm`, "POST", { selectedIndexes: [1] }));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("detecting"); // lote continua aberto pro resto dos cortes
    expect(body.imported).toBe(1);
    expect(mockDatabase.update).toHaveBeenCalled(); // splice atômico dos confirmados, sem apagar do MinIO
  });

  it("confirms leftover segments from a failed batch (recovery)", async () => {
    mockDatabase.select.mockReturnValueOnce(chainResult([{ ...BATCH_ROW, status: "failed" }]));
    mockDatabase.insert.mockReturnValue(chainResult([]));

    const res = await app.handle(jsonRequest(`/api/asset-imports/${BATCH_ID}/confirm`, "POST", { selectedIndexes: [1, 2, 3] }));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("done");
    expect(body.imported).toBe(3);
  });

  it("returns 400 for an index that doesn't exist in the batch", async () => {
    mockDatabase.select.mockReturnValueOnce(chainResult([BATCH_ROW]));
    const res = await app.handle(jsonRequest(`/api/asset-imports/${BATCH_ID}/confirm`, "POST", { selectedIndexes: [99] }));
    expect(res.status).toBe(400);
  });

  it("materializes only the selected segments as assets and marks the batch done", async () => {
    mockDatabase.select.mockReturnValueOnce(chainResult([BATCH_ROW]));
    const insertBuilder = chainResult([]);
    mockDatabase.insert.mockReturnValue(insertBuilder);

    const res = await app.handle(jsonRequest(`/api/asset-imports/${BATCH_ID}/confirm`, "POST", { selectedIndexes: [1, 3] }));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.imported).toBe(2);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mock builder typed loosely on purpose
    const insertedRows = (insertBuilder.values as any).mock.calls[0][0] as Array<{ importBatchId: string }>;
    expect(insertedRows).toHaveLength(2);
    expect(insertedRows.every((r) => r.importBatchId === BATCH_ID)).toBe(true);
    expect(mockDatabase.update).toHaveBeenCalled();
  });
});

describe("DELETE /api/asset-imports/:id/segments/:index", () => {
  it("returns 404 when the batch doesn't exist", async () => {
    mockDatabase.select.mockReturnValueOnce(chainResult([]));
    const res = await app.handle(authedRequest(`/api/asset-imports/${BATCH_ID}/segments/1`, { method: "DELETE" }));
    expect(res.status).toBe(404);
  });

  it("returns 404 when the index doesn't exist in the batch", async () => {
    mockDatabase.select.mockReturnValueOnce(chainResult([BATCH_ROW]));
    const res = await app.handle(authedRequest(`/api/asset-imports/${BATCH_ID}/segments/99`, { method: "DELETE" }));
    expect(res.status).toBe(404);
  });

  it("returns 409 when the batch is already done", async () => {
    mockDatabase.select.mockReturnValueOnce(chainResult([{ ...BATCH_ROW, status: "done" }]));
    const res = await app.handle(authedRequest(`/api/asset-imports/${BATCH_ID}/segments/1`, { method: "DELETE" }));
    expect(res.status).toBe(409);
  });

  it("removes a single segment while the batch keeps processing", async () => {
    mockDatabase.select.mockReturnValueOnce(chainResult([{ ...BATCH_ROW, status: "detecting" }]));
    const res = await app.handle(authedRequest(`/api/asset-imports/${BATCH_ID}/segments/2`, { method: "DELETE" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.deleted).toBe(true);
    expect(mockDatabase.update).toHaveBeenCalled();
  });
});

describe("DELETE /api/asset-imports/:id", () => {
  it("returns 404 when not found", async () => {
    mockDatabase.select.mockReturnValueOnce(chainResult([]));
    const res = await app.handle(authedRequest(`/api/asset-imports/${BATCH_ID}`, { method: "DELETE" }));
    expect(res.status).toBe(404);
  });

  it("returns 409 when the batch is already done", async () => {
    mockDatabase.select.mockReturnValueOnce(chainResult([{ ...BATCH_ROW, status: "done" }]));
    const res = await app.handle(authedRequest(`/api/asset-imports/${BATCH_ID}`, { method: "DELETE" }));
    expect(res.status).toBe(409);
  });

  it("discards the batch", async () => {
    mockDatabase.select.mockReturnValueOnce(chainResult([BATCH_ROW]));
    const res = await app.handle(authedRequest(`/api/asset-imports/${BATCH_ID}`, { method: "DELETE" }));
    expect(res.status).toBe(200);
    expect(mockDatabase.delete).toHaveBeenCalled();
  });
});

describe("auth", () => {
  it("returns 401 when unauthenticated", async () => {
    mockGetSession.mockResolvedValueOnce(null);
    const res = await app.handle(authedRequest("/api/asset-imports"));
    expect(res.status).toBe(401);
  });
});
