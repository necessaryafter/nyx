import { describe, it, expect, beforeEach } from "bun:test";
import { Elysia } from "elysia";
import { mockDatabase } from "./helpers/setup";
import { chainResult } from "./helpers/mock-db";
import { mockGetSession, authedRequest, TEST_SESSION } from "./helpers/mock-session";
import { CREDIT_TX_ROW } from "./helpers/fixtures";

import { creditRoutes } from "../routes/credits";

const app = new Elysia().use(creditRoutes);

beforeEach(() => {
  mockDatabase.select.mockReset().mockReturnValue(chainResult([]));
  mockGetSession.mockReset().mockResolvedValue(TEST_SESSION);
});

describe("GET /api/credits/balance", () => {
  it("returns balance", async () => {
    mockDatabase.select.mockReturnValue(chainResult([{ total: "200" }]));
    const res = await app.handle(authedRequest("/api/credits/balance"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.balance).toBe(200);
  });

  it("returns 0 when no transactions", async () => {
    mockDatabase.select.mockReturnValue(chainResult([{ total: null }]));
    const res = await app.handle(authedRequest("/api/credits/balance"));
    const body = await res.json();
    expect(body.balance).toBe(0);
  });

  it("returns 401 when unauthenticated", async () => {
    mockGetSession.mockResolvedValueOnce(null);
    const res = await app.handle(authedRequest("/api/credits/balance"));
    expect(res.status).toBe(401);
  });
});

describe("GET /api/credits/history", () => {
  it("returns paginated list", async () => {
    mockDatabase.select
      .mockReturnValueOnce(chainResult([CREDIT_TX_ROW]))
      .mockReturnValueOnce(chainResult([{ count: 1 }]));

    const res = await app.handle(authedRequest("/api/credits/history?limit=10&offset=0"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(1);
    expect(body.total).toBe(1);
    expect(body.limit).toBe(10);
  });

  it("returns 400 for invalid pagination", async () => {
    const res = await app.handle(authedRequest("/api/credits/history?limit=999"));
    expect(res.status).toBe(400);
  });
});

describe("GET /api/credits/breakdown", () => {
  it("returns breakdown grouped by month", async () => {
    mockDatabase.select.mockReturnValue(
      chainResult([
        { month: "2025-01", reason: "render", total: "-150" },
        { month: "2025-01", reason: "purchase", total: "500" },
      ]),
    );

    const res = await app.handle(authedRequest("/api/credits/breakdown"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(body[0].month).toBe("2025-01");
    expect(body[0].render).toBe(-150);
    expect(body[0].purchase).toBe(500);
  });

  it("returns empty array when no transactions", async () => {
    mockDatabase.select.mockReturnValue(chainResult([]));
    const res = await app.handle(authedRequest("/api/credits/breakdown"));
    const body = await res.json();
    expect(body).toEqual([]);
  });
});
