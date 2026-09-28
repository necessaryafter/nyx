import { Worker, type Job } from "bullmq";
import { mkdtemp, rm } from "fs/promises";
import { createReadStream } from "fs";
import { join, extname } from "path";
import { tmpdir } from "os";
import { logger, storageClient, BUCKET_ASSETS } from "@nyx/shared";
import { Sentry } from "./lib/sentry";
import { fetchImportBatch, updateImportBatch, type ImportSegment } from "./database";
import { downloadAsset } from "./prepare/assets";
import { probeDuration } from "./ffmpeg/probe";
import { run } from "./ffmpeg/runner";
import { buildScaleFilter } from "./ffmpeg/builder";
import { detectSegments, splitFixedInterval, type DetectedSegment } from "./scene-detection/detect";

const DEFAULT_MAX_SEGMENTS = 30;
// 2 cortes em paralelo (não 3): com -threads 4 cada, cabe em máquinas de 8-12 núcleos
// sem competir com o resto dos serviços (backend, postgres, minio) rodando junto.
const SEGMENT_CONCURRENCY = 2;

export interface AssetImportJobData {
  batchId: string;
  fallbackMode?: "fixed" | "single";
}

async function processInBatches<T, R>(items: T[], size: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += size) {
    results.push(...(await Promise.all(items.slice(i, i + size).map(fn))));
  }
  return results;
}

async function processSegment(
  segment: DetectedSegment,
  sourcePath: string,
  workDir: string,
  userId: string,
  batchId: string,
): Promise<ImportSegment> {
  const clipPath = join(workDir, `segment-${segment.index}.mp4`);
  const thumbPath = join(workDir, `segment-${segment.index}-thumb.jpg`);

  // Seek depois do -i (não antes) = frame-accurate no ponto exato do corte, mais lento mas correto.
  // Qualidade mantida (mesmo preset/crf de sempre) — só limita threads pra não deixar o
  // x264 auto-detectar mais threads do que a máquina aguenta com 3 cortes em paralelo
  // (foi o que abortou num segmento de 23min: memória estourou com threads livres + lookahead).
  await run([
    "-y", "-i", sourcePath,
    "-ss", String(segment.startMs / 1000), "-to", String(segment.endMs / 1000),
    "-vf", buildScaleFilter("cover", 1080, 1920),
    "-an", "-c:v", "libx264", "-threads", "4", "-crf", "20",
    clipPath,
  ]);

  const middleSec = (segment.endMs - segment.startMs) / 2 / 1000;
  await run(["-y", "-ss", String(middleSec), "-i", clipPath, "-frames:v", "1", thumbPath]);

  const clipStorageKey = `${userId}/imports/${batchId}/segment-${segment.index}.mp4`;
  const thumbnailKey = `${userId}/imports/${batchId}/segment-${segment.index}-thumb.jpg`;
  await Promise.all([
    storageClient.putObject(BUCKET_ASSETS, clipStorageKey, createReadStream(clipPath)),
    storageClient.putObject(BUCKET_ASSETS, thumbnailKey, createReadStream(thumbPath)),
  ]);

  return { index: segment.index, startMs: segment.startMs, endMs: segment.endMs, clipStorageKey, thumbnailKey, selected: true };
}

export function startAssetImportWorker() {
  const worker = new Worker<AssetImportJobData>(
    "asset-import",
    async (job: Job<AssetImportJobData>) => {
      const { batchId, fallbackMode } = job.data;
      logger.info({ batchId, fallbackMode }, "asset-import job received");

      let workDir: string | undefined;
      let userId: string | undefined;
      let plannedIndexes: number[] = [];
      try {
        const batch = await fetchImportBatch(batchId);
        userId = batch.userId;
        workDir = await mkdtemp(join(tmpdir(), `asset-import-${batchId}-`));

        const sourcePath = join(workDir, `source${extname(batch.sourceStorageKey) || ".mp4"}`);
        await downloadAsset(batch.sourceStorageKey, sourcePath);
        const durationMs = Math.round((await probeDuration(sourcePath)) * 1000);

        let segments: DetectedSegment[];
        if (fallbackMode === "single") {
          segments = [{ index: 1, startMs: 0, endMs: durationMs }];
        } else if (fallbackMode === "fixed") {
          segments = splitFixedInterval(durationMs, 45_000);
        } else {
          segments = await detectSegments(sourcePath, durationMs, { threshold: 0.4, minSegmentMs: 1500 });
        }
        plannedIndexes = segments.map((s) => s.index);

        if (!fallbackMode && segments.length === 1) {
          // Nenhum corte real encontrado — para aqui, não processa nada até o usuário escolher o fallback.
          await updateImportBatch(batchId, { status: "awaiting_fallback_choice", sourceDurationMs: durationMs });
          logger.info({ batchId }, "no scene cuts detected, awaiting fallback choice");
          return;
        }

        const maxSegments = Number(process.env.ASSET_IMPORT_MAX_SEGMENTS) || DEFAULT_MAX_SEGMENTS;
        if (segments.length > maxSegments) {
          await updateImportBatch(batchId, {
            status: "failed",
            sourceDurationMs: durationMs,
            error: `muitos cortes detectados (${segments.length}), ajuste o vídeo ou aumente o limite`,
          });
          return;
        }

        const processed = await processInBatches(segments, SEGMENT_CONCURRENCY, (s) =>
          processSegment(s, sourcePath, workDir!, batch.userId, batchId),
        );

        await updateImportBatch(batchId, { status: "awaiting_review", sourceDurationMs: durationMs, segments: processed });
        logger.info({ batchId, segments: processed.length }, "asset-import segments ready");
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logger.error({ batchId, err: message }, "asset-import job failed");
        Sentry.captureException(err, { tags: { render_step: "asset_import_worker" }, contexts: { job: { batchId } } });
        await updateImportBatch(batchId, { status: "failed", error: message }).catch(() => {});
        // Segmentos anteriores ao que falhou já podem ter subido pro MinIO, mas o batch
        // nunca chega a salvar a lista de segments (só grava no fim, todos de uma vez) —
        // sem isso ficariam órfãos pra sempre. removeObject numa key que não existe é no-op.
        if (userId) {
          await Promise.all(
            plannedIndexes.flatMap((i) => [
              storageClient.removeObject(BUCKET_ASSETS, `${userId}/imports/${batchId}/segment-${i}.mp4`).catch(() => {}),
              storageClient.removeObject(BUCKET_ASSETS, `${userId}/imports/${batchId}/segment-${i}-thumb.jpg`).catch(() => {}),
            ]),
          );
        }
        throw err;
      } finally {
        if (workDir) {
          await rm(workDir, { recursive: true, force: true }).catch((e) =>
            logger.warn({ workDir, err: e }, "failed to cleanup asset-import work directory"),
          );
        }
      }
    },
    { connection: { url: process.env.REDIS_URL! }, concurrency: 1, lockDuration: 600_000 },
  );

  worker.on("failed", (job, err) => {
    logger.error({ batchId: job?.data.batchId, err: err.message }, "asset-import job failed in BullMQ");
  });
  worker.on("completed", (job) => logger.info({ batchId: job.data.batchId }, "asset-import job completed"));

  return worker;
}
