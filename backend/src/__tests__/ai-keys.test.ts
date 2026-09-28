import { describe, it, expect, beforeEach, afterEach, mock, spyOn } from "bun:test";
import { Elysia } from "elysia";
import { mockDatabase } from "./helpers/setup";
import { chainResult } from "./helpers/mock-db";
import { mockGetSession, authedRequest, TEST_SESSION } from "./helpers/mock-session";

import { integrationRoutes } from "../routes/integrations";
import { aiRoutes } from "../routes/ai";
import { resolveGeminiKey, listGeminiModels } from "../lib/ai/gemini";
import { encrypt } from "@nyx/shared";

const app = new Elysia().use(integrationRoutes).use(aiRoutes);

beforeEach(() => {
  mockDatabase.select.mockReset().mockReturnValue(chainResult([]));
  mockDatabase.insert.mockReset().mockReturnValue(chainResult([]));
  mockDatabase.update.mockReset().mockReturnValue(chainResult([]));
  mockDatabase.delete.mockReset().mockReturnValue(chainResult([{ id: "int-1" }]));
  mockGetSession.mockReset().mockResolvedValue(TEST_SESSION);
  delete process.env.GOOGLE_AI_STUDIO_KEY;
});

afterEach(() => {
  mock.restore();
});

describe("resolveGeminiKey", () => {
  it("prefers the user's saved integration over the server env", async () => {
    process.env.GOOGLE_AI_STUDIO_KEY = "server-key";
    mockDatabase.select.mockReturnValue(chainResult([{ encryptedApiKey: encrypt("user-key") }]));
    const key = await resolveGeminiKey("user-1");
    expect(key).toBe("user-key");
  });

  it("falls back to the server env when there is no integration", async () => {
    process.env.GOOGLE_AI_STUDIO_KEY = "server-key";
    mockDatabase.select.mockReturnValue(chainResult([]));
    const key = await resolveGeminiKey("user-1");
    expect(key).toBe("server-key");
  });

  it("returns null when there is neither integration nor env", async () => {
    const key = await resolveGeminiKey("user-1");
    expect(key).toBeNull();
  });
});

describe("listGeminiModels", () => {
  const modelsResponse = {
    models: [
      { name: "models/gemini-3.1-flash-lite", supportedGenerationMethods: ["generateContent"] },
      { name: "models/gemini-3.8-flash", supportedGenerationMethods: ["generateContent"] },
      { name: "models/gemini-3.5-transcribe", supportedGenerationMethods: ["generateContent"] }, // excluded
      { name: "models/text-embedding-004", supportedGenerationMethods: ["embedContent"] }, // no generateContent + wrong prefix
      { name: "models/gemini-2.5-computer-use-preview-10-2025", supportedGenerationMethods: ["generateContent"] }, // excluded
    ],
  };

  it("filters to generateContent gemini-* models, excluding non-script models", async () => {
    const fetchSpy = spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(modelsResponse), { status: 200 }),
    );

    const models = await listGeminiModels("test-key-1");
    expect(models.map((m) => m.id)).toEqual(["gemini-3.1-flash-lite", "gemini-3.8-flash"]);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("caches by API key and does not re-hit the network for the same key", async () => {
    const fetchSpy = spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(modelsResponse), { status: 200 }),
    );

    await listGeminiModels("test-key-2");
    await listGeminiModels("test-key-2");
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});

describe("PUT /api/integrations/gemini", () => {
  it("rejects an invalid key without saving it", async () => {
    spyOn(globalThis, "fetch").mockResolvedValue(new Response("", { status: 400 }));

    const res = await app.handle(
      authedRequest("/api/integrations/gemini", {
        method: "PUT",
        body: JSON.stringify({ apiKey: "bad-key" }),
        headers: { "Content-Type": "application/json" },
      }),
    );

    expect(res.status).toBe(400);
    expect(mockDatabase.insert).not.toHaveBeenCalled();
    expect(mockDatabase.update).not.toHaveBeenCalled();
  });

  it("saves a valid key encrypted", async () => {
    spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ models: [] }), { status: 200 }));
    mockDatabase.select.mockReturnValue(chainResult([])); // no existing row -> insert path

    const res = await app.handle(
      authedRequest("/api/integrations/gemini", {
        method: "PUT",
        body: JSON.stringify({ apiKey: "AIzaSyGOODKEY1234567890" }),
        headers: { "Content-Type": "application/json" },
      }),
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.maskedKey).toBe("****7890");
    expect(mockDatabase.insert).toHaveBeenCalled();
  });
});

describe("DELETE /api/integrations/gemini", () => {
  it("removes the integration", async () => {
    const res = await app.handle(authedRequest("/api/integrations/gemini", { method: "DELETE" }));
    expect(res.status).toBe(200);
    expect(mockDatabase.delete).toHaveBeenCalled();
  });

  it("returns 404 when there is nothing to remove", async () => {
    mockDatabase.delete.mockReturnValue(chainResult([]));
    const res = await app.handle(authedRequest("/api/integrations/gemini", { method: "DELETE" }));
    expect(res.status).toBe(404);
  });
});

describe("GET /api/ai/models", () => {
  it("returns 503 with a clear message when no key is configured", async () => {
    const res = await app.handle(authedRequest("/api/ai/models"));
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error).toMatch(/Configure sua chave/);
  });

  it("returns the model list when a key is configured", async () => {
    process.env.GOOGLE_AI_STUDIO_KEY = "server-key";
    spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({ models: [{ name: "models/gemini-3.1-flash-lite", supportedGenerationMethods: ["generateContent"] }] }),
        { status: 200 },
      ),
    );

    const res = await app.handle(authedRequest("/api/ai/models"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual([{ id: "gemini-3.1-flash-lite", label: "Gemini 3.1 Flash Lite" }]);
  });
});
