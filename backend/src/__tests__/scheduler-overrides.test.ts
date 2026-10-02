import { describe, it, expect } from "bun:test";
import { graphSchema, validateGraphStructure } from "../lib/schemas";
import { applySchedulerOverrides, planPartAssetIds, randomEngagement, resolveSchedulerVoice, type SchedulerCardContext } from "../lib/scheduler/overrides";
import { estimateRun } from "../lib/scheduler/estimate";
import type { GraphInput } from "../lib/schemas";

const SAMPLE_CARD: SchedulerCardContext = {
  subreddit: "r/relatos",
  username: "u/anonimo123",
  flair: "RELATO",
  upvotes: "14.2k",
  comments: "892",
  timeAgo: "há 5h",
};

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
      { id: "bg", kind: "source", type: "AssetSource", config: { assetIds: [UUID_BG], assetType: "video", mode: "random-loop" } },
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
      assetMode: "random-loop",
      musicAssetIds: [],
      backgroundSpeed: 1,
      title: "Um título",
      partIndex: 1,
      partsTotal: 1,
      card: SAMPLE_CARD,
    });
    const bg = out.nodes.find((n) => n.id === "bg");
    expect(bg?.type).toBe("AssetSource");
    expect(bg?.type === "AssetSource" && bg.config.assetIds).toEqual([UUID_NEW_BG]);
  });

  it("carries assetMode onto the AssetSource node config", () => {
    const out = applySchedulerOverrides(baseGraph(), {
      assetIds: [UUID_NEW_BG],
      assetMode: "sequential",
      musicAssetIds: [],
      backgroundSpeed: 1,
      title: "T",
      partIndex: 1,
      partsTotal: 1,
      card: SAMPLE_CARD,
    });
    const bg = out.nodes.find((n) => n.id === "bg");
    expect(bg?.type === "AssetSource" && bg.config.mode).toBe("sequential");
  });

  it("keeps the template's assets when assetIds is empty", () => {
    const out = applySchedulerOverrides(baseGraph(), {
      assetIds: [],
      assetMode: "random-loop",
      musicAssetIds: [],
      backgroundSpeed: 1,
      title: "T",
      partIndex: 1,
      partsTotal: 1,
      card: SAMPLE_CARD,
    });
    const bg = out.nodes.find((n) => n.id === "bg");
    expect(bg?.type === "AssetSource" && bg.config.assetIds).toEqual([UUID_BG]);
  });

  it("carries backgroundSpeed onto the AssetSource node even when assetIds is empty", () => {
    const out = applySchedulerOverrides(baseGraph(), {
      assetIds: [],
      assetMode: "random-loop",
      musicAssetIds: [],
      backgroundSpeed: 1.5,
      title: "T",
      partIndex: 1,
      partsTotal: 1,
      card: SAMPLE_CARD,
    });
    const bg = out.nodes.find((n) => n.id === "bg");
    expect(bg?.type === "AssetSource" && bg.config.speed).toBe(1.5);
    // mantém os assets do template — só a velocidade é sobreposta
    expect(bg?.type === "AssetSource" && bg.config.assetIds).toEqual([UUID_BG]);
  });

  it("replaces MusicSource assets independently of the background", () => {
    const out = applySchedulerOverrides(baseGraph(), {
      assetIds: [],
      assetMode: "random-loop",
      musicAssetIds: [UUID_NEW_MUSIC],
      backgroundSpeed: 1,
      title: "T",
      partIndex: 1,
      partsTotal: 1,
      card: SAMPLE_CARD,
    });
    const music = out.nodes.find((n) => n.id === "music");
    expect(music?.type === "MusicSource" && music.config.assetIds).toEqual([UUID_NEW_MUSIC]);
  });

  it("part 1 of a multi-part series also gets '— Parte 1' on the card, like the other parts", () => {
    const out = applySchedulerOverrides(baseGraph(), {
      assetIds: [],
      assetMode: "random-loop",
      musicAssetIds: [],
      backgroundSpeed: 1,
      title: "Um título",
      partIndex: 1,
      partsTotal: 3,
      card: SAMPLE_CARD,
    });
    const card = out.nodes.find((n) => n.id === "card");
    expect(card?.type === "ShowTitleCard" && card.config.title).toBe("Um título — Parte 1");
  });

  it("part 3 of a multi-part series appends '— Parte 3' to the card title", () => {
    const out = applySchedulerOverrides(baseGraph(), {
      assetIds: [],
      assetMode: "random-loop",
      musicAssetIds: [],
      backgroundSpeed: 1,
      title: "Um título",
      partIndex: 3,
      partsTotal: 3,
      card: SAMPLE_CARD,
    });
    const card = out.nodes.find((n) => n.id === "card");
    expect(card?.type === "ShowTitleCard" && card.config.title).toBe("Um título — Parte 3");
    expect(card?.type === "ShowTitleCard" && card.config.minDurationMs).toBe(2500);
  });

  it("a single-part run (N=1) never appends '— Parte N'", () => {
    const out = applySchedulerOverrides(baseGraph(), {
      assetIds: [],
      assetMode: "random-loop",
      musicAssetIds: [],
      backgroundSpeed: 1,
      title: "Um título",
      partIndex: 1,
      partsTotal: 1,
      card: SAMPLE_CARD,
    });
    const card = out.nodes.find((n) => n.id === "card");
    expect(card?.type === "ShowTitleCard" && card.config.title).toBe("Um título");
  });

  it("applies the run's card identity (subreddit/username/flair/votes) onto the title card", () => {
    const out = applySchedulerOverrides(baseGraph(), {
      assetIds: [],
      assetMode: "random-loop",
      musicAssetIds: [],
      backgroundSpeed: 1,
      title: "T",
      partIndex: 1,
      partsTotal: 1,
      card: SAMPLE_CARD,
    });
    const card = out.nodes.find((n) => n.id === "card");
    expect(card?.type === "ShowTitleCard" && card.config).toMatchObject(SAMPLE_CARD);
  });

  it("overrides whatever card identity was baked into the template (dynamic per run, not frozen)", () => {
    const graph = baseGraph();
    // O template já vem com uma identidade "de fábrica" — a execução tem que substituir, não somar.
    const withTemplateCard: GraphInput = {
      ...graph,
      nodes: graph.nodes.map((n) =>
        n.id === "card" ? { ...n, config: { subreddit: "r/velho", username: "u/velho", flair: "VELHO" } } : n,
      ) as GraphInput["nodes"],
    };
    const out = applySchedulerOverrides(withTemplateCard, {
      assetIds: [],
      assetMode: "random-loop",
      musicAssetIds: [],
      backgroundSpeed: 1,
      title: "T",
      partIndex: 1,
      partsTotal: 1,
      card: SAMPLE_CARD,
    });
    const card = out.nodes.find((n) => n.id === "card");
    expect(card?.type === "ShowTitleCard" && card.config.subreddit).toBe(SAMPLE_CARD.subreddit);
  });

  it("does not touch nodes it has no rule for", () => {
    const graph = baseGraph();
    const out = applySchedulerOverrides(graph, {
      assetIds: [],
      assetMode: "random-loop",
      musicAssetIds: [],
      backgroundSpeed: 1,
      title: "T",
      partIndex: 1,
      partsTotal: 1,
      card: SAMPLE_CARD,
    });
    const subtitle = out.nodes.find((n) => n.id === "subtitle");
    expect(subtitle).toEqual(graph.nodes.find((n) => n.id === "subtitle"));
  });
});

