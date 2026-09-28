import { describe, it, expect } from "bun:test";
import { cadenceToCron, cronToCadence, cadenceLabel, formatSchedulerFormat, applyCtaPreview } from "./scheduler";

describe("cadenceToCron", () => {
  it("manual is null (só disparo manual)", () => {
    expect(cadenceToCron({ kind: "manual" })).toBeNull();
  });

  it("daily at a given time", () => {
    expect(cadenceToCron({ kind: "daily", time: "09:00" })).toBe("0 9 * * *");
  });

  it("weekly on a given weekday", () => {
    expect(cadenceToCron({ kind: "weekly", time: "09:30", weekday: 1 })).toBe("30 9 * * 1");
  });

  it("custom passes the raw cron through", () => {
    expect(cadenceToCron({ kind: "custom", cron: "*/15 * * * *" })).toBe("*/15 * * * *");
  });

  it("custom with empty cron is null", () => {
    expect(cadenceToCron({ kind: "custom", cron: "  " })).toBeNull();
  });
});

describe("cronToCadence", () => {
  it("is the inverse of cadenceToCron for daily", () => {
    const cron = cadenceToCron({ kind: "daily", time: "09:00" })!;
    expect(cronToCadence(cron)).toEqual({ kind: "daily", time: "09:00" });
  });

  it("is the inverse of cadenceToCron for weekly", () => {
    const cron = cadenceToCron({ kind: "weekly", time: "14:05", weekday: 3 })!;
    expect(cronToCadence(cron)).toEqual({ kind: "weekly", time: "14:05", weekday: 3 });
  });

  it("null cron means manual", () => {
    expect(cronToCadence(null)).toEqual({ kind: "manual" });
  });

  it("falls back to custom for anything it can't map to a preset", () => {
    expect(cronToCadence("*/5 * * * *")).toEqual({ kind: "custom", cron: "*/5 * * * *" });
  });
});

describe("cadenceLabel", () => {
  it("describes each kind in Portuguese", () => {
    expect(cadenceLabel({ kind: "manual" })).toBe("Só manual");
    expect(cadenceLabel({ kind: "daily", time: "09:00" })).toBe("Diário às 09:00");
    expect(cadenceLabel({ kind: "weekly", time: "09:00", weekday: 1 })).toBe("Segunda às 09:00");
  });
});

describe("formatSchedulerFormat", () => {
  it("describes a single-video scheduler", () => {
    expect(formatSchedulerFormat({ mode: "single", totalMinutes: 3, partsCount: null, minutesPerPart: null })).toBe(
      "Único · 3 min",
    );
  });

  it("describes a multi-part scheduler", () => {
    expect(formatSchedulerFormat({ mode: "parts", totalMinutes: null, partsCount: 4, minutesPerPart: 1 })).toBe(
      "4 partes × 1 min",
    );
  });
});

describe("applyCtaPreview", () => {
  it("fills the placeholders for a middle part", () => {
    expect(applyCtaPreview("Curta e comente para a parte {next}.", 2, 4)).toBe("Curta e comente para a parte 2.");
  });

  it("adds a trailing period when missing", () => {
    expect(applyCtaPreview("Curta e comente para a parte {next}", 2, 4)).toBe("Curta e comente para a parte 2.");
  });

  it("is empty for an empty template", () => {
    expect(applyCtaPreview("   ")).toBe("");
  });
});
