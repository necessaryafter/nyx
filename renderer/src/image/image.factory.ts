import type { BaseImageProvider } from "./base.provider";
import { MockImageProvider } from "./providers/mock.provider";

const PROVIDERS: Record<string, () => BaseImageProvider> = {
  // nanoBanana: () => new NanoBananaImageProvider(),
  // imagen1: () => new Imagen1ImageProvider(),
  mock: () => new MockImageProvider(),
};

export function createImageProvider(name: string): BaseImageProvider {
  const factory = PROVIDERS[name];
  if (!factory) {
    throw new Error(
      `Unknown image provider: "${name}". Available: ${Object.keys(PROVIDERS).join(", ")}`,
    );
  }
  return factory();
}

export function defaultImageProvider(): BaseImageProvider {
  const name = process.env.IMAGE_PROVIDER ?? "mock";
  return createImageProvider(name);
}
