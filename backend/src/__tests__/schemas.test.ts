import { describe, it, expect } from "bun:test";
import {
  graphSchema,
  validateGraphStructure,
  paginationSchema,
  creditFilterSchema,
  uploadAssetSchema,
} from "../lib/schemas";
import { VALID_GRAPH } from "./helpers/fixtures";

// ── graphSchema ──

describe("graphSchema", () => {
  it("accepts a valid complete graph", () => {
    const result = graphSchema.safeParse(VALID_GRAPH);
    expect(result.success).toBe(true);
  });

  it("rejects graph with version !== 1", () => {
    const result = graphSchema.safeParse({ ...VALID_GRAPH, version: 2 });
    expect(result.success).toBe(false);
  });

  it("rejects graph with empty nodes array", () => {
    const result = graphSchema.safeParse({ ...VALID_GRAPH, nodes: [] });
    expect(result.success).toBe(false);
  });

  it("rejects node with unknown type", () => {
    const result = graphSchema.safeParse({
      ...VALID_GRAPH,
      nodes: [{ id: "x", type: "Unknown", config: {} }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects TTS node with empty text", () => {
    const result = graphSchema.safeParse({
      ...VALID_GRAPH,
      nodes: [
        ...VALID_GRAPH.nodes.filter((n) => n.type !== "TTS"),
        { id: "tts1", type: "TTS", config: { text: "", provider: "talkify" } },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("rejects Render node with negative width", () => {
    const result = graphSchema.safeParse({
      ...VALID_GRAPH,
      nodes: [
        ...VALID_GRAPH.nodes.filter((n) => n.type !== "Render"),
        { id: "render1", type: "Render", config: { width: -1, height: 1920, fps: 30 } },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("rejects Subtitle with wordsPerGroup > 10", () => {
    const result = graphSchema.safeParse({
      ...VALID_GRAPH,
      nodes: [
        ...VALID_GRAPH.nodes.filter((n) => n.type !== "Subtitle"),
        { id: "sub1", type: "Subtitle", config: { wordsPerGroup: 20 } },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("accepts Subtitle with optional style", () => {
    const result = graphSchema.safeParse({
      ...VALID_GRAPH,
      nodes: [
        ...VALID_GRAPH.nodes.filter((n) => n.type !== "Subtitle"),
        {
          id: "sub1",
          type: "Subtitle",
          config: {
            wordsPerGroup: 3,
            style: { fontFamily: "Arial", fontSize: 48, position: "bottom" },
          },
        },
      ],
    });
    expect(result.success).toBe(true);
  });
});

// ── validateGraphStructure ──

describe("validateGraphStructure", () => {
  it("returns no errors for valid graph", () => {
    expect(validateGraphStructure(VALID_GRAPH)).toEqual([]);
  });

  it("returns error when 0 Render nodes", () => {
    const graph = {
      ...VALID_GRAPH,
      nodes: VALID_GRAPH.nodes.filter((n) => n.type !== "Render"),
    };
    const errors = validateGraphStructure(graph);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toContain("exactly 1 Render node");
  });

  it("returns error when 2+ Render nodes", () => {
    const graph = {
      ...VALID_GRAPH,
      nodes: [
        ...VALID_GRAPH.nodes,
        { id: "render2", type: "Render" as const, config: { width: 720, height: 1280, fps: 30 } },
      ],
    };
    const errors = validateGraphStructure(graph);
    expect(errors.some((e) => e.includes("exactly 1 Render node"))).toBe(true);
  });

  it("returns error for edge referencing nonexistent source node", () => {
    const graph = {
      ...VALID_GRAPH,
      edges: [
        ...VALID_GRAPH.edges,
        { id: "bad", from: "nonexistent", fromHandle: "video", to: "loop1", toHandle: "video" },
      ],
    };
    const errors = validateGraphStructure(graph);
    expect(errors.some((e) => e.includes("source node \"nonexistent\" not found"))).toBe(true);
  });

  it("returns error for edge referencing nonexistent target node", () => {
    const graph = {
      ...VALID_GRAPH,
      edges: [
        ...VALID_GRAPH.edges,
        { id: "bad", from: "vp1", fromHandle: "video", to: "nonexistent", toHandle: "video" },
      ],
    };
    const errors = validateGraphStructure(graph);
    expect(errors.some((e) => e.includes("target node \"nonexistent\" not found"))).toBe(true);
  });

  it("returns error for invalid output handle", () => {
    const graph = {
      ...VALID_GRAPH,
      edges: [
        ...VALID_GRAPH.edges,
        { id: "bad", from: "vp1", fromHandle: "audio", to: "loop1", toHandle: "videos" },
      ],
    };
    const errors = validateGraphStructure(graph);
    expect(errors.some((e) => e.includes('invalid output handle "audio" for VideoPool'))).toBe(true);
  });

  it("returns error for invalid input handle", () => {
    const graph = {
      ...VALID_GRAPH,
      edges: [
        ...VALID_GRAPH.edges,
        { id: "bad", from: "tts1", fromHandle: "audio", to: "loop1", toHandle: "timestamps" },
      ],
    };
    const errors = validateGraphStructure(graph);
    expect(errors.some((e) => e.includes('invalid input handle "timestamps" for Loop'))).toBe(true);
  });
});

// ── paginationSchema ──

describe("paginationSchema", () => {
  it("defaults to limit=20 offset=0", () => {
    const result = paginationSchema.parse({});
    expect(result.limit).toBe(20);
    expect(result.offset).toBe(0);
  });

  it("coerces string numbers", () => {
    const result = paginationSchema.parse({ limit: "10", offset: "5" });
    expect(result.limit).toBe(10);
    expect(result.offset).toBe(5);
  });

  it("rejects limit > 100", () => {
    const result = paginationSchema.safeParse({ limit: 200 });
    expect(result.success).toBe(false);
  });

  it("rejects negative offset", () => {
    const result = paginationSchema.safeParse({ offset: -1 });
    expect(result.success).toBe(false);
  });
});

// ── creditFilterSchema ──

describe("creditFilterSchema", () => {
  it("accepts valid reason", () => {
    const result = creditFilterSchema.safeParse({ reason: "render" });
    expect(result.success).toBe(true);
  });

  it("rejects unknown reason", () => {
    const result = creditFilterSchema.safeParse({ reason: "unknown" });
    expect(result.success).toBe(false);
  });

  it("accepts valid date strings", () => {
    const result = creditFilterSchema.safeParse({ from: "2025-01-01", to: "2025-12-31" });
    expect(result.success).toBe(true);
  });

  it("rejects invalid date format", () => {
    const result = creditFilterSchema.safeParse({ from: "not-a-date" });
    expect(result.success).toBe(false);
  });
});

// ── uploadAssetSchema ──

describe("uploadAssetSchema", () => {
  it("accepts valid input", () => {
    expect(uploadAssetSchema.safeParse({ name: "file.mp4", type: "video" }).success).toBe(true);
  });

  it("rejects empty name", () => {
    expect(uploadAssetSchema.safeParse({ name: "", type: "video" }).success).toBe(false);
  });

  it("rejects invalid type", () => {
    expect(uploadAssetSchema.safeParse({ name: "file", type: "binary" }).success).toBe(false);
  });

  it("accepts image type", () => {
    expect(uploadAssetSchema.safeParse({ name: "photo.png", type: "image" }).success).toBe(true);
  });
});
