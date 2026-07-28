import { Worker, type Job } from "bullmq";
import { mkdtemp, rm, stat } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { createReadStream } from "fs";
import { logger } from "@nyx/shared";
import { Sentry } from "./lib/sentry";
import { fetchJob, markDone, markFailed, resolveAssetKeys, fetchUserIntegration } from "./database";
import { decrypt, storageClient, BUCKET_VIDEOS } from "@nyx/shared";
import { probeDuration } from "./ffmpeg/probe";
import type { Graph } from "./graph";
import { prepareAudio } from "./prepare/audio";
import { downloadSceneAssets } from "./prepare/scenes";
import { downloadAssets } from "./prepare/assets";
import { compilePlan } from "./compile/index";
import { buildVideo } from "./ffmpeg/builder";

interface RenderJobData {
  jobId: string;
}

function collectAssetIds(graph: Graph): string[] {
  const ids = new Set<string>();
  for (const node of graph.nodes) {
    if (node.type === "AssetSource" || node.type === "MusicSource") {
      for (const id of node.config.assetIds) ids.add(id);
    } else if (node.type === "ShowOverlay" && node.config.assetId) {
      ids.add(node.config.assetId);
    } else if (node.type === "PlaySfx" && node.config.assetId) {
      ids.add(node.config.assetId);
    } else if (node.type === "NarrationSource" && node.config.provider === "custom" && node.config.voice) {
      ids.add(node.config.voice);
    }
  }
  return [...ids];
}

function patchStorageKeys(graph: Graph, keyMap: Map<string, string>): Graph {
  const nodes = graph.nodes.map((node) => {
    if (node.type === "AssetSource") {
      return { ...node, config: { ...node.config, assetIds: node.config.assetIds.map((id) => resolve(id, keyMap)) } };
    }
    if (node.type === "MusicSource") {
      return { ...node, config: { ...node.config, assetIds: node.config.assetIds.map((id) => resolve(id, keyMap)) } };
    }
    if (node.type === "NarrationSource" && node.config.provider === "custom" && node.config.voice) {
      return { ...node, config: { ...node.config, voice: resolve(node.config.voice, keyMap) } };
    }
    if (node.type === "ShowOverlay" && node.config.assetId) {
      return { ...node, config: { ...node.config, assetId: resolve(node.config.assetId, keyMap) } };
    }
    if (node.type === "PlaySfx" && node.config.assetId) {
      return { ...node, config: { ...node.config, assetId: resolve(node.config.assetId, keyMap) } };
    }
    return node;
  });
  return { ...graph, nodes };
}

function resolve(id: string, keyMap: Map<string, string>): string {
  const key = keyMap.get(id);
  if (!key) throw new Error(`asset ${id} not found in database`);
  return key;
}

