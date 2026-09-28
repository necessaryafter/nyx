import { describe, it, expect } from "bun:test";
import { applySchedulerOverrides } from "../lib/scheduler/overrides";
import { estimateRun } from "../lib/scheduler/estimate";
import type { GraphInput } from "../lib/schemas";

const UUID_BG = "a0000000-0000-4000-8000-000000000001";
const UUID_MUSIC = "a0000000-0000-4000-8000-000000000002";
const UUID_NEW_BG = "b0000000-0000-4000-8000-000000000001";
const UUID_NEW_MUSIC = "b0000000-0000-4000-8000-000000000002";

function baseGraph(): GraphInput {
  return {
    version: 2,
    settings: { width: 1080, height: 1920, fps: 30 },
    nodes: [
      { id: "narration", kind: "source", type: "NarrationSource", config: { mode: "job-input", provider: "edge" } },
      { id: "bg", kind: "source", type: "AssetSource", config: { assetIds: [UUID_BG], assetType: "video" } },
      { id: "music", kind: "source", type: "MusicSource", config: { assetIds: [UUID_MUSIC], mode: "random-loop" } },
      { id: "on-sentence", kind: "event", type: "OnSentence", config: {} },
      { id: "subtitle", kind: "action", type: "SetSubtitleStyle", config: { wordsPerGroup: 2 } },
      { id: "card", kind: "action", type: "ShowTitleCard", config: {} },
      { id: "render", kind: "output", type: "Render", config: {} },
    ],
    edges: [
      { id: "e1", from: "narration", to: "on-sentence", role: "narration" },
      { id: "e2", from: "on-sentence", to: "subtitle", role: "trigger" },
      { id: "e3", from: "subtitle", to: "render" },
      { id: "e4", from: "bg", to: "render", role: "media" },
      { id: "e5", from: "music", to: "render", role: "music" },
    ],
  };
}

describe("applySchedulerOverrides", () => {
  it("replaces the video/image AssetSource pool when assetIds is non-empty", () => {
    const out = applySchedulerOverrides(baseGraph(), {
      assetIds: [UUID_NEW_BG],
      musicAssetIds: [],
      title: "Um título",
      partIndex: 1,
      partsTotal: 1,
    });
    const bg = out.nodes.find((n) => n.id === "bg");
    expect(bg?.type).toBe("AssetSource");
    expect(bg?.type === "AssetSource" && bg.config.assetIds).toEqual([UUID_NEW_BG]);
  });

  it("keeps the template's assets when assetIds is empty", () => {
    const out = applySchedulerOverrides(baseGraph(), {
      assetIds: [],
      musicAssetIds: [],
      title: "T",
      partIndex: 1,
      partsTotal: 1,
    });
    const bg = out.nodes.find((n) => n.id === "bg");
    expect(bg?.type === "AssetSource" && bg.config.assetIds).toEqual([UUID_BG]);
  });

  it("replaces MusicSource assets independently of the background", () => {
    const out = applySchedulerOverrides(baseGraph(), {
      assetIds: [],
      musicAssetIds: [UUID_NEW_MUSIC],
      title: "T",
      partIndex: 1,
      partsTotal: 1,
    });
    const music = out.nodes.find((n) => n.id === "music");
    expect(music?.type === "MusicSource" && music.config.assetIds).toEqual([UUID_NEW_MUSIC]);
  });

  it("part 1 of a multi-part series keeps the plain title on the card", () => {
    const out = applySchedulerOverrides(baseGraph(), {
      assetIds: [],
      musicAssetIds: [],
      title: "Um título",
      partIndex: 1,
      partsTotal: 3,
    });
    const card = out.nodes.find((n) => n.id === "card");
    expect(card?.type === "ShowTitleCard" && card.config.title).toBe("Um título");
  });

  it("part 3 of a multi-part series appends '— Parte 3' to the card title", () => {
    const out = applySchedulerOverrides(baseGraph(), {
      assetIds: [],
      musicAssetIds: [],
      title: "Um título",
      partIndex: 3,
      partsTotal: 3,
    });
    const card = out.nodes.find((n) => n.id === "card");
    expect(card?.type === "ShowTitleCard" && card.config.title).toBe("Um título — Parte 3");
    expect(card?.type === "ShowTitleCard" && card.config.minDurationMs).toBe(2500);
  });

  it("a single-part run (N=1) never appends '— Parte N'", () => {
    const out = applySchedulerOverrides(baseGraph(), {
      assetIds: [],
      musicAssetIds: [],
      title: "Um título",
      partIndex: 1,
      partsTotal: 1,
    });
    const card = out.nodes.find((n) => n.id === "card");
    expect(card?.type === "ShowTitleCard" && card.config.title).toBe("Um título");
  });

  it("does not touch nodes it has no rule for", () => {
    const graph = baseGraph();
    const out = applySchedulerOverrides(graph, {
      assetIds: [],
      musicAssetIds: [],
      title: "T",
      partIndex: 1,
      partsTotal: 1,
    });
    const subtitle = out.nodes.find((n) => n.id === "subtitle");
    expect(subtitle).toEqual(graph.nodes.find((n) => n.id === "subtitle"));
  });
});

describe("estimateRun", () => {
  it("multiplies per-part credits by the number of parts", () => {
    const result = estimateRun({ mode: "parts", partsCount: 4, minutesPerPart: 1 });
    expect(result.partsTotal).toBe(4);
    expect(result.creditsPerPart).toBe(15); // RENDER_CREDITS_PER_MIN(10) + TTS_CREDITS_PER_MIN(5), default env
    expect(result.creditsTotal).toBe(60);
  });

  it("treats mode=single as a single part", () => {
    const result = estimateRun({ mode: "single", totalMinutes: 3 });
    expect(result.partsTotal).toBe(1);
    expect(result.minutesPerPart).toBe(3);
    expect(result.creditsTotal).toBe(45);
  });

  it("estimates words per part at the given rate", () => {
    const result = estimateRun({ mode: "parts", partsCount: 2, minutesPerPart: 1, wordsPerMinute: 150 });
    expect(result.wordsPerPart).toBe(150);
  });
});
