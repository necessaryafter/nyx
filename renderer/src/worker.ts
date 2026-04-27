import { Worker, type Job } from "bullmq";
import { mkdtemp, rm } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { createReadStream } from "fs";
import { logger } from "@nyx/shared";
import { Sentry } from "./lib/sentry";
import { fetchJob, markDone, markFailed, resolveAssetKeys, fetchUserIntegration } from "./database";
import type { ResolvedSceneSlot } from "./nodes/executor";
import { executeGraph } from "./resolver";
import { decrypt, storageClient, BUCKET_VIDEOS } from "@nyx/shared";
import { probeDuration } from "./ffmpeg/probe";
import type { Graph, GraphNode } from "./graph";

interface RenderJobData {
  jobId: string;
}

/**
 * Coleta todos os assetIds presentes no grafo (MediaPool, SceneSlot, Overlay).
 */
function collectAssetIds(graph: Graph): string[] {
  const ids = new Set<string>();
  for (const node of graph.nodes) {
    if (node.type === "MediaPool" || node.type === "SceneSlot") {
      for (const id of node.config.assetIds) ids.add(id);
    } else if (node.type === "Overlay") {
      ids.add(node.config.assetId);
      if (node.config.soundAssetId) ids.add(node.config.soundAssetId);
    } else if (node.type === "TTS" && node.config.provider === "custom" && node.config.voice) {
      // "precomputed" usa storageKey direto — não precisa de resolução
      ids.add(node.config.voice);
    }
  }
  return [...ids];
}

/**
 * Substitui assetIds pelos storageKeys correspondentes no grafo.
 * Lança erro se algum asset não for encontrado.
 */
function patchGraphWithStorageKeys(graph: Graph, keyMap: Map<string, string>): Graph {
  const patchedNodes: GraphNode[] = graph.nodes.map((node) => {
    if (node.type === "MediaPool") {
      const patchedIds = node.config.assetIds.map((id) => {
        const key = keyMap.get(id);
        if (!key) throw new Error(`asset ${id} not found in database`);
        return key;
      });
      return { ...node, config: { ...node.config, assetIds: patchedIds } };
    }
    if (node.type === "SceneSlot") {
      const patchedIds = node.config.assetIds.map((id) => {
        const key = keyMap.get(id);
        if (!key) throw new Error(`asset ${id} not found in database`);
        return key;
      });
      return { ...node, config: { ...node.config, assetIds: patchedIds } };
    }
    if (node.type === "TTS" && node.config.provider === "precomputed") {
      // voice já é storageKey — não precisa resolver
      return node;
    }
    if (node.type === "TTS" && node.config.provider === "custom" && node.config.voice) {
      const key = keyMap.get(node.config.voice);
      if (!key) throw new Error(`asset ${node.config.voice} not found in database`);
      return { ...node, config: { ...node.config, voice: key } };
    }
    if (node.type === "Overlay") {
      const assetKey = keyMap.get(node.config.assetId);
      if (!assetKey) throw new Error(`asset ${node.config.assetId} not found in database`);
      const soundKey = node.config.soundAssetId ? keyMap.get(node.config.soundAssetId) : undefined;
      if (node.config.soundAssetId && !soundKey) throw new Error(`asset ${node.config.soundAssetId} not found in database`);
      return { ...node, config: { ...node.config, assetId: assetKey, ...(soundKey ? { soundAssetId: soundKey } : {}) } };
    }
    return node;
  });
  return { ...graph, nodes: patchedNodes };
}

