import { createWriteStream } from "fs";
import { pipeline } from "stream/promises";
import { Readable } from "stream";
import { extname, join } from "path";
import { storageClient, BUCKET_ASSETS } from "@nyx/shared";

export async function downloadAsset(storageKey: string, outPath: string): Promise<string> {
  const stream = await storageClient.getObject(BUCKET_ASSETS, storageKey);
  await pipeline(Readable.from(stream), createWriteStream(outPath));

  return outPath;
}

export async function downloadAssets(
  assetIds: string[],
  workDir: string,
): Promise<Map<string, string>> {
  const map = new Map<string, string>();

  await Promise.all(
    assetIds.map(async (id, i) => {
      const extension = extname(id) || ".bin";
      const outPath = join(workDir, `asset-${i}${extension}`);
      
      await downloadAsset(id, outPath);
      map.set(id, outPath);
    }),
  );
  return map;
}
