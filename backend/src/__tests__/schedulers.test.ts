import { describe, it, expect, beforeEach } from "bun:test";
import { Elysia } from "elysia";
import { mockDatabase, mockSchedulerQueue } from "./helpers/setup";
import { chainResult } from "./helpers/mock-db";
import { mockGetSession, authedRequest, TEST_SESSION } from "./helpers/mock-session";
import { TEMPLATE_ROW } from "./helpers/fixtures";

import { schedulerRoutes } from "../routes/schedulers";

const app = new Elysia().use(schedulerRoutes);

const SCHEDULER_ROW = {
  id: "f0000000-0000-4000-8000-000000000001",
  userId: TEST_SESSION.user.id,
  name: "Historias de trabalho",
  templateId: TEMPLATE_ROW.id,
  theme: "historias de gente que se ferrou no emprego, em primeira pessoa",
  assetIds: [] as string[],
  musicAssetIds: [] as string[],
  mode: "parts" as const,
  totalMinutes: null,
  partsCount: 3,
  minutesPerPart: 1,
  ctaTemplate: "Curta e comente para a parte {next}.",
  finalCtaTemplate: null,
  aiProvider: "gemini",
  aiModel: "gemini-3.1-flash-lite",
  cronPattern: null,
  timezone: "America/Sao_Paulo",
  enabled: true,
  lastRunAt: null,
  createdAt: new Date("2025-01-01"),
  updatedAt: new Date("2025-01-01"),
};

const CREATE_BODY = {
  name: "Historias de trabalho",
  templateId: TEMPLATE_ROW.id,
  theme: "historias de gente que se ferrou no emprego, em primeira pessoa",
  mode: "parts",
  partsCount: 3,
  minutesPerPart: 1,
  aiModel: "gemini-3.1-flash-lite",
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
  mockDatabase.delete.mockReset().mockReturnValue(chainResult([{ id: SCHEDULER_ROW.id }]));
  mockGetSession.mockReset().mockResolvedValue(TEST_SESSION);
  mockSchedulerQueue.upsertJobScheduler.mockReset().mockResolvedValue(undefined);
  mockSchedulerQueue.removeJobScheduler.mockReset().mockResolvedValue(true);
  mockSchedulerQueue.getJobScheduler.mockReset().mockResolvedValue(null);
  mockSchedulerQueue.add.mockReset().mockResolvedValue({ id: "bull-run-1" });
});

describe("POST /api/schedulers", () => {
  it("creates a scheduler for a template without SceneSource", async () => {
    mockDatabase.select
      .mockReturnValueOnce(chainResult([TEMPLATE_ROW])) // assertNoSceneSource
      .mockReturnValueOnce(chainResult([{ value: 2 }])); // enabled count
    mockDatabase.insert.mockReturnValue(chainResult([SCHEDULER_ROW]));

    const res = await app.handle(jsonRequest("/api/schedulers", "POST", CREATE_BODY));

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.templateName).toBe(TEMPLATE_ROW.name);
    expect(body.userId).toBeUndefined(); // DTO nunca vaza userId
  });

  it("rejects a template that uses SceneSource", async () => {
    const sceneTemplate = {
      ...TEMPLATE_ROW,
      graph: { ...TEMPLATE_ROW.graph, nodes: [...TEMPLATE_ROW.graph.nodes, { id: "scene", kind: "source", type: "SceneSource", config: {} }] },
    };
    mockDatabase.select.mockReturnValueOnce(chainResult([sceneTemplate]));

    const res = await app.handle(jsonRequest("/api/schedulers", "POST", CREATE_BODY));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/slots de cena/);
  });

  it("returns 404 when the template does not exist for this user", async () => {
    mockDatabase.select.mockReturnValueOnce(chainResult([]));

    const res = await app.handle(jsonRequest("/api/schedulers", "POST", CREATE_BODY));

    expect(res.status).toBe(404);
  });

  it("returns 400 when mode=parts is missing partsCount/minutesPerPart", async () => {
    const res = await app.handle(
      jsonRequest("/api/schedulers", "POST", { ...CREATE_BODY, partsCount: undefined, minutesPerPart: undefined }),
    );

    expect(res.status).toBe(400);
  });

  it("returns 409 at the 10-enabled-schedulers limit", async () => {
    mockDatabase.select
      .mockReturnValueOnce(chainResult([TEMPLATE_ROW]))
      .mockReturnValueOnce(chainResult([{ value: 10 }]));

    const res = await app.handle(jsonRequest("/api/schedulers", "POST", CREATE_BODY));

    expect(res.status).toBe(409);
  });

  it("returns 400 for an invalid cron pattern instead of saving a broken scheduler", async () => {
    mockDatabase.select
      .mockReturnValueOnce(chainResult([TEMPLATE_ROW]))
      .mockReturnValueOnce(chainResult([{ value: 0 }]));
    mockSchedulerQueue.upsertJobScheduler.mockRejectedValueOnce(new Error("invalid cron expression"));

    const res = await app.handle(jsonRequest("/api/schedulers", "POST", { ...CREATE_BODY, cronPattern: "not a cron" }));

    expect(res.status).toBe(400);
    expect(mockDatabase.insert).not.toHaveBeenCalled();
  });

  it("enqueues a manual run when runOnCreate is set", async () => {
    mockDatabase.select
      .mockReturnValueOnce(chainResult([TEMPLATE_ROW]))
      .mockReturnValueOnce(chainResult([{ value: 0 }]));
    mockDatabase.insert.mockReturnValue(chainResult([SCHEDULER_ROW]));

    await app.handle(jsonRequest("/api/schedulers", "POST", { ...CREATE_BODY, runOnCreate: true }));

    expect(mockSchedulerQueue.add).toHaveBeenCalledWith("run", expect.objectContaining({ triggeredBy: "manual" }));
  });
});

