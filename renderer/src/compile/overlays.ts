import type { RenderAction } from "./actions";

export interface PendingOverlay {
  localPath: string;
  startSeconds: number;
  endSeconds: number;
  x: number;
  y: number;
  width: number;
  height: number;
  opacity: number;
}

export function extractOverlays(actions: RenderAction[], assetMap: Map<string, string>): PendingOverlay[] {
  const overlays: PendingOverlay[] = [];

  for (const action of actions) {
    if (action.type !== "ShowOverlay") continue;

    const assetId = action.params.assetId as string | undefined;
    if (!assetId) continue;

    const localPath = assetMap.get(assetId);
    if (!localPath) continue;

    const pos = (action.params.position as { x: number; y: number; width: number; height: number } | undefined)
      ?? { x: 0, y: 0, width: 240, height: 240 };
    const startOffsetMs = (action.params.startOffsetMs as number | undefined) ?? 0;

    overlays.push({
      localPath,
      startSeconds: (action.startMs + startOffsetMs) / 1000,
      endSeconds: action.endMs / 1000,
      x: pos.x,
      y: pos.y,
      width: pos.width,
      height: pos.height,
      opacity: (action.params.opacity as number | undefined) ?? 1,
    });
  }

  return overlays;
}
