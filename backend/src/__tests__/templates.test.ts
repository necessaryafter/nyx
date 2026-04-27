import { describe, it, expect, beforeEach } from "bun:test";
import { Elysia } from "elysia";
import { mockDatabase } from "./helpers/setup";
import { chainResult } from "./helpers/mock-db";
import { mockGetSession, authedRequest, TEST_SESSION } from "./helpers/mock-session";
import { TEMPLATE_ROW, VALID_GRAPH } from "./helpers/fixtures";

import { templateRoutes } from "../routes/templates";

const app = new Elysia().use(templateRoutes);

beforeEach(() => {
  mockDatabase.select.mockReset().mockReturnValue(chainResult([]));
  mockDatabase.insert.mockReset().mockReturnValue(chainResult([]));
  mockDatabase.update.mockReset().mockReturnValue(chainResult([]));
  mockDatabase.delete.mockReset().mockReturnValue(chainResult(undefined));
  mockGetSession.mockReset().mockResolvedValue(TEST_SESSION);
});

describe("POST /api/templates", () => {
  it("returns 201 with valid graph", async () => {
    mockDatabase.insert.mockReturnValue(chainResult([TEMPLATE_ROW]));

    const res = await app.handle(authedRequest("/api/templates", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "My Template", graph: VALID_GRAPH }),
    }));

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.name).toBe("Test Template");
  });

  it("returns 400 for invalid body", async () => {
    const res = await app.handle(authedRequest("/api/templates", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "" }),
    }));

    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid graph structure (no Render node)", async () => {
    const noRenderGraph = {
      ...VALID_GRAPH,
      nodes: VALID_GRAPH.nodes.filter((n) => n.type !== "Render"),
    };

    const res = await app.handle(authedRequest("/api/templates", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Bad Template", graph: noRenderGraph }),
    }));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("invalid graph structure");
  });
});

describe("GET /api/templates", () => {
  it("returns paginated list", async () => {
    mockDatabase.select
      .mockReturnValueOnce(chainResult([TEMPLATE_ROW]))
      .mockReturnValueOnce(chainResult([{ count: 1 }]));

    const res = await app.handle(authedRequest("/api/templates"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(1);
    expect(body.total).toBe(1);
  });
});

describe("GET /api/templates/:id", () => {
  it("returns template owned by user", async () => {
    mockDatabase.select.mockReturnValue(chainResult([TEMPLATE_ROW]));

    const res = await app.handle(authedRequest(`/api/templates/${TEMPLATE_ROW.id}`));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe(TEMPLATE_ROW.id);
  });

  it("returns 404 when not found", async () => {
    mockDatabase.select.mockReturnValue(chainResult([]));

    const res = await app.handle(authedRequest("/api/templates/nonexistent"));
    expect(res.status).toBe(404);
  });
});

describe("PUT /api/templates/:id", () => {
  it("updates name", async () => {
    mockDatabase.select.mockReturnValue(chainResult([{ id: TEMPLATE_ROW.id }]));
    mockDatabase.update.mockReturnValue(chainResult([{ ...TEMPLATE_ROW, name: "Updated" }]));

    const res = await app.handle(authedRequest(`/api/templates/${TEMPLATE_ROW.id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Updated" }),
    }));

    expect(res.status).toBe(200);
  });

  it("returns 400 for invalid graph structure in update", async () => {
    const badGraph = { ...VALID_GRAPH, nodes: VALID_GRAPH.nodes.filter((n) => n.type !== "Render") };

    const res = await app.handle(authedRequest(`/api/templates/${TEMPLATE_ROW.id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ graph: badGraph }),
    }));

    expect(res.status).toBe(400);
  });

  it("returns 404 when not owned", async () => {
    mockDatabase.select.mockReturnValue(chainResult([]));

    const res = await app.handle(authedRequest(`/api/templates/${TEMPLATE_ROW.id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "X" }),
    }));

    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/templates/:id", () => {
  it("returns 200 and deleted:true", async () => {
    mockDatabase.select.mockReturnValue(chainResult([{ id: TEMPLATE_ROW.id }]));

    const res = await app.handle(authedRequest(`/api/templates/${TEMPLATE_ROW.id}`, {
      method: "DELETE",
    }));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.deleted).toBe(true);
  });

  it("returns 404 when not found", async () => {
    mockDatabase.select.mockReturnValue(chainResult([]));

    const res = await app.handle(authedRequest(`/api/templates/${TEMPLATE_ROW.id}`, {
      method: "DELETE",
    }));

    expect(res.status).toBe(404);
  });
});
