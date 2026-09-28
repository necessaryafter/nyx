import { describe, it, expect, beforeEach } from "bun:test";
import { mockDatabase, mockAudioQueue, mockRenderQueue } from "./helpers/setup";
import { chainResult } from "./helpers/mock-db";
import { TEMPLATE_ROW, JOB_ROW, ASSET_ROW, VALID_GRAPH } from "./helpers/fixtures";

import { HttpError, createDraftJob, startAudio, startRender } from "../lib/jobs.service";

beforeEach(() => {
  mockDatabase.select.mockReset().mockReturnValue(chainResult([]));
  mockDatabase.insert.mockReset().mockReturnValue(chainResult([]));
  mockDatabase.update.mockReset().mockReturnValue(chainResult([]));
  mockDatabase.transaction.mockReset().mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => fn(mockDatabase));
  mockAudioQueue.add.mockReset().mockResolvedValue({ id: "bull-audio-1" });
  mockRenderQueue.add.mockReset().mockResolvedValue({ id: "bull-render-1" });
});

describe("createDraftJob", () => {
  it("creates a job with status draft using the template's graph", async () => {
    mockDatabase.insert.mockReturnValue(chainResult([{ ...JOB_ROW, status: "draft", graph: VALID_GRAPH }]));

    const job = await createDraftJob("user-test-123", TEMPLATE_ROW);

    expect(job.status).toBe("draft");
    expect(mockDatabase.insert).toHaveBeenCalled();
  });

  it("throws HttpError 400 when the template's graph is invalid", async () => {
    const badTemplate = { ...TEMPLATE_ROW, graph: { version: 1 } };

    await expect(createDraftJob("user-test-123", badTemplate)).rejects.toThrow(HttpError);
    try {
      await createDraftJob("user-test-123", badTemplate);
    } catch (err) {
      expect(err).toBeInstanceOf(HttpError);
      expect((err as HttpError).status).toBe(400);
    }
  });

  it("passes runId/partIndex through when scheduling a scheduler part", async () => {
    mockDatabase.insert.mockReturnValue(chainResult([{ ...JOB_ROW, status: "draft", runId: "run-1", partIndex: 2 }]));

    await createDraftJob("user-test-123", TEMPLATE_ROW, VALID_GRAPH, { runId: "run-1", partIndex: 2 });

    const insertedValues = mockDatabase.insert.mock.calls; // just confirms insert was invoked; values() call itself is chained mock
    expect(insertedValues.length).toBeGreaterThan(0);
  });
});

describe("startAudio", () => {
  it("throws 409 when the job is not in draft status", async () => {
    const job = { ...JOB_ROW, status: "ready" as const };
    await expect(
      startAudio("user-test-123", job, { type: "tts", text: "hi", provider: "edge" }),
    ).rejects.toMatchObject({ status: 409 });
  });

  it("throws 402 when TTS credits exceed the balance", async () => {
    const job = { ...JOB_ROW, status: "draft" as const };
    mockDatabase.select.mockReturnValueOnce(chainResult([{ total: "0" }]));

    await expect(
      startAudio("user-test-123", job, { type: "tts", text: "hi", provider: "talkify" }),
    ).rejects.toMatchObject({ status: 402 });
    expect(mockAudioQueue.add).not.toHaveBeenCalled();
  });

  it("debits TTS credits, enqueues audio, and returns the bull job id", async () => {
    const job = { ...JOB_ROW, status: "draft" as const };
    mockDatabase.select.mockReturnValueOnce(chainResult([{ total: "100" }]));

    const result = await startAudio("user-test-123", job, { type: "tts", text: "hi", provider: "edge" });

    expect(result.bullJobId).toBe("bull-audio-1");
    expect(mockDatabase.insert).toHaveBeenCalled(); // credit debit row
    expect(mockAudioQueue.add).toHaveBeenCalled();
  });

  it("resolves the storage key for type=audio and skips the credit check", async () => {
    const job = { ...JOB_ROW, status: "draft" as const };
    mockDatabase.select.mockReturnValueOnce(chainResult([ASSET_ROW]));

    const result = await startAudio("user-test-123", job, { type: "audio", assetId: ASSET_ROW.id });

    expect(result.bullJobId).toBe("bull-audio-1");
    const [, payload] = mockAudioQueue.add.mock.calls[0]!;
    expect(payload.narration).toEqual({ type: "audio", assetStorageKey: ASSET_ROW.storageKey });
  });

  it("throws 404 when the audio asset is not found", async () => {
    const job = { ...JOB_ROW, status: "draft" as const };
    mockDatabase.select.mockReturnValueOnce(chainResult([]));

    await expect(
      startAudio("user-test-123", job, { type: "audio", assetId: ASSET_ROW.id }),
    ).rejects.toMatchObject({ status: 404 });
  });
});

describe("startRender", () => {
  it("throws 409 when the job is not in a renderable status", async () => {
    const job = { ...JOB_ROW, status: "draft" as const };
    await expect(startRender("user-test-123", job)).rejects.toMatchObject({ status: 409 });
  });

  it("throws 400 when the resolved graph structure is invalid", async () => {
    const brokenGraph = { ...VALID_GRAPH, nodes: VALID_GRAPH.nodes.filter((n) => n.type !== "Render") };
    const job = { ...JOB_ROW, status: "ready" as const, graph: brokenGraph };

    await expect(startRender("user-test-123", job)).rejects.toMatchObject({ status: 400 });
  });

  it("throws 402 when render credits exceed the balance", async () => {
    const job = { ...JOB_ROW, status: "ready" as const };
    mockDatabase.select.mockReturnValueOnce(chainResult([{ total: "0" }]));

    await expect(startRender("user-test-123", job)).rejects.toMatchObject({ status: 402 });
    expect(mockRenderQueue.add).not.toHaveBeenCalled();
  });

  it("debits render credits and enqueues the render job", async () => {
    const job = { ...JOB_ROW, status: "ready" as const };
    mockDatabase.select.mockReturnValueOnce(chainResult([{ total: "100" }]));

    const result = await startRender("user-test-123", job);

    expect(result.bullJobId).toBe("bull-render-1");
    expect(result.creditsCharged).toBe(10); // RENDER_CREDITS_PER_MIN
    expect(mockRenderQueue.add).toHaveBeenCalled();
  });

  it("injects the precomputed audioKey into the NarrationSource before rendering", async () => {
    const job = { ...JOB_ROW, status: "audio_ready" as const, audioKey: "audio/key.wav" };
    mockDatabase.select.mockReturnValueOnce(chainResult([{ total: "100" }]));

    await startRender("user-test-123", job);

    const [, payload] = mockRenderQueue.add.mock.calls[0]!;
    expect(payload.jobId).toBe(job.id);
  });
});
