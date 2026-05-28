import { extname, join } from "path";
import { downloadAsset } from "./assets";

export interface SceneAsset {
  index: number;
  startMs: number;
  endMs: number;
  localPath: string;
  fit: "cover" | "contain";
}

export interface ResolvedSceneSlot {
  index: number;
  startMs: number;
  endMs: number;
  assetId: string;
}

export async function downloadSceneAssets(
  slots: ResolvedSceneSlot[],
  workDir: string,
  fit: "cover" | "contain" = "cover",
): Promise<SceneAsset[]> {
  return Promise.all(
    slots.map(async (slot, i) => {
      const ext = extname(slot.assetId) || ".mp4";
      const localPath = join(workDir, `scene-${i}${ext}`);
      await downloadAsset(slot.assetId, localPath);
      return { index: slot.index, startMs: slot.startMs, endMs: slot.endMs, localPath, fit };
    }),
  );
}
