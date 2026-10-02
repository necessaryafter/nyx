import { createCanvas, loadImage } from "@napi-rs/canvas";
import { writeFile } from "fs/promises";
import { join } from "path";
import type { WatermarkPlan } from "../../compile/watermark";

export interface RenderedWatermark {
  path: string; // PNG com alpha, já no tamanho final
  x: number;
  y: number;
}

/** Maior tamanho que cabe na caixa mantendo a proporção da imagem (a marca nunca é esticada nem cortada). */
export function fitContain(width: number, height: number, maxW: number, maxH: number): { width: number; height: number } {
  const scale = Math.min(maxW / width, maxH / height);
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

/**
 * Prepara a marca d'água: redimensiona pro tamanho certo (largura em % do vídeo, altura no máximo 20% dele),
 * aplica a opacidade e devolve onde ela entra: canto inferior direito, com a margem pedida.
 * Imagem que não abre = sem marca (o vídeo sai igual, sem derrubar o render).
 */
export async function renderWatermark(
  plan: WatermarkPlan,
  workDir: string,
  videoWidth: number,
  videoHeight: number,
): Promise<RenderedWatermark | undefined> {
  const image = await loadImage(plan.localPath).catch(() => undefined);
  if (!image) return undefined;

  const size = fitContain(image.width, image.height, Math.round((videoWidth * plan.widthPercent) / 100), Math.round(videoHeight * 0.2));
  const canvas = createCanvas(size.width, size.height);
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingQuality = "high";
  ctx.globalAlpha = plan.opacity;
  ctx.drawImage(image, 0, 0, size.width, size.height);

  const margin = Math.round((videoWidth * plan.marginPercent) / 100);
  const path = join(workDir, "watermark.png");
  await writeFile(path, canvas.toBuffer("image/png"));
  return { path, x: videoWidth - size.width - margin, y: videoHeight - size.height - margin };
}
