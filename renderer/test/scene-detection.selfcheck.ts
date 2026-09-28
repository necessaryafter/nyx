/**
 * Auto-checagem do scene-detection: funções puras (buildSegments,
 * splitFixedInterval) + um teste real de ponta a ponta com um vídeo
 * sintético (3 cores sólidas coladas = 3 cortes abruptos de verdade).
 * Não é bun:test — segue o padrão de test/e2e.ts (script rodável direto).
 *
 * Run: bun run test/scene-detection.selfcheck.ts
 */
import assert from "assert";
import { spawn } from "child_process";
import { mkdtemp, rm } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { buildSegments, splitFixedInterval, detectSegments } from "../src/scene-detection/detect";
import { probeDuration } from "../src/ffmpeg/probe";

function run(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn("ffmpeg", args, { stdio: ["ignore", "ignore", "pipe"] });
    const stderr: Buffer[] = [];
    proc.stderr.on("data", (c) => stderr.push(c));
    proc.on("close", (code) =>
      code === 0 ? resolve() : reject(new Error(`ffmpeg failed: ${Buffer.concat(stderr).toString().slice(-1000)}`)),
    );
  });
}

// 1. buildSegments — pura.
{
  const segments = buildSegments([5000, 5200, 12000], 20000, 1500);
  assert.deepStrictEqual(segments, [
    { index: 1, startMs: 0, endMs: 5000 },
    { index: 2, startMs: 5000, endMs: 12000 },
    { index: 3, startMs: 12000, endMs: 20000 },
  ], "corte a 200ms do anterior deveria ser descartado");
}
{
  const segments = buildSegments([], 10000, 1500);
  assert.deepStrictEqual(segments, [{ index: 1, startMs: 0, endMs: 10000 }], "sem corte = 1 segmento só");
}
{
  // corte perto demais do FIM também é descartado (segmento final ficaria anão)
  const segments = buildSegments([9800], 10000, 1500);
  assert.deepStrictEqual(segments, [{ index: 1, startMs: 0, endMs: 10000 }]);
}

// 2. splitFixedInterval — pura.
{
  const segments = splitFixedInterval(100_000, 45_000);
  assert.strictEqual(segments.length, 3);
  assert.strictEqual(segments[2]!.endMs, 100_000);
}
{
  // resto pequeno demais gruda no penúltimo em vez de virar segmento anão
  const segments = splitFixedInterval(90_300, 45_000, 500);
  assert.strictEqual(segments.length, 2);
  assert.strictEqual(segments[1]!.endMs, 90_300);
}

console.log("funções puras: ok — testando detecção real com vídeo sintético...");

// 3. detectSegments — ponta a ponta, com um vídeo sintético de 3 cortes reais.
const workDir = await mkdtemp(join(tmpdir(), "scene-detect-selfcheck-"));
try {
  const clips = ["red", "blue", "green"];
  for (const [i, color] of clips.entries()) {
    await run(["-y", "-f", "lavfi", "-i", `color=c=${color}:s=320x240:d=2`, join(workDir, `clip${i}.mp4`)]);
  }
  const listFile = join(workDir, "list.txt");
  await Bun.write(listFile, clips.map((_, i) => `file 'clip${i}.mp4'`).join("\n"));
  const merged = join(workDir, "merged.mp4");
  await run(["-y", "-f", "concat", "-safe", "0", "-i", listFile, "-c", "copy", merged]);

  const duration = await probeDuration(merged);
  const segments = await detectSegments(merged, duration * 1000, { minSegmentMs: 500 });

  assert.strictEqual(segments.length, 3, `esperava 3 segmentos (3 cores coladas), veio ${segments.length}`);
  console.log("scene-detection.selfcheck: ok —", segments);
} finally {
  await rm(workDir, { recursive: true, force: true });
}