describe("planPartAssetIds", () => {
  const A = "a0000000-0000-4000-8000-000000000001";
  const B = "b0000000-0000-4000-8000-000000000001";
  const C = "c0000000-0000-4000-8000-000000000001";
  const names = new Map([[A, "banana.mp4"], [B, "abacaxi.mp4"], [C, "cereja.mp4"]]);

  it("gives every part the full pool when noRepeatAcrossParts is false", () => {
    const plan = planPartAssetIds([A, B, C], 3, { randomize: true, noRepeatAcrossParts: false });
    expect(plan).toEqual([[A, B, C], [A, B, C], [A, B, C]]);
  });

  it("noRepeat: cada parte recebe a lista inteira, começando num bloco diferente", () => {
    const ids = ["a", "b", "c", "d", "e", "f"];
    const plan = planPartAssetIds(ids, 3, { randomize: false, noRepeatAcrossParts: true, nameById: new Map(ids.map((x) => [x, x])) });
    expect(plan).toEqual([
      ["a", "b", "c", "d", "e", "f"],
      ["c", "d", "e", "f", "a", "b"],
      ["e", "f", "a", "b", "c", "d"],
    ]);
  });

  it("noRepeat + aleatório: cada parte tem todos os vídeos, sem repetir dentro dela, e começos diferentes", () => {
    const ids = Array.from({ length: 20 }, (_, i) => `v${i}`);
    const plan = planPartAssetIds(ids, 5, { randomize: true, noRepeatAcrossParts: true });
    for (const part of plan) expect(new Set(part).size).toBe(20);
    expect(new Set(plan.map((p) => p.slice(0, 4).join())).size).toBe(5); // blocos iniciais distintos
    expect(new Set(plan.flatMap((p) => p.slice(0, 4))).size).toBe(20); // e sem sobreposição entre eles
  });

  it("sorts by asset name when randomize is false", () => {
    const plan = planPartAssetIds([A, B, C], 1, { randomize: false, noRepeatAcrossParts: false, nameById: names });
    expect(plan).toEqual([[B, A, C]]); // abacaxi, banana, cereja
  });

  it("returns empty arrays for every part when the pool is empty", () => {
    const plan = planPartAssetIds([], 3, { randomize: true, noRepeatAcrossParts: true });
    expect(plan).toEqual([[], [], []]);
  });
});

