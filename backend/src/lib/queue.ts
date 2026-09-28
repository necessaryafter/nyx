import { Queue, QueueEvents } from "bullmq";

const connection = {
  url: process.env.REDIS_URL!,
};

export const renderQueue = new Queue("render", {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 },
  },
});

export const audioQueue = new Queue("audio", {
  connection,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: "exponential", delay: 3000 },
  },
});

export const schedulerQueue = new Queue("scheduler", {
  connection,
  defaultJobOptions: { attempts: 1 }, // uma execução falha não deve re-rodar sozinha (duplicaria cobrança)
});

export const assetImportQueue = new Queue("asset-import", {
  connection,
  defaultJobOptions: { attempts: 1 }, // sem custo de crédito aqui; re-tentar sozinho só rodaria ffmpeg em loop num vídeo problemático
});

// Uma instância compartilhada por fila — usada tanto pelo broadcast do WS quanto
// pelo worker do scheduler (que precisa de waitUntilFinished por parte).
export const renderQueueEvents = new QueueEvents("render", { connection });
export const audioQueueEvents = new QueueEvents("audio", { connection });
export const assetImportQueueEvents = new QueueEvents("asset-import", { connection });
