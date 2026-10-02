import { describe, it, expect, beforeEach } from "bun:test";
import { Elysia } from "elysia";
import { mockDatabase, mockMinio } from "./helpers/setup";
import { chainResult } from "./helpers/mock-db";
import { mockGetSession, authedRequest, TEST_SESSION } from "./helpers/mock-session";
import { ASSET_ROW } from "./helpers/fixtures";

import { assetRoutes } from "../routes/assets";
import { normalizeCategory } from "../lib/assetCategory";
import { pruneAssetRefs } from "../lib/assetReset";

const app = new Elysia().use(assetRoutes);
const json = (body: unknown) => ({ method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

beforeEach(() => {
  mockDatabase.select.mockReset().mockReturnValue(chainResult([]));
  mockDatabase.insert.mockReset().mockReturnValue(chainResult([]));
  mockDatabase.update.mockReset().mockReturnValue(chainResult([]));
  mockDatabase.delete.mockReset().mockReturnValue(chainResult(undefined));
  mockMinio.putObject.mockReset().mockResolvedValue(undefined);
  mockMinio.removeObject.mockReset().mockResolvedValue(undefined);
  mockGetSession.mockReset().mockResolvedValue(TEST_SESSION);
});

describe("normalizeCategory", () => {
  it("limpa espaços e trata vazio/avulso como null", () => {
    expect(normalizeCategory("  carro   amassando ")).toBe("carro amassando");
    expect(normalizeCategory("")).toBeNull();
    expect(normalizeCategory("   ")).toBeNull();
    expect(normalizeCategory("__none__")).toBeNull();
    expect(normalizeCategory(undefined)).toBeNull();
    expect(normalizeCategory("x".repeat(200))).toHaveLength(80);
  });
});

describe("pruneAssetRefs", () => {
  const A = "a0000000-0000-4000-8000-000000000001";
  const B = "b0000000-0000-4000-8000-000000000002";
  it("a marca d'água (etapa ShowWatermark) perde o assetId quando o asset é apagado", () => {
    const out = pruneAssetRefs({ nodes: [{ type: "ShowWatermark", config: { assetId: A, widthPercent: 14 } }, { type: "ShowTitleCard", config: { avatarAssetId: A } }] }, new Set([A]));
    expect(out.nodes[0]!.config).toEqual({ assetId: null, widthPercent: 14 });
    expect(out.nodes[1]!.config).toEqual({ avatarAssetId: null });
  });
  it('"all" limpa toda referência, até as órfãs', () => {
    const out = pruneAssetRefs({ nodes: [{ config: { assetIds: [A, B], assetId: "qualquer", mode: "x" } }] }, "all");
    expect(out.nodes[0]!.config).toEqual({ assetIds: [], assetId: null, mode: "x" });
  });
  it("tira ids apagados de assetIds e zera assetId, sem mexer no resto", () => {
    const graph = { nodes: [
      { id: "n1", config: { assetIds: [A, B], mode: "random-loop" } },
      { id: "n2", config: { assetId: A, x: 1 } },
      { id: "n3", config: { assetId: B } },
    ] };
    const out = pruneAssetRefs(graph, new Set([A]));
    expect(out.nodes[0]!.config).toEqual({ assetIds: [B], mode: "random-loop" });
    expect(out.nodes[1]!.config).toEqual({ assetId: null, x: 1 });
    expect(out.nodes[2]!.config).toEqual({ assetId: B });
    expect(graph.nodes[0]!.config.assetIds).toEqual([A, B]); // entrada intacta
  });
});

describe("GET /api/assets/categories", () => {
  it("agrupa por categoria, separa avulsos e ordena por nome", async () => {
    mockDatabase.select.mockReturnValue(chainResult([
      { category: "slime", count: 3 },
      { category: null, count: 5 },
      { category: "prensa", count: 7 },
    ]));
    const res = await app.handle(authedRequest("/api/assets/categories?type=video"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      categories: [{ category: "prensa", count: 7 }, { category: "slime", count: 3 }],
      none: 5,
      total: 15,
    });
  });
});

describe("GET /api/assets/ids", () => {
  it("devolve todos os ids do filtro", async () => {
    mockDatabase.select.mockReturnValue(chainResult([{ id: ASSET_ROW.id, name: ASSET_ROW.name }]));
    const res = await app.handle(authedRequest("/api/assets/ids?type=video&category=prensa"));
    expect(res.status).toBe(200);
    expect((await res.json()).data).toEqual([{ id: ASSET_ROW.id, name: ASSET_ROW.name }]);
  });
  it("aceita o filtro de avulsos", async () => {
    const res = await app.handle(authedRequest("/api/assets/ids?category=__none__"));
    expect(res.status).toBe(200);
  });
});

describe("PUT /api/assets/:id (categoria)", () => {
  it("move o asset para uma categoria", async () => {
    mockDatabase.select.mockReturnValue(chainResult([ASSET_ROW]));
    mockDatabase.update.mockReturnValue(chainResult([{ ...ASSET_ROW, category: "prensa" }]));
    const res = await app.handle(authedRequest(`/api/assets/${ASSET_ROW.id}`, json({ category: "  prensa " })));
    expect(res.status).toBe(200);
    expect((await res.json()).category).toBe("prensa");
    const set = (mockDatabase.update.mock.results[0]!.value as { set: { mock: { calls: unknown[][] } } }).set;
    expect(set.mock.calls[0]![0]).toEqual({ category: "prensa" });
  });
  it("category null tira o asset da categoria", async () => {
    mockDatabase.select.mockReturnValue(chainResult([{ ...ASSET_ROW, category: "prensa" }]));
    mockDatabase.update.mockReturnValue(chainResult([{ ...ASSET_ROW, category: null }]));
    const res = await app.handle(authedRequest(`/api/assets/${ASSET_ROW.id}`, json({ category: null })));
    expect(res.status).toBe(200);
    const set = (mockDatabase.update.mock.results[0]!.value as { set: { mock: { calls: unknown[][] } } }).set;
    expect(set.mock.calls[0]![0]).toEqual({ category: null });
  });
  it("exige nome ou categoria", async () => {
    const res = await app.handle(authedRequest(`/api/assets/${ASSET_ROW.id}`, json({})));
    expect(res.status).toBe(400);
  });
});

describe("POST /api/assets/upload (categoria)", () => {
  it("grava a categoria normalizada", async () => {
    mockDatabase.insert.mockReturnValue(chainResult([{ ...ASSET_ROW, category: "prensa" }]));
    const form = new FormData();
    form.append("file", new Blob(["x"], { type: "video/mp4" }), "a.mp4");
    form.append("name", "a.mp4");
    form.append("type", "video");
    form.append("category", "  prensa ");
    const res = await app.handle(authedRequest("/api/assets/upload", { method: "POST", body: form }));
    expect(res.status).toBe(201);
    const values = (mockDatabase.insert.mock.results[0]!.value as { values: { mock: { calls: unknown[][] } } }).values;
    expect((values.mock.calls[0]![0] as { category: string }).category).toBe("prensa");
  });
});

describe("POST /api/assets/reset", () => {
  it("recusa sem a confirmação", async () => {
    const res = await app.handle(authedRequest("/api/assets/reset", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({}) }));
    expect(res.status).toBe(400);
    expect(mockMinio.removeObject).not.toHaveBeenCalled();
    expect(mockDatabase.delete).not.toHaveBeenCalled();
  });
  it("apaga arquivos e linhas e limpa schedulers/templates", async () => {
    const SCHED = { id: "s1", userId: "user-test-123", assetIds: [ASSET_ROW.id, "keep"], musicAssetIds: [] };
    const TPL = { id: "t1", userId: "user-test-123", graph: { nodes: [{ id: "n", config: { assetIds: [ASSET_ROW.id] } }] } };
    mockDatabase.select
      .mockReturnValueOnce(chainResult([{ id: ASSET_ROW.id, storageKey: ASSET_ROW.storageKey }]))
      .mockReturnValueOnce(chainResult([SCHED]))
      .mockReturnValueOnce(chainResult([TPL]));
    const res = await app.handle(authedRequest("/api/assets/reset", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ confirm: "RESETAR" }) }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ deleted: 1, schedulersUpdated: 1, templatesUpdated: 1 });
    // (a remoção no MinIO não é assertada: o setup de testes mocka lib/minio, mas a rota usa @nyx/shared)
    expect(mockDatabase.delete).toHaveBeenCalledTimes(1);
    // o builder do mock é o mesmo objeto nas duas chamadas de update: lê as chamadas de .set em ordem
    const setCalls = (mockDatabase.update.mock.results[0]!.value as { set: { mock: { calls: unknown[][] } } }).set.mock.calls.map((c) => c[0]);
    expect(setCalls[0]).toEqual({ assetIds: [], musicAssetIds: [] });
    expect(setCalls[1]).toEqual({ graph: { nodes: [{ id: "n", config: { assetIds: [] } }] } });
  });
});
