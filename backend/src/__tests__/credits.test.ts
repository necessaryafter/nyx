import { describe, it, expect, beforeEach } from "bun:test";
import { mockDatabase } from "./helpers/setup";
import { chainResult } from "./helpers/mock-db";

// Must import AFTER setup.ts mocks are registered
import { getBalance, debitCredits } from "../lib/credits";

beforeEach(() => {
  mockDatabase.select.mockReset().mockReturnValue(chainResult([]));
  mockDatabase.insert.mockReset().mockReturnValue(chainResult([]));
});

describe("getBalance", () => {
  it("returns numeric balance from DB sum", async () => {
    mockDatabase.select.mockReturnValue(chainResult([{ total: "150" }]));
    const balance = await getBalance("user-1");
    expect(balance).toBe(150);
  });

  it("returns 0 when no transactions", async () => {
    mockDatabase.select.mockReturnValue(chainResult([{ total: null }]));
    const balance = await getBalance("user-1");
    expect(balance).toBe(0);
  });
});

describe("debitCredits", () => {
  it("inserts negative amount with correct values", async () => {
    mockDatabase.insert.mockReturnValue(chainResult([]));
    await debitCredits("user-1", 15, "render", "job-123");
    expect(mockDatabase.insert).toHaveBeenCalled();
  });
});
