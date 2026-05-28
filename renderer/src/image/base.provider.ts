export interface ImageOptions {
  /** Aspect ratio passed to the provider, e.g. "9:16", "16:9", "1:1" */
  ratio?: string;
}

export interface ImageResult {
  buffer: Buffer;
  mimeType: string;
  /** Extension without dot, e.g. "jpg" */
  ext: string;
}

  export abstract class BaseImageProvider {
    abstract readonly name: string;
    abstract generate(prompt: string, options?: ImageOptions): Promise<ImageResult>;
  }
