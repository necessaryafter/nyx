import { Worker, type Job } from "bullmq";
import { mkdtemp, rm, writeFile } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { createReadStream } from "fs";
import { logger } from "@nyx/shared";
import { Sentry } from "./lib/sentry";
import { db, jobs } from "./database/index";
import { eq } from "drizzle-orm";
import { fetchUserIntegration, markFailed, markAudioReady } from "./database";
import { decrypt, storageClient, BUCKET_ASSETS } from "@nyx/shared";
import { TalkifyProvider } from "./tts/talkify";
import { CustomAudioProvider } from "./tts/custom";
import type { TTSConfig, WordTimestamp } from "./graph";
import { calculateSceneSlots } from "./sceneSlots";

export interface AudioJobData {
  jobId: string;
  narration:
    | { type: "tts"; text: string; provider: "talkify"; voice?: string; speed?: number }
    | { type: "audio"; assetStorageKey: string }; // storageKey já resolvido
}

// Calcula sceneSlots localmente (espelho de backend/src/lib/sceneSlots.ts)
// para evitar dependência cruzada de pacote
function calcSlots(timestamps: WordTimestamp[], pauseMs = 500) {
  return calculateSceneSlots(timestamps, pauseMs);
}

async function synthesize(
  narration: AudioJobData["narration"],
  talkifyApiKey: string | undefined,
  workDir: string,
): Promise<{ audioPath: string; timestamps: WordTimestamp[] }> {
  const audioPath = join(workDir, "tts.wav");

  if (narration.type === "tts") {
    if (!talkifyApiKey) {
      throw new Error("AudioWorker: Talkify API key não configurada para este usuário");
    }
    const provider = new TalkifyProvider(talkifyApiKey);
    const config: TTSConfig = {
      provider: "talkify",
      voice: narration.voice,
      speed: narration.speed,
    };
    const result = await provider.synthesize(narration.text, config);
    await writeFile(audioPath, result.audio);
    return { audioPath, timestamps: result.wordTimestamps };
  }

  // narration.type === "audio" — storageKey já resolvido
  const provider = new CustomAudioProvider();
  const config: TTSConfig = {
    provider: "custom",
    voice: narration.assetStorageKey, // CustomAudioProvider usa config.voice como storageKey
  };
  const result = await provider.synthesize(undefined, config);
  await writeFile(audioPath, result.audio);
  return { audioPath, timestamps: result.wordTimestamps };
}

export function startAudioWorker() {
  const worker = new Worker<AudioJobData>(
    "audio",
    async (job: Job<AudioJobData>) => {
      const { jobId, narration } = job.data;
      logger.info({ jobId }, "audio job received");

      let workDir: string | undefined;

      try {
        // Busca userId do job
        const [dbJob] = await db
          .select({ userId: jobs.userId })
          .from(jobs)
          .where(eq(jobs.id, jobId))
          .limit(1);

        if (!dbJob) throw new Error(`job ${jobId} not found`);

        const talkifyIntegration = await fetchUserIntegration(dbJob.userId, "talkify");
        const talkifyApiKey = talkifyIntegration
          ? decrypt(talkifyIntegration.encryptedApiKey)
          : undefined;

        workDir = await mkdtemp(join(tmpdir(), `audio-${jobId}-`));

        // Sintetiza áudio
        const { audioPath, timestamps } = await synthesize(narration, talkifyApiKey, workDir);

        // Faz upload para MinIO
        const audioKey = `audio-jobs/${jobId}/tts.wav`;
        await storageClient.putObject(BUCKET_ASSETS, audioKey, createReadStream(audioPath));
        logger.info({ jobId, audioKey }, "audio uploaded to MinIO");

        // Calcula sceneSlots
        const sceneSlots = calcSlots(timestamps);
        logger.info({ jobId, slots: sceneSlots.length }, "scene slots calculated");

        // Atualiza job no DB
        await markAudioReady(jobId, audioKey, sceneSlots);
        logger.info({ jobId }, "job marked as audio_ready");
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logger.error({ jobId, err: message }, "audio job failed");

        Sentry.captureException(err, {
          tags: { render_step: "audio_worker" },
          contexts: { job: { jobId } },
        });

        await markFailed(jobId, message);
        throw err;
      } finally {
        if (workDir) {
          await rm(workDir, { recursive: true, force: true }).catch((e) =>
            logger.warn({ workDir, err: e }, "failed to cleanup audio work directory"),
          );
        }
      }
    },
    {
      connection: { url: process.env.REDIS_URL! },
      concurrency: 2,
    },
  );

  worker.on("failed", (job, err) => {
    logger.error({ jobId: job?.data.jobId, err: err.message }, "audio job failed in BullMQ");
  });

  worker.on("completed", (job) => {
    logger.info({ jobId: job.data.jobId }, "audio job completed");
  });

  return worker;
}
