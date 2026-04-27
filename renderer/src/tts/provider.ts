import type { TTSConfig, WordTimestamp } from "../graph";

export interface TTSResult {
  audio: Buffer;
  wordTimestamps: WordTimestamp[];
}

export abstract class BaseTTSProvider {
  abstract readonly name: string;
  abstract synthesize(text: string | undefined, config: TTSConfig): Promise<TTSResult>;
}
