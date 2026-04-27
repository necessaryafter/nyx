/**
 * Renderer E2E Test
 *
 * Runs the full render pipeline with synthetic assets (generated via FFmpeg)
 * and a MockTTSProvider. Tests the complete graph:
 * VideoPool → Loop, TTS(mock) → Loop+Subtitle, Loop → Layer,
 * Subtitle → Layer, Layer → Render, TTS → Render, MusicPool → Render
 *
 * Prerequisites:
 *   docker compose up -d
 *   cd backend && bun run drizzle-kit push
 *   FFmpeg installed
 *
 * Run: bun run test/e2e.ts
 */

import { spawn } from "child_process";
import { mkdtemp, rm, stat, readFile } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { randomUUID } from "crypto";
import { createReadStream } from "fs";

import { db } from "../src/database";
import { jobs } from "../src/database/schema";
import { storageClient, BUCKET_ASSETS } from "../src/lib/minio";
import { executeGraph } from "../src/resolver";
import { probeDuration } from "../src/ffmpeg/probe";
import type { Graph } from "../src/graph";
import { eq } from "drizzle-orm";
import postgres from "postgres";

// ── Helpers ──

const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const CYAN = "\x1b[36m";
const DIM = "\x1b[2m";
const RESET = "\x1b[0m";

function log(tag: string, msg: string) {
  console.log(`${DIM}[${tag}]${RESET} ${msg}`);
}

function ok(msg: string) {
  console.log(`${GREEN}  ✓ ${msg}${RESET}`);
}

function fail(msg: string) {
  console.error(`${RED}  ✕ ${msg}${RESET}`);
}

function runFFmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn("ffmpeg", ["-y", ...args], { stdio: ["ignore", "ignore", "pipe"] });
    const stderr: Buffer[] = [];
    proc.stderr.on("data", (chunk) => stderr.push(chunk));
    proc.on("close", (code) =>
      code === 0
        ? resolve()
        : reject(new Error(`ffmpeg exited ${code}: ${Buffer.concat(stderr).toString().slice(0, 200)}`)),
    );
  });
}

// ── Main ──

const rawSql = postgres(process.env.DATABASE_URL!);

