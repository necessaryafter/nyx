/**
 * Gera um vídeo de demonstração (fundo real + card do Reddit + marca d'água) usando o MESMO código do render,
 * pra ver o resultado a olho. Não é um teste automático.
 *
 * Run: bun run test/watermark.demo.ts <fundo.mp4> <saida.mp4> [logo.png|none] [avatar.png]
 *   logo.png omitido = logo de demonstração; "none" = sem marca d'água (como um template sem logo).
 */
import { spawnSync } from "child_process";
import { mkdtemp, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { createCanvas } from "@napi-rs/canvas";
import { extractTitleCard } from "../src/compile/titleCard";
import { extractWatermark } from "../src/compile/watermark";
import { renderTitleCard } from "../src/ffmpeg/filters/titleCard";
import { renderWatermark } from "../src/ffmpeg/filters/watermark";
import { buildOverlayFilterChain } from "../src/ffmpeg/filters/overlay";
import type { Graph } from "../src/graph";

const [background, output, logoArg, avatarArg] = process.argv.slice(2);
if (!background || !output) throw new Error("uso: bun run test/watermark.demo.ts <fundo.mp4> <saida.mp4> [logo.png]");

const dir = await mkdtemp(join(tmpdir(), "wm-demo-"));
try {
  let logo = logoArg;
  if (!logo) {  // sem argumento: logo de demonstração
    // Logo de demonstração: selo amarelo 3:1 (troque pelo seu passando o caminho do PNG)
    const c = createCanvas(300, 100);
    const x = c.getContext("2d");
    x.fillStyle = "#facc15"; x.beginPath(); x.roundRect(0, 0, 300, 100, 24); x.fill();
    x.fillStyle = "#111"; x.font = 'bold 54px "Liberation Sans", Arial, sans-serif'; x.textAlign = "center"; x.textBaseline = "middle"; x.fillText("SLAYER", 150, 54);
    logo = join(dir, "logo.png");
    await writeFile(logo, c.toBuffer("image/png"));
  }

  const graph: Graph = {
    version: 2,
    settings: { width: 1080, height: 1920, fps: 30 },
    edges: [],
    nodes: [
      { id: "card", kind: "action", type: "ShowTitleCard", config: { auto: ["subreddit", "timeAgo", "flair", "upvotes", "comments"], username: "reddit-slayer", title: "A gaveta trancada da minha mesa no escritório guardava o contrato que mudaria tudo.", minDurationMs: 2500 } },
      { id: "wm", kind: "action", type: "ShowWatermark", config: { assetId: logo === "none" ? null : "demo", widthPercent: 14, opacity: 1, marginPercent: 4 } },
    ] as never,
  };

  const cardPlan = extractTitleCard(graph, [{ word: "Primeira.", startMs: 0, endMs: 1200 }])!;
  const card = await renderTitleCard({ ...cardPlan, avatarPath: avatarArg }, dir, 1080, 1920);
  const plan = extractWatermark(graph, logo === "none" ? undefined : logo); // sem logo => sem marca, igual ao render de verdade
  const mark = plan ? await renderWatermark(plan, dir, 1080, 1920) : undefined;
  if (logo !== "none" && !mark) throw new Error("marca d'água não renderizou");

  const { inputArgs, filterComplex, finalLabel } = buildOverlayFilterChain([], undefined, card, mark);
  const scale = "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fps=30";
  const filter = `[0:v]${scale}[v_scaled];` + filterComplex.replaceAll("[0:v]", "[v_scaled]");
  const r = spawnSync("ffmpeg", ["-v", "error", "-y", "-t", "6", "-i", background, ...inputArgs, "-filter_complex", filter, "-map", `[${finalLabel}]`, "-t", "6", "-c:v", "libx264", "-preset", "fast", "-crf", "23", "-pix_fmt", "yuv420p", "-an", output], { encoding: "utf8" });
  if (r.status !== 0) throw new Error(r.stderr);
  console.log("ok:", output);
} finally {
  await rm(dir, { recursive: true, force: true });
}
