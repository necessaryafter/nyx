// Regressão do bug: pool de vídeos com resolução/fps diferentes travava/corrompia
// a troca de um clipe pro outro (concat com -c:v copy exige streams idênticos).
// Reproduz o cenário real (2 fontes com resolução E fps diferentes) e confirma que
// normalizar (scale+fps) antes do concat produz um arquivo íntegro, sem DTS quebrado.
import { spawn } from "child_process";
import { mkdtemp, rm, writeFile } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { probeDuration } from "../src/ffmpeg/probe";
import { buildScaleFilter, planPoolSegments } from "../src/ffmpeg/builder";
import { run } from "../src/ffmpeg/runner";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`  ok: ${msg}`);
}

function ffmpegCollectStderr(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn("ffmpeg", args, { stdio: ["ignore", "ignore", "pipe"] });
    const chunks: Buffer[] = [];
    proc.stderr.on("data", (c) => chunks.push(c));
    proc.on("close", (code) => {
      const out = Buffer.concat(chunks).toString();
      code === 0 ? resolve(out) : reject(new Error(out.slice(-1000)));
    });
  });
}

function checkPlanner() {
  // 4 vídeos de 30s, áudio de 200s: aleatório usa os 4 antes de repetir qualquer um.
  const segs = planPoolSegments([30, 30, 30, 30], 200, "random-loop");
  const total = segs.reduce((s, x) => s + x.seconds, 0);
  assert(Math.abs(total - 200) < 0.01, `segmentos cobrem exatamente o áudio (veio ${total}s)`);
  assert(segs.at(-1)!.seconds === 20, "último segmento é cortado no que falta (20s)");
  for (let i = 0; i + 4 <= segs.length; i += 4) {
    assert(new Set(segs.slice(i, i + 4).map((s) => s.index)).size === 4, `volta ${i / 4 + 1}: usa os 4 vídeos sem repetir`);
  }
  assert(segs.every((s, i) => i === 0 || s.index !== segs[i - 1]!.index), "nunca o mesmo vídeo duas vezes seguidas");

  // Vídeo maior que o áudio: só 1 segmento, cortado.
  const one = planPoolSegments([500, 500], 200, "random-loop");
  assert(one.length === 1 && one[0]!.seconds === 200, "vídeo longo: um só segmento de 200s, sem puxar outro");

  // Sequencial mantém a ordem.
  assert(planPoolSegments([10, 10, 10], 25, "sequential").map((s) => s.index).join() === "0,1,2", "sequencial segue a ordem");

  // Com transição de 1s, cada troca come 1s: soma - overlaps = alvo.
  const tr = planPoolSegments([30, 30], 100, "sequential", 1);
  const eff = tr.reduce((s, x) => s + x.seconds, 0) - (tr.length - 1);
  assert(Math.abs(eff - 100) < 0.01, `com transição, duração efetiva bate com o áudio (veio ${eff}s)`);
}

async function main() {
  checkPlanner();
  const workDir = await mkdtemp(join(tmpdir(), "pool-track-check-"));
  try {
    const a = join(workDir, "a.mp4"); // 640x480 @30fps
    const b = join(workDir, "b.mp4"); // 1280x720 @25fps — resolução E fps diferentes de a
    await run(["-y", "-f", "lavfi", "-i", "color=red:s=640x480:d=2:r=30", "-c:v", "libx264", "-pix_fmt", "yuv420p", a]);
    await run(["-y", "-f", "lavfi", "-i", "color=blue:s=1280x720:d=2:r=25", "-c:v", "libx264", "-pix_fmt", "yuv420p", b]);

    // Mesmo comando que buildPoolTrack usa hoje: normaliza pra 1080x1920@30 antes do concat.
    const normalized = await Promise.all(
      [a, b].map(async (src, i) => {
        const out = join(workDir, `norm-${i}.mp4`);
        await run([
          "-y", "-i", src,
          "-vf", `${buildScaleFilter("cover", 1080, 1920)},fps=30`,
          "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "ultrafast", "-an",
          out,
        ]);
        return out;
      }),
    );

    const concatFile = join(workDir, "concat.txt");
    await writeFile(concatFile, normalized.map((p) => `file '${p}'`).join("\n"));
    const result = join(workDir, "result.mp4");
    const stderr = await ffmpegCollectStderr(["-y", "-f", "concat", "-safe", "0", "-i", concatFile, "-c:v", "copy", "-an", result]);

    assert(!stderr.includes("Non-monotonic DTS"), "concat não gera DTS quebrado (sem 'Non-monotonic DTS')");
    const duration = await probeDuration(result);
    assert(Math.abs(duration - 4) < 0.05, `duração final é a soma dos dois clipes (esperado ~4s, veio ${duration.toFixed(2)}s)`);

    console.log("\npool-track.selfcheck: PASS");
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
