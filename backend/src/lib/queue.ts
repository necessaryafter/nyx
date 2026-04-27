import { Queue } from "bullmq";

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