describe("randomEngagement", () => {
  it("returns well-formed upvotes/comments/timeAgo, different across calls", () => {
    const results = Array.from({ length: 20 }, () => randomEngagement());
    for (const r of results) {
      expect(r.upvotes).toMatch(/^\d+(\.\d)?k$/);
      expect(r.comments).toMatch(/^\d+$/);
      expect(typeof r.timeAgo).toBe("string");
      expect(r.timeAgo.length).toBeGreaterThan(0);
    }
    // 20 sorteios independentes não deveriam bater todos no mesmo valor.
    const uniqueUpvotes = new Set(results.map((r) => r.upvotes));
    expect(uniqueUpvotes.size).toBeGreaterThan(1);
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

describe("resolveSchedulerVoice", () => {
  const template = { mode: "job-input" as const, provider: "edge" as const, voice: "pt-BR-AntonioNeural", speed: 1.4 };

  it("sem voz no scheduler usa a do template", () => {
    expect(resolveSchedulerVoice(template, null)).toMatchObject({ provider: "edge", voice: "pt-BR-AntonioNeural", speed: 1.4 });
  });

  it("voz do scheduler substitui a do template inteira (não mistura voz do edge no gemini)", () => {
    const v = resolveSchedulerVoice(template, { provider: "gemini", voice: "Algenib", model: "gemini-3.8-flash-lite-tts", stylePreset: "lento" });
    expect(v).toEqual({ provider: "gemini", voice: "Algenib", speed: undefined, model: "gemini-3.8-flash-lite-tts", paceMode: undefined, stylePreset: "lento", style: undefined });
  });

  it("provider que não é edge/gemini continua virando talkify, como antes", () => {
    expect(resolveSchedulerVoice({ mode: "job-input", provider: "custom" }, undefined).provider).toBe("talkify");
    expect(resolveSchedulerVoice(undefined, undefined).provider).toBe("talkify");
  });
});

describe("card com campos automáticos (auto)", () => {
  const withAuto = (config: Record<string, unknown>) => {
    const g = baseGraph();
    return { ...g, nodes: g.nodes.map((n) => (n.id === "card" ? { ...n, config } : n)) };
  };

  it("o grafo guarda o auto ao salvar (não é descartado pela validação)", () => {
    const parsed = graphSchema.safeParse(withAuto({ auto: ["upvotes", "comments"], subreddit: "r/slayer" }));
    expect(parsed.success).toBe(true);
    const card = parsed.success ? parsed.data.nodes.find((n) => n.id === "card") : undefined;
    expect(card?.type === "ShowTitleCard" && card.config).toEqual({ auto: ["upvotes", "comments"], subreddit: "r/slayer" });
  });

  it("recusa campo desconhecido em auto", () => {
    expect(graphSchema.safeParse(withAuto({ auto: ["foo"] })).success).toBe(false);
  });

  it("no scheduler os valores da IA/sorteio preenchem todos os campos, mesmo com auto no template", () => {
    const out = applySchedulerOverrides(withAuto({ auto: ["subreddit", "username", "flair", "upvotes", "comments", "timeAgo"] }) as never, {
      assetIds: [],
      assetMode: "random-loop",
      musicAssetIds: [],
      backgroundSpeed: 1,
      title: "T",
      partIndex: 1,
      partsTotal: 1,
      card: SAMPLE_CARD,
    });
    const card = out.nodes.find((n) => n.id === "card");
    const cfg = card?.type === "ShowTitleCard" ? card.config : undefined;
    for (const key of ["subreddit", "username", "flair", "upvotes", "comments", "timeAgo"] as const) {
      expect(cfg?.[key]).toBe(SAMPLE_CARD[key]); // preenchido => o renderer não sorteia por cima
    }
  });
});

describe("validateGraphStructure: nó de vídeo sem assets", () => {
  const noAssets = () => {
    const g = baseGraph();
    return { ...g, nodes: g.nodes.map((n) => (n.id === "bg" && n.type === "AssetSource" ? { ...n, config: { ...n.config, assetIds: [] } } : n)) } as GraphInput;
  };

  it("criar o vídeo exige assets (padrão)", () => {
    expect(validateGraphStructure(noAssets()).some((e) => e.includes("no assets assigned"))).toBe(true);
  });

  it("salvar o template aceita sem assets (o scheduler fornece os vídeos)", () => {
    expect(validateGraphStructure(noAssets(), { requireAssets: false })).toEqual([]);
  });
});

describe("identidade do cartão: campo fixo do template x automático", () => {
  const run = (config: Record<string, unknown>) => {
    const g = baseGraph();
    const graph = { ...g, nodes: g.nodes.map((n) => (n.id === "card" ? { ...n, config } : n)) } as GraphInput;
    const out = applySchedulerOverrides(graph, {
      assetIds: [], assetMode: "random-loop", musicAssetIds: [], backgroundSpeed: 1,
      title: "T", partIndex: 1, partsTotal: 1, card: SAMPLE_CARD,
    });
    const card = out.nodes.find((n) => n.id === "card");
    return card?.type === "ShowTitleCard" ? card.config : undefined;
  };

  it("template com auto: o campo fixo vale, os automáticos vêm da IA/sorteio", () => {
    const cfg = run({ auto: ["subreddit", "flair", "upvotes", "comments", "timeAgo"], username: "reddit-slayer" });
    expect(cfg?.username).toBe("reddit-slayer");
    expect(cfg?.subreddit).toBe(SAMPLE_CARD.subreddit);
    expect(cfg?.flair).toBe(SAMPLE_CARD.flair);
    expect(cfg?.upvotes).toBe(SAMPLE_CARD.upvotes);
  });

  it("template com auto: campo vazio e fora do auto também recebe o valor do scheduler", () => {
    expect(run({ auto: [], username: "" })?.username).toBe(SAMPLE_CARD.username);
  });

  it("template antigo (sem auto): o scheduler substitui tudo, como sempre", () => {
    const cfg = run({ username: "reddit-slayer", subreddit: "r/slayer" });
    expect(cfg?.username).toBe(SAMPLE_CARD.username);
    expect(cfg?.subreddit).toBe(SAMPLE_CARD.subreddit);
  });
});

describe("etapa ShowWatermark (marca d'água do vídeo)", () => {
  const withWatermark = (config: Record<string, unknown>) => {
    const g = baseGraph();
    return { ...g, nodes: [...g.nodes, { id: "wm", kind: "action", type: "ShowWatermark", config }] };
  };

  it("o grafo aceita a etapa e guarda a configuração", () => {
    const cfg = { assetId: UUID_BG, widthPercent: 12, opacity: 0.8, marginPercent: 6 };
    const parsed = graphSchema.safeParse(withWatermark(cfg));
    expect(parsed.success).toBe(true);
    const wm = parsed.success ? parsed.data.nodes.find((n) => n.id === "wm") : undefined;
    expect(wm?.type === "ShowWatermark" && wm.config).toEqual(cfg);
  });

  it("aceita sem imagem escolhida (assetId null ou ausente)", () => {
    expect(graphSchema.safeParse(withWatermark({ assetId: null })).success).toBe(true);
    expect(graphSchema.safeParse(withWatermark({})).success).toBe(true);
  });

  it("recusa tamanho, opacidade e margem fora dos limites e assetId que não é uuid", () => {
    expect(graphSchema.safeParse(withWatermark({ widthPercent: 90 })).success).toBe(false);
    expect(graphSchema.safeParse(withWatermark({ widthPercent: 1 })).success).toBe(false);
    expect(graphSchema.safeParse(withWatermark({ opacity: 0 })).success).toBe(false);
    expect(graphSchema.safeParse(withWatermark({ marginPercent: 50 })).success).toBe(false);
    expect(graphSchema.safeParse(withWatermark({ assetId: "nao-e-uuid" })).success).toBe(false);
  });

  it("o scheduler não mexe na marca d'água do template", () => {
    const out = applySchedulerOverrides(withWatermark({ assetId: UUID_BG, widthPercent: 12 }) as never, {
      assetIds: [], assetMode: "random-loop", musicAssetIds: [], backgroundSpeed: 1,
      title: "T", partIndex: 1, partsTotal: 1, card: SAMPLE_CARD,
    });
    const wm = out.nodes.find((n) => n.id === "wm");
    expect(wm?.type === "ShowWatermark" && wm.config).toEqual({ assetId: UUID_BG, widthPercent: 12 });
  });
});
