/**
 * Auto-checagem da marca d'água do vídeo (etapa ShowWatermark): plano, tamanho/posição/opacidade e o ffmpeg de
 * verdade conferindo o PRIMEIRO e o ÚLTIMO frame. Script rodável direto, sem framework.
 *
 * Run: bun run test/watermark.selfcheck.ts
 */
import assert from "assert";
import { spawnSync } from "child_process";
import { mkdtemp, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import { extractWatermark } from "../src/compile/watermark";
import { fitContain, renderWatermark } from "../src/ffmpeg/filters/watermark";
import { buildOverlayFilterChain } from "../src/ffmpeg/filters/overlay";
import type { Graph } from "../src/graph";

const graphWith = (config?: Record<string, unknown>): Graph => ({
  version: 2,
  settings: { width: 1080, height: 1920, fps: 30 },
  nodes: config ? [{ id: "wm", kind: "action", type: "ShowWatermark", config } as never] : [],
  edges: [],
});

// 1. Plano: sem etapa, sem imagem ou sem arquivo = sem marca; defaults e limites.
assert.strictEqual(extractWatermark(graphWith(), "/x.png"), undefined, "sem etapa");
assert.strictEqual(extractWatermark(graphWith({}), "/x.png"), undefined, "etapa sem imagem escolhida");
assert.strictEqual(extractWatermark(graphWith({ assetId: "a" }), undefined), undefined, "asset escolhido mas arquivo não baixou");
assert.deepStrictEqual(extractWatermark(graphWith({ assetId: "a" }), "/x.png"), { localPath: "/x.png", widthPercent: 14, opacity: 1, marginPercent: 4 });
assert.deepStrictEqual(
  extractWatermark(graphWith({ assetId: "a", widthPercent: 900, opacity: 0, marginPercent: -5 }), "/x.png"),
  { localPath: "/x.png", widthPercent: 50, opacity: 0.1, marginPercent: 0 },
  "valores absurdos são limitados",
);

// 2. Proporção: nunca estica nem corta.
assert.deepStrictEqual(fitContain(300, 100, 150, 400), { width: 150, height: 50 });
assert.deepStrictEqual(fitContain(100, 400, 150, 100), { width: 25, height: 100 });

const dir = await mkdtemp(join(tmpdir(), "watermark-"));
const ffmpeg = (args: string[]) => {
  const r = spawnSync("ffmpeg", ["-v", "error", "-y", ...args], { encoding: "utf8" });
  assert.strictEqual(r.status, 0, `ffmpeg falhou: ${r.stderr}`);
};
const rgbAt = (video: string, seek: string[], x: number, y: number) => {
  const r = spawnSync("ffmpeg", ["-v", "error", ...seek, "-i", video, "-frames:v", "1", "-vf", `format=rgb24,crop=1:1:${x}:${y}`, "-f", "rawvideo", "-pix_fmt", "rgb24", "-"]);
  assert.strictEqual(r.status, 0, `ffmpeg falhou lendo frame: ${r.stderr}`);
  return [...r.stdout.subarray(0, 3)];
};

try {
  // Logo largo (3:1), magenta sólido
  const logo = createCanvas(300, 100);
  const lctx = logo.getContext("2d");
  lctx.fillStyle = "#ff00ff";
  lctx.fillRect(0, 0, 300, 100);
  const logoFile = join(dir, "logo.png");
  await writeFile(logoFile, logo.toBuffer("image/png"));

  // 3. Tamanho, posição e opacidade (vídeo 1080x1920; 14% = 151px de largura, 3:1 => 50px; margem 4% = 43px)
  const half = await renderWatermark({ localPath: logoFile, widthPercent: 14, opacity: 0.5, marginPercent: 4 }, dir, 1080, 1920);
  assert(half, "deveria renderizar");
  const img = await loadImage(half.path);
  assert.deepStrictEqual([img.width, img.height], [151, 50]);
  assert.deepStrictEqual([half.x, half.y], [1080 - 151 - 43, 1920 - 50 - 43], "canto inferior direito, com margem");
  const probe = createCanvas(img.width, img.height).getContext("2d");
  probe.drawImage(img, 0, 0);
  const alpha = probe.getImageData(10, 10, 1, 1).data[3]!;
  assert(Math.abs(alpha - 128) <= 2, `opacidade 0.5 => alpha ~128, veio ${alpha}`);

  await writeFile(join(dir, "lixo.png"), "nao e imagem");
  assert.strictEqual(await renderWatermark({ localPath: join(dir, "lixo.png"), widthPercent: 14, opacity: 1, marginPercent: 4 }, dir, 1080, 1920), undefined, "imagem inválida = sem marca");

  // 4. ffmpeg de verdade: marca presente no PRIMEIRO e no ÚLTIMO frame (vídeo de 3s, fundo preto)
  const base = join(dir, "base.mp4");
  ffmpeg(["-f", "lavfi", "-i", "color=c=black:s=1080x1920:d=3:r=30", "-pix_fmt", "yuv420p", base]);
  const mark = await renderWatermark({ localPath: logoFile, widthPercent: 14, opacity: 1, marginPercent: 4 }, dir, 1080, 1920);
  assert(mark);
  const cx = mark.x + 75, cy = mark.y + 25; // centro da marca

  const run = (name: string, card: Parameters<typeof buildOverlayFilterChain>[2], subtitle?: string) => {
    const { inputArgs, filterComplex, finalLabel } = buildOverlayFilterChain([], subtitle, card, mark);
    const out = join(dir, name);
    ffmpeg(["-i", base, ...inputArgs, "-filter_complex", filterComplex, "-map", `[${finalLabel}]`, "-c:v", "libx264", "-pix_fmt", "yuv420p", "-an", out]);
    return out;
  };
  const checkFrames = (video: string, label: string) => {
    for (const [name, seek] of [["primeiro", []], ["último", ["-sseof", "-0.1"]]] as const) {
      const [r, g, b] = rgbAt(video, [...seek], cx, cy);
      assert(r > 200 && g < 60 && b > 200, `${label}: marca deveria estar no frame ${name}, veio rgb(${r},${g},${b})`);
      const [r2, g2, b2] = rgbAt(video, [...seek], 100, 100);
      assert(r2 < 40 && g2 < 40 && b2 < 40, `${label}: fora da marca continua preto no frame ${name}`);
    }
  };

  checkFrames(run("so-marca.mp4", undefined), "só a marca");

  // junto com card (PNG qualquer, só no começo) e legenda: confere se os rótulos/índices do filtro continuam certos
  const cardPng = createCanvas(200, 80);
  cardPng.getContext("2d").fillStyle = "#00ff00";
  cardPng.getContext("2d").fillRect(0, 0, 200, 80);
  const cardFile = join(dir, "card.png");
  await writeFile(cardFile, cardPng.toBuffer("image/png"));
  const card = { path: cardFile, x: 50, y: 300, startSeconds: 0, endSeconds: 1 };
  checkFrames(run("marca-card.mp4", card), "marca + card");
  checkFrames(run("marca-card-legenda.mp4", card, "drawbox=x=0:y=0:w=10:h=10:color=white:t=fill"), "marca + card + legenda");
  const [cr, cg, cb] = rgbAt(join(dir, "marca-card.mp4"), [], 100, 340);
  assert(cg > 200 && cr < 60 && cb < 60, "o card continua aparecendo no começo");
  const [lr, lg, lb] = rgbAt(join(dir, "marca-card.mp4"), ["-sseof", "-0.1"], 100, 340);
  assert(lr < 40 && lg < 40 && lb < 40, "e some depois do tempo dele (só a marca fica o vídeo todo)");
} finally {
  await rm(dir, { recursive: true, force: true });
}

console.log("watermark.selfcheck: ok");