export function startWorker() {
  const worker = new Worker<RenderJobData>(
    "render",
    async (job: Job<RenderJobData>) => {
      const { jobId } = job.data;
      logger.info({ jobId }, "job received");

      let workDir: string | undefined;

      try {
        // 1. Busca job no DB
        const dbJob = await fetchJob(jobId);
        const graph = dbJob.graph as Graph;

        // 2. Resolve asset UUIDs → MinIO storageKeys
        const assetIds = collectAssetIds(graph);
        const keyMap = await resolveAssetKeys(assetIds);
        logger.info({ jobId, assetCount: assetIds.length }, "asset keys resolved");
        const resolvedGraph = patchGraphWithStorageKeys(graph, keyMap);

        // 3. Cria diretório de trabalho temporário
        workDir = await mkdtemp(join(tmpdir(), `render-${jobId}-`));
        logger.info({ jobId, workDir }, "work directory created");

        // 4. Resolve API key do provider TTS do usuário
        const talkifyIntegration = await fetchUserIntegration(dbJob.userId, "talkify");
        const talkifyApiKey = talkifyIntegration ? decrypt(talkifyIntegration.encryptedApiKey) : undefined;

        // 5. Resolve sceneSlots (staged flow) → storageKeys para o SceneMedia node
        let resolvedSceneSlots: ResolvedSceneSlot[] | undefined;
        if (dbJob.sceneSlots) {
          const rawSlots = dbJob.sceneSlots as Array<{ index: number; startMs: number; endMs: number; assetId: string | null }>;
          const slotAssetIds = rawSlots.map((s) => s.assetId).filter(Boolean) as string[];
          const slotKeyMap = await resolveAssetKeys(slotAssetIds);
          resolvedSceneSlots = rawSlots.map((slot) => ({
            index: slot.index,
            startMs: slot.startMs,
            endMs: slot.endMs,
            assetId: slot.assetId ? (slotKeyMap.get(slot.assetId) ?? slot.assetId) : "",
          }));
          logger.info({ jobId, slots: resolvedSceneSlots.length }, "scene slots resolved");
        }

        // 6. Executa o grafo completo
        const renderNodeConfig = resolvedGraph.nodes.find((n) => n.type === "Render")?.config as { width: number; height: number } | undefined;
        const results = await executeGraph(resolvedGraph, workDir, {
          talkifyApiKey,
          renderWidth: renderNodeConfig?.width,
          renderHeight: renderNodeConfig?.height,
          sceneSlots: resolvedSceneSlots,
        });

        // 7. Encontra o output do node Render (file)
        const renderNode = resolvedGraph.nodes.find((n) => n.type === "Render");
        if (!renderNode) throw new Error("graph has no Render node");

        const renderOutput = results.get(renderNode.id);
        if (!renderOutput?.file) throw new Error("Render node produced no file output");

        const finalFile = renderOutput.file as string;

        // 7. Calcula duração do vídeo final
        let durationSeconds: number | undefined;
        try {
          durationSeconds = Math.round(await probeDuration(finalFile));
        } catch {
          logger.warn({ jobId }, "could not determine video duration");
        }

        // 8. Upload para MinIO
        const videoKey = `${jobId}/output.mp4`;
        await storageClient.putObject(BUCKET_VIDEOS, videoKey, createReadStream(finalFile));
        logger.info({ jobId, videoKey }, "video uploaded to MinIO");

        // 9. Atualiza job no DB
        await markDone(jobId, videoKey, durationSeconds);
        logger.info({ jobId, durationSeconds }, "job marked as done");
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logger.error({ jobId, err: message }, "job processing failed");

        Sentry.captureException(err, {
          tags: { render_step: "worker" },
          contexts: { job: { jobId } },
        });

        throw err;
      } finally {
        // Limpa o diretório temporário
        if (workDir) {
          await rm(workDir, { recursive: true, force: true }).catch((e) =>
            logger.warn({ workDir, err: e }, "failed to cleanup work directory"),
          );
        }
      }
    },
    {
      connection: { url: process.env.REDIS_URL! },
      concurrency: 1,
    },
  );

  worker.on("failed", (job, err) => {
    const jobId = job?.data.jobId;
    logger.error({ jobId, err: err.message }, "job failed");
    if (jobId) {
      markFailed(jobId, err.message).catch((dbErr) => {
        logger.error({ jobId, dbErr }, "failed to update job status in DB");
        Sentry.captureException(dbErr, {
          tags: { render_step: "mark_failed" },
          contexts: { job: { jobId } },
        });
      });
    }
  });

  worker.on("completed", (job) => {
    logger.info({ jobId: job.data.jobId }, "job completed");
  });

  return worker;
}
