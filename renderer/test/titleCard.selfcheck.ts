/**
 * Auto-checagem do extractTitleCard (job-scheduler): título explícito e
 * duração mínima do card. Não é bun:test — segue o padrão de test/e2e.ts
 * (script rodável direto, sem framework).
 *
 * Run: bun run test/titleCard.selfcheck.ts
 */
import assert from "assert";
import { extractTitleCard, resolveCardConfig } from "../src/compile/titleCard";
import type { Graph, WordTimestamp } from "../src/graph";
import { coverCrop, renderTitleCard } from "../src/ffmpeg/filters/titleCard";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import { mkdtemp, writeFile, rm } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";

function graphWithCard(config: Record<string, unknown>): Graph {
  return {
    version: 2,
    settings: { width: 1080, height: 1920, fps: 30 },
    nodes: [{ id: "card", kind: "action", type: "ShowTitleCard", config } as never],
    edges: [],
  };
}

const shortWords: WordTimestamp[] = [
  { word: "Parte", startMs: 0, endMs: 200 },
  { word: "2.", startMs: 200, endMs: 400 },
  { word: "resto", startMs: 400, endMs: 800 },
];

// 1. Sem título explícito: deriva da primeira frase da narração (comportamento original).
{
  const words: WordTimestamp[] = [
    { word: "Eu", startMs: 0, endMs: 100 },
    { word: "sou", startMs: 100, endMs: 300 },
    { word: "o", startMs: 300, endMs: 350 },
    { word: "babaca?", startMs: 350, endMs: 900 },
  ];
  const plan = extractTitleCard(graphWithCard({}), words);
  assert(plan, "plan deveria existir");
  assert.strictEqual(plan.title, "Eu sou o babaca?");
  assert.strictEqual(plan.wordCount, 4);
}

// 2. Título explícito (scheduler) substitui o derivado da narração.
{
  const plan = extractTitleCard(graphWithCard({ title: "Um título — Parte 2" }), shortWords);
  assert(plan, "plan deveria existir");
  assert.strictEqual(plan.title, "Um título — Parte 2");
}

// 3. minDurationMs garante um piso, mesmo quando a fala é curtíssima ("Parte 2.").
{
  const plan = extractTitleCard(graphWithCard({ title: "T — Parte 2", minDurationMs: 2500 }), shortWords);
  assert(plan, "plan deveria existir");
  const durationSeconds = plan.endSeconds - plan.startSeconds;
  assert(durationSeconds >= 2.5, `duração deveria ser >= 2.5s, veio ${durationSeconds}`);
}

// 4. Sem minDurationMs, o card não fica maior que o necessário (usa o default de 1.5s como piso).
{
  const plan = extractTitleCard(graphWithCard({ title: "T — Parte 2" }), shortWords);
  assert(plan, "plan deveria existir");
  const durationSeconds = plan.endSeconds - plan.startSeconds;
  assert(durationSeconds >= 1.5, `duração deveria respeitar o piso default de 1.5s, veio ${durationSeconds}`);
}



// 5. Campos automáticos: só preenchem o que está vazio; valor existente (fixo ou da IA) nunca é trocado.
{
  const fixed = { subreddit: "r/slayer", username: "u/fulano", flair: "Família", timeAgo: "há 5h", upvotes: "18.4k", comments: "1.2k" };
  assert.deepStrictEqual(resolveCardConfig(fixed), fixed, "sem auto, nada muda");

  const all = resolveCardConfig({ auto: ["subreddit", "username", "timeAgo", "flair", "upvotes", "comments"] }, () => 0);
  assert.strictEqual(all.subreddit, "r/relatos");
  assert.strictEqual(all.username, "u/marcos_silva_10");
  assert.strictEqual(all.timeAgo, "há 2h");
  assert.strictEqual(all.flair, "RELATO");
  assert.strictEqual(all.upvotes, "2k");
  assert.strictEqual(all.comments, "80");

  const pinned = resolveCardConfig({ auto: ["subreddit", "upvotes"], subreddit: "r/slayer" }, () => 0.5);
  assert.strictEqual(pinned.subreddit, "r/slayer", "valor preenchido vence o auto (é o caso do scheduler)");
  assert.strictEqual(pinned.upvotes, "17k", "o vazio com auto é sorteado");
  assert.strictEqual(pinned.username, undefined, "campo fora do auto continua como estava");

  const a = resolveCardConfig({ auto: ["upvotes"] });
  const seen = new Set(Array.from({ length: 30 }, () => resolveCardConfig({ auto: ["upvotes"] }).upvotes));
  assert(seen.size > 1, `deveria variar entre renders, veio ${[...seen]}`);
  assert.match(a.upvotes!, /^\d+(\.\d)?k$/);

  // e o plano do card usa a config já resolvida
  const plan = extractTitleCard(graphWithCard({ title: "T", auto: ["subreddit"] }), shortWords);
  assert(plan?.config.subreddit?.startsWith("r/"), "plan.config deveria vir resolvida");
}


// 6. Avatar: o recorte é o quadrado central; imagem larga vira círculo sem distorcer.
assert.deepStrictEqual(coverCrop(300, 100), { sx: 100, sy: 0, size: 100 });
assert.deepStrictEqual(coverCrop(100, 300), { sx: 0, sy: 100, size: 100 });
assert.deepStrictEqual(coverCrop(80, 80), { sx: 0, sy: 0, size: 80 });

{
  const dir = await mkdtemp(join(tmpdir(), "card-avatar-"));
  try {
    // 300x100: terço esquerdo vermelho, do meio verde, direito azul. O recorte central (100x100) é só o verde.
    const src = createCanvas(300, 100);
    const sctx = src.getContext("2d");
    sctx.fillStyle = "#ff0000"; sctx.fillRect(0, 0, 100, 100);
    sctx.fillStyle = "#00ff00"; sctx.fillRect(100, 0, 100, 100);
    sctx.fillStyle = "#0000ff"; sctx.fillRect(200, 0, 100, 100);
    const avatarFile = join(dir, "avatar.png");
    await writeFile(avatarFile, src.toBuffer("image/png"));

    const pixelAtAvatarCenter = async (avatarPath?: string) => {
      const plan = extractTitleCard(graphWithCard({ subreddit: "r/teste", title: "Um título" }), shortWords)!;
      const out = await renderTitleCard({ ...plan, avatarPath }, dir, 1080, 1920);
      const img = await loadImage(out.path);
      const c = createCanvas(img.width, img.height);
      const cctx = c.getContext("2d");
      cctx.drawImage(img, 0, 0);
      // avatar: PAD(40) + AVATAR(68)/2 = 74 nos dois eixos (largura 1080 => escala 1); 8px acima da letra pra não pegar o texto
      return [...cctx.getImageData(74, 74 - 24, 1, 1).data];
    };

    const [r, g, b] = await pixelAtAvatarCenter(avatarFile);
    assert(g > 200 && r < 60 && b < 60, `avatar deveria ser o recorte verde, veio rgb(${r},${g},${b})`);

    const [r2, g2, b2] = await pixelAtAvatarCenter(join(dir, "nao-existe.png"));
    assert(r2 > 200 && g2 < 120 && b2 < 40, `sem imagem válida deveria ser o círculo laranja da letra, veio rgb(${r2},${g2},${b2})`);

    await writeFile(join(dir, "lixo.png"), "isso nao e uma imagem");
    const [r3] = await pixelAtAvatarCenter(join(dir, "lixo.png"));
    assert(r3 > 200, "arquivo inválido também cai na letra, sem derrubar o render");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}


console.log("titleCard.selfcheck: ok");