async function main() {
  const tmpDir = await mkdtemp(join(tmpdir(), "renderer-e2e-"));
  const assetIds: string[] = [];
  let jobId: string | undefined;
  let templateId: string | undefined;
  let passed = true;

  try {
    // ── 1. Generate test assets ──
    log("setup", "Generating test assets via FFmpeg...");

    const video1 = join(tmpDir, "video1.mp4");
    const video2 = join(tmpDir, "video2.mp4");
    const music1 = join(tmpDir, "music1.mp3");

    // 3s blue video (320x240, 15fps for speed)
    await runFFmpeg([
      "-f", "lavfi", "-i", `color=c=blue:size=320x240:rate=15:d=3`,
      "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p",
      video1,
    ]);

    // 3s red video
    await runFFmpeg([
      "-f", "lavfi", "-i", `color=c=red:size=320x240:rate=15:d=3`,
      "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p",
      video2,
    ]);

    // 5s sine wave music
    await runFFmpeg([
      "-f", "lavfi", "-i", `sine=frequency=220:duration=5`,
      "-ar", "44100",
      music1,
    ]);

    ok("Test assets generated (2 videos + 1 music)");

    // ── 2. Upload to MinIO ──
    log("setup", "Uploading assets to MinIO...");

    const vid1Id = randomUUID();
    const vid2Id = randomUUID();
    const mus1Id = randomUUID();
    assetIds.push(vid1Id, vid2Id, mus1Id);

    await storageClient.putObject(BUCKET_ASSETS, vid1Id, createReadStream(video1));
    await storageClient.putObject(BUCKET_ASSETS, vid2Id, createReadStream(video2));
    await storageClient.putObject(BUCKET_ASSETS, mus1Id, createReadStream(music1));

    ok(`Uploaded 3 assets to MinIO (${BUCKET_ASSETS})`);

    // ── 3. Build test graph ──
    const graph: Graph = {
      version: 1,
      nodes: [
        { id: "vp1", type: "MediaPool", config: { assetIds: [vid1Id, vid2Id], assetType: "video" } },
        { id: "mp1", type: "MediaPool", config: { assetIds: [mus1Id], assetType: "audio" } },
        { id: "tts1", type: "TTS", config: { text: "Hello world this is a test of the rendering pipeline", provider: "mock" as any } },
        { id: "loop1", type: "VideoFit", config: { mode: "random-loop" } },
        { id: "sub1", type: "Subtitle", config: { wordsPerGroup: 3, style: { fontSize: 24, color: "#FFFFFF", position: "bottom" } } },
        { id: "layer1", type: "Layer", config: {} },
        { id: "render1", type: "Render", config: { width: 320, height: 240, fps: 15, musicVolume: 0.2 } },
      ],
      edges: [
        { id: "e1", from: "vp1", fromHandle: "items", to: "loop1", toHandle: "items" },
        { id: "e2", from: "tts1", fromHandle: "audio", to: "loop1", toHandle: "audio" },
        { id: "e3", from: "tts1", fromHandle: "timestamps", to: "sub1", toHandle: "timestamps" },
        { id: "e4", from: "loop1", fromHandle: "video", to: "layer1", toHandle: "base" },
        { id: "e5", from: "sub1", fromHandle: "filter", to: "layer1", toHandle: "overlay" },
        { id: "e6", from: "layer1", fromHandle: "video", to: "render1", toHandle: "video" },
        { id: "e7", from: "tts1", fromHandle: "audio", to: "render1", toHandle: "audio" },
        { id: "e8", from: "mp1", fromHandle: "items", to: "render1", toHandle: "music" },
      ],
    };

    // ── 4. Insert template + job in DB ──
    log("setup", "Inserting test template and job in PostgreSQL...");

    // Create a template first (FK constraint on jobs.template_id)
    const [tmplRow] = await rawSql`
      INSERT INTO templates (user_id, name, graph)
      VALUES ('e2e-test', 'E2E Test Template', ${JSON.stringify(graph)}::jsonb)
      RETURNING id
    `;
    templateId = tmplRow!.id;
    ok(`Template created: ${templateId}`);

    const [row] = await db.insert(jobs).values({
      userId: "e2e-test",
      templateId: templateId!,
      graph,
      creditsCharged: 0,
    }).returning();

    jobId = row!.id;
    ok(`Job created: ${jobId}`);

    // ── 5. Execute graph ──
    const workDir = await mkdtemp(join(tmpdir(), `render-e2e-work-`));

    log("run", `Executing graph (${graph.nodes.length} nodes, ${graph.edges.length} edges)...`);
    const startTime = Date.now();

    const results = await executeGraph(graph, workDir);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    ok(`Graph executed in ${elapsed}s`);

    // ── 6. Verify output ──
    log("check", "Verifying output...");

    const renderOutput = results.get("render1");
    if (!renderOutput?.file) {
      fail("Render node produced no file output");
      passed = false;
    } else {
      const finalFile = renderOutput.file as string;
      const fileStat = await stat(finalFile);

      if (fileStat.size === 0) {
        fail("Output file is empty (0 bytes)");
        passed = false;
      } else {
        ok(`Output file exists (${(fileStat.size / 1024).toFixed(0)} KB)`);
      }

      try {
        const duration = await probeDuration(finalFile);
        if (duration > 0) {
          ok(`Duration: ${duration.toFixed(2)}s`);
        } else {
          fail(`Duration is 0 or negative: ${duration}`);
          passed = false;
        }
      } catch (err) {
        fail(`Could not probe duration: ${err}`);
        passed = false;
      }
    }

    // Cleanup work dir
    await rm(workDir, { recursive: true, force: true }).catch(() => {});

  } catch (err) {
    fail(`Unexpected error: ${err}`);
    if (err instanceof Error && err.stack) {
      console.error(`${DIM}${err.stack}${RESET}`);
    }
    passed = false;

  } finally {
    // ── Cleanup ──
    log("clean", "Cleaning up...");

    // Remove assets from MinIO
    for (const id of assetIds) {
      await storageClient.removeObject(BUCKET_ASSETS, id).catch(() => {});
    }

    // Remove job and template from DB
    if (jobId) {
      await db.delete(jobs).where(eq(jobs.id, jobId)).catch(() => {});
    }
    if (templateId) {
      await rawSql`DELETE FROM templates WHERE id = ${templateId}`.catch(() => {});
    }

    // Remove temp dir
    await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }

  // ── Result ──
  console.log();
  if (passed) {
    console.log(`${GREEN}[done]  ✓ E2E test passed!${RESET}`);
    process.exit(0);
  } else {
    console.log(`${RED}[done]  ✕ E2E test failed${RESET}`);
    process.exit(1);
  }
}

main();
