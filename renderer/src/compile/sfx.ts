import type { RenderAction } from "./actions";

export interface PendingSfx {
  localPath: string;
  startSec: number;
  volume: number;
}

export function extractSfx(actions: RenderAction[], assetMap: Map<string, string>): PendingSfx[] {
  const sfx: PendingSfx[] = [];

  for (const action of actions) {
    if (action.type !== "PlaySfx") continue;

    const assetId = action.params.assetId as string | undefined;
    if (!assetId) continue;

    const localPath = assetMap.get(assetId);
    if (!localPath) continue;

    sfx.push({
      localPath,
      startSec: (action.startMs + ((action.params.startOffsetMs as number | undefined) ?? 0)) / 1000,
      volume: (action.params.volume as number | undefined) ?? 1,
    });
  }

  return sfx;
}