describe("GET /api/schedulers", () => {
  it("lists schedulers with lastRun and nextRunAt", async () => {
    mockDatabase.select
      .mockReturnValueOnce(chainResult([{ scheduler: SCHEDULER_ROW, templateName: TEMPLATE_ROW.name }]))
      .mockReturnValueOnce(chainResult([{ count: 1 }]))
      .mockReturnValueOnce(chainResult([])); // sem execuções ainda

    const res = await app.handle(authedRequest("/api/schedulers"));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.total).toBe(1);
    expect(body.data[0].lastRun).toBeNull();
    expect(body.data[0].nextRunAt).toBeNull(); // enabled mas sem cronPattern
  });
});

describe("GET /api/schedulers/:id", () => {
  it("returns 404 when not found", async () => {
    mockDatabase.select.mockReturnValueOnce(chainResult([]));
    const res = await app.handle(authedRequest(`/api/schedulers/${SCHEDULER_ROW.id}`));
    expect(res.status).toBe(404);
  });

  it("returns the scheduler with an empty runs list", async () => {
    mockDatabase.select
      .mockReturnValueOnce(chainResult([{ scheduler: SCHEDULER_ROW, templateName: TEMPLATE_ROW.name }]))
      .mockReturnValueOnce(chainResult([]));

    const res = await app.handle(authedRequest(`/api/schedulers/${SCHEDULER_ROW.id}`));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.runs).toEqual([]);
  });
});

describe("PUT /api/schedulers/:id", () => {
  it("updates the theme and keeps other fields", async () => {
    mockDatabase.select.mockReturnValueOnce(chainResult([SCHEDULER_ROW]));
    mockDatabase.update.mockReturnValue(chainResult([{ ...SCHEDULER_ROW, theme: "novo tema qualquer, dez ou mais caracteres" }]));
    mockDatabase.select.mockReturnValueOnce(chainResult([{ name: TEMPLATE_ROW.name }]));

    const res = await app.handle(
      jsonRequest(`/api/schedulers/${SCHEDULER_ROW.id}`, "PUT", { theme: "novo tema qualquer, dez ou mais caracteres" }),
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.theme).toBe("novo tema qualquer, dez ou mais caracteres");
  });

  it("returns 404 when the scheduler does not belong to the user", async () => {
    mockDatabase.select.mockReturnValueOnce(chainResult([]));
    const res = await app.handle(jsonRequest(`/api/schedulers/${SCHEDULER_ROW.id}`, "PUT", { theme: "x".repeat(20) }));
    expect(res.status).toBe(404);
  });
});

