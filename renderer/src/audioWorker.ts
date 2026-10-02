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
import { TalkifyProvider } from "./tts/providers/talkify.provider";
import { CustomAudioProvider } from "./tts/providers/custom.provider";
import { EdgeTTSProvider } from "./tts/providers/edge.provider";
import { GeminiTTSProvider } from "./tts/providers/gemini.provider";
import type { TTSConfig, WordTimestamp } from "./graph";
import { calculateSceneSlots, sentenceSlots } from "./sceneSlots";
import { sanitizeNarrationText } from "./tts/base.provider";

export interface AudioJobData {
  jobId: string;
  narration:
    | ({ type: "tts"; text: string; provider: "talkify" | "edge" | "gemini" } & Pick<TTSConfig, "voice" | "speed" | "model" | "paceMode" | "stylePreset" | "style">)
    | { type: "audio"; assetStorageKey: string }; // storageKey já resolvido
}

// Calcula sceneSlots localmente (espelho de backend/src/lib/sceneSlots.ts)
// para evitar dependência cruzada de pacote
function calcSlots(timestamps: WordTimestamp[], pauseMs = 500) {
  return calculateSceneSlots(timestamps, pauseMs);
}

async function synthesize(
  narration: AudioJobData["narration"],
  keys: { talkify?: string; gemini?: string },
  workDir: string,
): Promise<{ audioPath: string; timestamps: WordTimestamp[]; sceneSlots?: ReturnType<typeof calculateSceneSlots> }> {
  const audioPath = join(workDir, "tts.wav");

  if (narration.type === "tts") {
    if (narration.provider === "edge") {
      const provider = new EdgeTTSProvider();
      const config: TTSConfig = { provider: "edge", voice: narration.voice, speed: narration.speed };
      const result = await provider.synthesize(narration.text, config);
      await writeFile(audioPath, result.audio);
      // Each SRT cue from edge-tts is already a sentence — use directly as slots.
      const sceneSlots = result.wordTimestamps.map((t, i) => ({
        index: i,
        startMs: t.startMs,
        endMs: t.endMs,
        assetId: null as null,
        narrationText: t.word,
      }));
      return { audioPath, timestamps: result.wordTimestamps, sceneSlots };
    }

    if (narration.provider === "gemini") {
      if (!keys.gemini) throw new Error("AudioWorker: chave do Gemini não configurada (Configurações → Integrações)");
      const { type: _, text, ...config } = narration;
      const result = await new GeminiTTSProvider(keys.gemini).synthesize(text, config);
      await writeFile(audioPath, result.audio);
      // Mesmo texto que foi pro TTS (synthesize sanitiza antes de falar).
      const sceneSlots = sentenceSlots(result.wordTimestamps, sanitizeNarrationText(text));
      return { audioPath, timestamps: result.wordTimestamps, sceneSlots };
    }

    const talkifyApiKey = keys.talkify;
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
        // Mesma regra do backend (resolveGeminiKey): chave do usuário, senão a global.
        const geminiIntegration = narration.type === "tts" && narration.provider === "gemini"
          ? await fetchUserIntegration(dbJob.userId, "gemini")
          : null;
        const geminiApiKey = geminiIntegration ? decrypt(geminiIntegration.encryptedApiKey) : process.env.GOOGLE_AI_STUDIO_KEY;

        workDir = await mkdtemp(join(tmpdir(), `audio-${jobId}-`));

        // Sintetiza áudio
        const { audioPath, timestamps, sceneSlots: prebuiltSlots } = await synthesize(narration, { talkify: talkifyApiKey, gemini: geminiApiKey }, workDir);

        // Faz upload para MinIO
        const audioKey = `audio-jobs/${jobId}/tts.wav`;
        await storageClient.putObject(BUCKET_ASSETS, audioKey, createReadStream(audioPath));
        logger.info({ jobId, audioKey }, "audio uploaded to MinIO");

        // Calcula sceneSlots (edge-tts já entrega slots prontos por frase)
        const sceneSlots = prebuiltSlots ?? calcSlots(timestamps);
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
