import { extname, join } from "path";
import { run } from "../runner";
import type { PendingOverlay } from "../../compile/overlays";
import type { RenderedTitleCard } from "./titleCard";
import type { RenderedWatermark } from "./watermark";

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
  watermark?: RenderedWatermark,
): { inputArgs: string[]; filterComplex: string; finalLabel: string } {
  if (overlays.length === 0 && !subtitleFilter && !card && !watermark) {
    return { inputArgs: [], filterComplex: "", finalLabel: "0:v" };
  }

  const inputArgs: string[] = [];
  for (const overlay of overlays) inputArgs.push("-i", overlay.clipPath);
  // O card é PNG com alpha (cantos arredondados): entra direto, sem passar pelo clip libx264 que perderia a transparência.
  // PNG entra como imagem única e é repetido pelo filtro loop (ver abaixo). NÃO usar
  // "-loop 1" no input: no ffmpeg 7 isso deadlocka o overlay no meio do vídeo (trava
  // sempre no mesmo frame, 0% CPU, ignora SIGTERM) e ainda deixa o encode ~50x mais lento.
  if (card) inputArgs.push("-i", card.path);
  // A marca d'água também é um PNG de um frame só. Aqui NÃO precisa de loop: sem "enable" o overlay repete o
  // último frame da imagem até o fim do vídeo (eof_action=repeat é o padrão).
  if (watermark) inputArgs.push("-i", watermark.path);

  const filterParts: string[] = [];
  let currentLabel = "0:v";

  for (let i = 0; i < overlays.length; i++) {
    const overlay = overlays[i]!;
    const inputIdx = i + 1;
    const isLast = i === overlays.length - 1 && !subtitleFilter && !card && !watermark;
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
    // Sem fade-in: o card já está inteiro no frame 0. Só some com fade no final.
    const fade = 0.2;
    const outLabel = subtitleFilter || watermark ? "v_card" : "v_final";
    filterParts.push(
      `[${overlays.length + 1}:v]format=rgba,loop=loop=${Math.max(0, Math.ceil(card.endSeconds * 30) - 1)}:size=1,setpts=N/30/TB,fade=t=out:st=${Math.max(0, card.endSeconds - fade)}:d=${fade}:alpha=1[card]`,
    );
    filterParts.push(
      `[${currentLabel}][card]overlay=${card.x}:${card.y}:enable='between(t,${card.startSeconds},${card.endSeconds})'[${outLabel}]`,
    );
    currentLabel = outLabel;
  }

  if (watermark) {
    // Do primeiro ao último frame, sem fade. Fica por baixo da legenda.
    const inputIdx = overlays.length + 1 + (card ? 1 : 0);
    const outLabel = subtitleFilter ? "v_wm" : "v_final";
    filterParts.push(`[${inputIdx}:v]format=rgba[wm]`);
    filterParts.push(`[${currentLabel}][wm]overlay=${watermark.x}:${watermark.y}[${outLabel}]`);
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
