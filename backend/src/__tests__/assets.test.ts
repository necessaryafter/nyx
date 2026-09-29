import { describe, it, expect, beforeEach } from "bun:test";
import { Elysia } from "elysia";
import { mockDatabase, mockMinio } from "./helpers/setup";
import { chainResult } from "./helpers/mock-db";
import { mockGetSession, authedRequest, TEST_SESSION } from "./helpers/mock-session";
import { ASSET_ROW } from "./helpers/fixtures";

import { assetRoutes } from "../routes/assets";

const app = new Elysia().use(assetRoutes);

beforeEach(() => {
  mockDatabase.select.mockReset().mockReturnValue(chainResult([]));
  mockDatabase.insert.mockReset().mockReturnValue(chainResult([]));
  mockDatabase.delete.mockReset().mockReturnValue(chainResult(undefined));
  mockMinio.putObject.mockReset().mockResolvedValue(undefined);
  mockMinio.removeObject.mockReset().mockResolvedValue(undefined);
  mockGetSession.mockReset().mockResolvedValue(TEST_SESSION);
});

describe("POST /api/assets/upload", () => {
  it("returns 201 with created asset", async () => {
    mockDatabase.insert.mockReturnValue(chainResult([ASSET_ROW]));

    const formData = new FormData();
    formData.append("file", new Blob(["content"], { type: "video/mp4" }), "bg.mp4");
    formData.append("name", "bg.mp4");
    formData.append("type", "video");

    const res = await app.handle(authedRequest("/api/assets/upload", {
      method: "POST",
      body: formData,
    }));

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.name).toBe("bg-video.mp4");
    expect(mockMinio.putObject).toHaveBeenCalled();
  });

  it("returns 400 when file is missing", async () => {
    const formData = new FormData();
    formData.append("name", "bg.mp4");
    formData.append("type", "video");

    const res = await app.handle(authedRequest("/api/assets/upload", {
      method: "POST",
      body: formData,
    }));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("file is required");
  });

  it("returns 400 for invalid fields", async () => {
    const formData = new FormData();
    formData.append("file", new Blob(["x"]), "f.mp4");
    formData.append("name", "");
    formData.append("type", "video");

    const res = await app.handle(authedRequest("/api/assets/upload", {
      method: "POST",
      body: formData,
    }));

    expect(res.status).toBe(400);
  });

  it("returns 401 when unauthenticated", async () => {
    mockGetSession.mockResolvedValueOnce(null);

    const formData = new FormData();
    formData.append("file", new Blob(["x"]), "f.mp4");
    formData.append("name", "f.mp4");
    formData.append("type", "video");

    const res = await app.handle(authedRequest("/api/assets/upload", {
      method: "POST",
      body: formData,
    }));

    expect(res.status).toBe(401);
  });
});

describe("GET /api/assets", () => {
  it("returns paginated list", async () => {
    mockDatabase.select
      .mockReturnValueOnce(chainResult([ASSET_ROW]))
      .mockReturnValueOnce(chainResult([{ count: 1 }]));

    const res = await app.handle(authedRequest("/api/assets?limit=10&offset=0"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(1);
    expect(body.total).toBe(1);
  });

  it("returns 400 for invalid pagination", async () => {
    const res = await app.handle(authedRequest("/api/assets?limit=999"));
    expect(res.status).toBe(400);
  });
});

describe("PUT /api/assets/:id", () => {
  it("renames the asset", async () => {
    mockDatabase.select.mockReturnValue(chainResult([ASSET_ROW]));
    mockDatabase.update.mockReturnValue(chainResult([{ ...ASSET_ROW, name: "novo-nome.mp4" }]));

    const res = await app.handle(authedRequest(`/api/assets/${ASSET_ROW.id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "novo-nome.mp4" }),
    }));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.name).toBe("novo-nome.mp4");
  });

  it("returns 400 for an empty name", async () => {
    const res = await app.handle(authedRequest(`/api/assets/${ASSET_ROW.id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "" }),
    }));
    expect(res.status).toBe(400);
  });

  it("returns 404 when not found", async () => {
    mockDatabase.select.mockReturnValue(chainResult([]));

    const res = await app.handle(authedRequest("/api/assets/nonexistent", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "x" }),
    }));
    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/assets/:id", () => {
  it("returns 200 and deleted:true", async () => {
    mockDatabase.select.mockReturnValue(chainResult([ASSET_ROW]));

    const res = await app.handle(authedRequest(`/api/assets/${ASSET_ROW.id}`, {
      method: "DELETE",
    }));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.deleted).toBe(true);
    expect(mockMinio.removeObject).toHaveBeenCalled();
  });

  it("returns 404 when not found", async () => {
    mockDatabase.select.mockReturnValue(chainResult([]));

    const res = await app.handle(authedRequest("/api/assets/nonexistent", {
      method: "DELETE",
    }));

    expect(res.status).toBe(404);
  });
});
