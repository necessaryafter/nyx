import type { ZoomConfig, ShakeConfig } from "../../graph";

export function zoomShakeFilter(zoom: ZoomConfig | undefined, shake: ShakeConfig | undefined): string {
  const factor = zoom?.factor ?? (shake ? 1.05 : 1.0);
  const shakePixels = shake ? (shake.intensity ?? 0) * 2 : 0;

  if (factor === 1.0 && shakePixels === 0) return "";

  const scaleFilter = `scale=trunc(iw*${factor}/2)*2:trunc(ih*${factor}/2)*2`;

  const cropX = shakePixels > 0
    ? `(iw-iw/${factor})/2+${shakePixels}*sin(t*12)`
    : `(iw-iw/${factor})/2`;
  const cropY = shakePixels > 0
    ? `(ih-ih/${factor})/2+${shakePixels}*cos(t*9)`
    : `(ih-ih/${factor})/2`;

  const cropFilter = `crop=trunc(iw/${factor}/2)*2:trunc(ih/${factor}/2)*2:${cropX}:${cropY}`;

  return `${scaleFilter},${cropFilter}`;
}
