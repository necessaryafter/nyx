import { createWriteStream } from "fs";
import { pipeline } from "stream/promises";
import { Readable } from "stream";
import { BaseNodeExecutor, type HandleData, type HandleInputs } from "./executor";
import { storageClient, BUCKET_ASSETS } from "@nyx/shared";
import { logger } from "@nyx/shared";

// Inputs:  (nenhum)
// Outputs: items (string[] — paths locais dos assets baixados)
export class MediaPoolExecutor extends BaseNodeExecutor<"MediaPool"> {
  async execute(_inputs: HandleInputs): Promise<Record<string, HandleData>> {
    const { assetIds, assetType } = this.config;

    if (assetIds.length === 0) {
      throw new Error("MediaPool: assetIds está vazio");
    }

    const ext = assetType === "audio" ? "mp3" : assetType === "image" ? "jpg" : "mp4";

    logger.info(
      { nodeId: this.nodeId, count: assetIds.length, assetType },
      "MediaPool: downloading all assets",
    );

    const paths = await Promise.all(
      assetIds.map(async (assetId, i) => {
        const outFile = this.outPath(`asset-${i}.${ext}`);
        const stream = await storageClient.getObject(BUCKET_ASSETS, assetId);
        await pipeline(Readable.from(stream), createWriteStream(outFile));
        return outFile;
      }),
    );

    logger.info({ nodeId: this.nodeId, count: paths.length }, "MediaPool: all assets downloaded");

    return { items: paths };
  }
}