describe("POST /api/schedulers/:id/run", () => {
  it("enqueues a manual run", async () => {
    mockDatabase.select
      .mockReturnValueOnce(chainResult([{ id: SCHEDULER_ROW.id }]))
      .mockReturnValueOnce(chainResult([])); // sem execução em andamento

    const res = await app.handle(jsonRequest(`/api/schedulers/${SCHEDULER_ROW.id}/run`, "POST"));

    expect(res.status).toBe(202);
    expect(mockSchedulerQueue.add).toHaveBeenCalledWith("run", { schedulerId: SCHEDULER_ROW.id, triggeredBy: "manual" });
  });

  it("returns 409 when a run is already in flight", async () => {
    mockDatabase.select
      .mockReturnValueOnce(chainResult([{ id: SCHEDULER_ROW.id }]))
      .mockReturnValueOnce(chainResult([{ id: "run-in-flight" }]));

    const res = await app.handle(jsonRequest(`/api/schedulers/${SCHEDULER_ROW.id}/run`, "POST"));

    expect(res.status).toBe(409);
    expect(mockSchedulerQueue.add).not.toHaveBeenCalled();
  });
});

describe("POST /api/schedulers/:id/pause and /resume", () => {
  it("pause sets enabled=false and removes the BullMQ scheduler", async () => {
    mockDatabase.select.mockReturnValueOnce(chainResult([SCHEDULER_ROW]));
    mockDatabase.update.mockReturnValue(chainResult([{ ...SCHEDULER_ROW, enabled: false }]));
    mockDatabase.select.mockReturnValueOnce(chainResult([{ name: TEMPLATE_ROW.name }]));

    const res = await app.handle(jsonRequest(`/api/schedulers/${SCHEDULER_ROW.id}/pause`, "POST"));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.enabled).toBe(false);
    expect(mockSchedulerQueue.removeJobScheduler).toHaveBeenCalled();
  });

  it("resume respects the 10-enabled limit", async () => {
    mockDatabase.select
      .mockReturnValueOnce(chainResult([{ ...SCHEDULER_ROW, enabled: false }]))
      .mockReturnValueOnce(chainResult([{ value: 10 }]));

    const res = await app.handle(jsonRequest(`/api/schedulers/${SCHEDULER_ROW.id}/resume`, "POST"));

    expect(res.status).toBe(409);
  });
});

describe("DELETE /api/schedulers/:id", () => {
  it("removes the scheduler but leaves jobs untouched (no job deletion here)", async () => {
    mockDatabase.select.mockReturnValueOnce(chainResult([{ id: SCHEDULER_ROW.id }]));

    const res = await app.handle(jsonRequest(`/api/schedulers/${SCHEDULER_ROW.id}`, "DELETE"));

    expect(res.status).toBe(204);
    expect(mockSchedulerQueue.removeJobScheduler).toHaveBeenCalledWith(SCHEDULER_ROW.id);
    expect(mockDatabase.delete).toHaveBeenCalled();
  });

  it("returns 404 when the scheduler does not exist", async () => {
    mockDatabase.select.mockReturnValueOnce(chainResult([]));
    const res = await app.handle(jsonRequest(`/api/schedulers/${SCHEDULER_ROW.id}`, "DELETE"));
    expect(res.status).toBe(404);
  });
});

describe("GET /api/schedulers/estimate", () => {
  it("computes credits and words without touching the database", async () => {
    const res = await app.handle(authedRequest("/api/schedulers/estimate?mode=parts&partsCount=4&minutesPerPart=1"));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.partsTotal).toBe(4);
    expect(body.creditsTotal).toBe(60);
    expect(mockDatabase.select).not.toHaveBeenCalled();
  });

  it("returns 400 for mode=parts without partsCount", async () => {
    const res = await app.handle(authedRequest("/api/schedulers/estimate?mode=parts"));
    expect(res.status).toBe(400);
  });
});

describe("auth", () => {
  it("returns 401 when unauthenticated", async () => {
    mockGetSession.mockResolvedValueOnce(null);
    const res = await app.handle(authedRequest("/api/schedulers"));
    expect(res.status).toBe(401);
  });
});