export function startWorker() {
  const worker = new Worker<RenderJobData>(
    "render",
    async (job: Job<RenderJobData>) => {
      const { jobId } = job.data;
      logger.info({ jobId }, "render job received");

      let workDir: string | undefined;

      try {
        const dbJob = await fetchJob(jobId);
        const graph = dbJob.graph as Graph;

        if (graph.version !== 2) throw new Error(`unsupported graph version ${String(graph.version)}`);

        // Resolve asset UUIDs → MinIO storage keys
        const assetIds = collectAssetIds(graph);
        const keyMap = await resolveAssetKeys(assetIds);
        logger.info({ jobId, assetCount: assetIds.length }, "asset keys resolved");
        const resolvedGraph = patchStorageKeys(graph, keyMap);

        workDir = await mkdtemp(join(tmpdir(), `render-${jobId}-`));
        logger.info({ jobId, workDir }, "work directory created");

        const talkifyIntegration = await fetchUserIntegration(dbJob.userId, "talkify");
        const talkifyApiKey = talkifyIntegration ? decrypt(talkifyIntegration.encryptedApiKey) : undefined;

        // Resolve scene slot asset IDs → storage keys
        let rawSlots: Array<{ index: number; startMs: number; endMs: number; assetId: string | null }> = [];
        if (dbJob.sceneSlots) {
          rawSlots = dbJob.sceneSlots as typeof rawSlots;
          const slotAssetIds = rawSlots.map((s) => s.assetId).filter(Boolean) as string[];
          const slotKeyMap = await resolveAssetKeys(slotAssetIds);
          rawSlots = rawSlots.map((slot) => ({
            ...slot,
            assetId: slot.assetId ? (slotKeyMap.get(slot.assetId) ?? slot.assetId) : null,
          }));
        }
        const filledSlots = rawSlots.filter((s) => s.assetId !== null) as Array<{ index: number; startMs: number; endMs: number; assetId: string }>;

        // ── prepare ──────────────────────────────────────────────────────
        const narrationNode = resolvedGraph.nodes.find((n) => n.type === "NarrationSource");
        if (!narrationNode || narrationNode.type !== "NarrationSource") {
          throw new Error("graph has no NarrationSource node");
        }

        const { audioPath, timestamps } = await prepareAudio(narrationNode.config, workDir, talkifyApiKey);
        logger.info({ jobId, timestamps: timestamps.length }, "audio ready");

        const sceneSourceNode = resolvedGraph.nodes.find((n) => n.type === "SceneSource");
        const sceneFit = sceneSourceNode?.type === "SceneSource" ? (sceneSourceNode.config.fit ?? "cover") : "cover";

        const sceneAssets = filledSlots.length > 0
          ? await downloadSceneAssets(filledSlots, workDir, sceneFit)
          : [];
        logger.info({ jobId, scenes: sceneAssets.length }, "scene assets ready");

        // Download pool/overlay/sfx/music assets
        const tDownload = Date.now();
        const assetMap = await downloadAssets(assetIds.map((id) => keyMap.get(id) ?? id), workDir);
        logger.info({ jobId, assets: assetMap.size, ms: Date.now() - tDownload }, "pool assets downloaded");

        // ── compile ───────────────────────────────────────────────────────
        const plan = compilePlan({ graph: resolvedGraph, audioPath, timestamps, assetMap, sceneAssets });
        logger.info({ jobId }, "render plan compiled");

        // ── build ─────────────────────────────────────────────────────────
        const outputFile = await buildVideo(plan, workDir);
        logger.info({ jobId, outputFile }, "video built");

        let durationSeconds: number | undefined;
        try {
          durationSeconds = Math.round(await probeDuration(outputFile));
        } catch {
          logger.warn({ jobId }, "could not determine video duration");
        }

        const videoKey = `${jobId}/output.mp4`;
        const { size: videoSize } = await stat(outputFile);
        await storageClient.putObject(BUCKET_VIDEOS, videoKey, createReadStream(outputFile), videoSize);
        logger.info({ jobId, videoKey, videoSize }, "video uploaded");

        await markDone(jobId, videoKey, durationSeconds);
        logger.info({ jobId, durationSeconds }, "job done");
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logger.error({ jobId, err: message }, "render job failed");
        Sentry.captureException(err, { tags: { render_step: "worker" }, contexts: { job: { jobId } } });
        throw err;
      } finally {
        if (workDir) {
          await rm(workDir, { recursive: true, force: true }).catch((e) =>
            logger.warn({ workDir, err: e }, "failed to cleanup work directory"),
          );
        }
      }
    },
    { connection: { url: process.env.REDIS_URL! }, concurrency: 1, lockDuration: 300_000 },
  );

  worker.on("failed", (job, err) => {
    const jobId = job?.data.jobId;
    logger.error({ jobId, err: err.message }, "job failed");
    if (jobId) {
      markFailed(jobId, err.message).catch((dbErr) => {
        logger.error({ jobId, dbErr }, "failed to mark job as failed");
        Sentry.captureException(dbErr, { tags: { render_step: "mark_failed" }, contexts: { job: { jobId } } });
      });
    }
  });

  worker.on("completed", (job) => logger.info({ jobId: job.data.jobId }, "job completed"));

  return worker;
}
