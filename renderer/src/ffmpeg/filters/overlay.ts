import { extname, join } from "path";
import { run } from "../runner";
import type { PendingOverlay } from "../../compile/overlays";
import type { RenderedTitleCard } from "./titleCard";

export interface PreparedOverlay extends PendingOverlay {
  clipPath: string; // converted to video clip
}

export async function prepareOverlayClips(
  overlays: PendingOverlay[],
  workDir: string,
): Promise<PreparedOverlay[]> {
  return Promise.all(
    overlays.map(async (overlay, i) => {
      const clipPath = join(workDir, `overlay-${i}.mp4`);
      const durationSec = overlay.endSeconds - overlay.startSeconds;
      const isImage = /\.(png|jpe?g|webp|gif)$/i.test(extname(overlay.localPath));

      const coverScale = `scale=${overlay.width}:${overlay.height}:force_original_aspect_ratio=increase,crop=${overlay.width}:${overlay.height}`;

      if (isImage) {
        await run([
          "-y", "-loop", "1", "-i", overlay.localPath,
          "-t", String(durationSec),
          "-vf", coverScale,
          "-pix_fmt", "yuva420p", "-c:v", "libx264", "-preset", "ultrafast",
          clipPath,
        ]);
      } else {
        await run([
          "-y", "-i", overlay.localPath,
          "-t", String(durationSec),
          "-vf", coverScale,
          "-pix_fmt", "yuva420p", "-c:v", "libx264", "-preset", "ultrafast", "-an",
          clipPath,
        ]);
      }

      return { ...overlay, clipPath };
    }),
  );
}

export function buildOverlayFilterChain(
  overlays: PreparedOverlay[],
  subtitleFilter: string | undefined,
  card?: RenderedTitleCard,
): { inputArgs: string[]; filterComplex: string; finalLabel: string } {
  if (overlays.length === 0 && !subtitleFilter && !card) {
    return { inputArgs: [], filterComplex: "", finalLabel: "0:v" };
  }

  const inputArgs: string[] = [];
  for (const overlay of overlays) inputArgs.push("-i", overlay.clipPath);
  // O card é PNG com alpha (cantos arredondados): entra direto, sem passar pelo clip libx264 que perderia a transparência.
  if (card) inputArgs.push("-loop", "1", "-framerate", "30", "-t", String(card.endSeconds), "-i", card.path);

  const filterParts: string[] = [];
  let currentLabel = "0:v";

  for (let i = 0; i < overlays.length; i++) {
    const overlay = overlays[i]!;
    const inputIdx = i + 1;
    const isLast = i === overlays.length - 1 && !subtitleFilter && !card;
    const outLabel = isLast ? "v_final" : `v_ov${i}`;

    if (overlay.opacity < 1.0) {
      const alphaLabel = `alpha${i}`;
      filterParts.push(`[${inputIdx}:v]colorchannelmixer=aa=${overlay.opacity}[${alphaLabel}]`);
      filterParts.push(
        `[${currentLabel}][${alphaLabel}]overlay=${overlay.x}:${overlay.y}:enable='between(t,${overlay.startSeconds},${overlay.endSeconds})'[${outLabel}]`,
      );
    } else {
      filterParts.push(
        `[${currentLabel}][${inputIdx}:v]overlay=${overlay.x}:${overlay.y}:enable='between(t,${overlay.startSeconds},${overlay.endSeconds})'[${outLabel}]`,
      );
    }

    currentLabel = outLabel;
  }

  if (card) {
    const fade = 0.2;
    const outLabel = subtitleFilter ? "v_card" : "v_final";
    filterParts.push(
      `[${overlays.length + 1}:v]format=rgba,fade=t=in:st=0:d=${fade}:alpha=1,fade=t=out:st=${Math.max(0, card.endSeconds - fade)}:d=${fade}:alpha=1[card]`,
    );
    filterParts.push(
      `[${currentLabel}][card]overlay=${card.x}:${card.y}:enable='between(t,${card.startSeconds},${card.endSeconds})'[${outLabel}]`,
    );
    currentLabel = outLabel;
  }

  if (subtitleFilter) {
    filterParts.push(`[${currentLabel}]${subtitleFilter}[v_final]`);
    currentLabel = "v_final";
  }

  return {
    inputArgs,
    filterComplex: filterParts.join(";"),
    finalLabel: currentLabel,
  };
}
