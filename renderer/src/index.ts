import "./lib/sentry";
import { logger } from "@nyx/shared";
import { startWorker } from "./worker";
import { startAudioWorker } from "./audioWorker";

const worker = startWorker();
const audioWorker = startAudioWorker();

logger.info("renderer workers started");

process.on("SIGTERM", async () => {
  logger.info("shutting down...");
  await Promise.all([worker.close(), audioWorker.close()]);
  process.exit(0);
});