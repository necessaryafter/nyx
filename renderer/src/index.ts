import "./lib/sentry";
import { logger } from "@nyx/shared";
import { startWorker } from "./worker";
import { startAudioWorker } from "./audioWorker";
import { startAssetImportWorker } from "./assetImportWorker";

const worker = startWorker();
const audioWorker = startAudioWorker();
const assetImportWorker = startAssetImportWorker();

logger.info("renderer workers started");

process.on("SIGTERM", async () => {
  logger.info("shutting down...");
  await Promise.all([worker.close(), audioWorker.close(), assetImportWorker.close()]);
  process.exit(0);
});