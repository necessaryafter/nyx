import { createWriteStream } from "fs";
import { pipeline } from "stream/promises";
import { Readable } from "stream";
import { BaseNodeExecutor, type HandleData, type HandleInputs } from "./executor";
import { storageClient, BUCKET_ASSETS } from "@nyx/shared";
import { logger } from "@nyx/shared";

// Inputs:  (nenhum) — assetIds preenchidos pelo backend via sceneOverrides
// Outputs: items (string[] — paths locais dos assets baixados)
export class SceneSlotExecutor extends BaseNodeExecutor<"SceneSlot"> {
  async execute(_inputs: HandleInputs): Promise<Record<string, HandleData>> {
    const { assetIds, assetType, label } = this.config;

    if (assetIds.length === 0) {
      throw new Error(`SceneSlot "${label}": nenhum asset fornecido para este slot`);
    }

    const ext = assetType === "audio" ? "mp3" : assetType === "image" ? "jpg" : "mp4";

    logger.info(
      { nodeId: this.nodeId, label, count: assetIds.length, assetType },
      "SceneSlot: downloading assets",
    );

    const paths = await Promise.all(
      assetIds.map(async (assetId, i) => {
        const outFile = this.outPath(`slot-${i}.${ext}`);
        const stream = await storageClient.getObject(BUCKET_ASSETS, assetId);
        await pipeline(Readable.from(stream), createWriteStream(outFile));
        return outFile;
      }),
    );

    logger.info({ nodeId: this.nodeId, label, count: paths.length }, "SceneSlot: assets downloaded");

    return { items: paths };
  }
}
