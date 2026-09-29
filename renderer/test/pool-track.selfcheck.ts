// Regressão do bug: pool de vídeos com resolução/fps diferentes travava/corrompia
// a troca de um clipe pro outro (concat com -c:v copy exige streams idênticos).
// Reproduz o cenário real (2 fontes com resolução E fps diferentes) e confirma que
// normalizar (scale+fps) antes do concat produz um arquivo íntegro, sem DTS quebrado.
import { spawn } from "child_process";
import { mkdtemp, rm, writeFile } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { probeDuration } from "../src/ffmpeg/probe";
import { buildScaleFilter } from "../src/ffmpeg/builder";
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

async function main() {
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
