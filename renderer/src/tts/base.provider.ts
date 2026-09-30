import type { TTSConfig, WordTimestamp } from "../graph";

export interface TTSResult {
  audio: Buffer;
  wordTimestamps: WordTimestamp[];
}

/**
 * Remove marcação markdown do texto de narração antes do TTS — só decoração (o TTS
 * lê "*" como "asterisco"), nunca pontuação de verdade: "?", "!", "." etc. mudam a
 * entonação da fala e têm que passar intactos.
 */
export function sanitizeNarrationText(text: string): string {
  return text
    // Separadores que o Gemini devolve em volta do roteiro (---ROTEIRO---, ROTEIRO ==,
    // == FIM ==...). Exige "--"/"==" do lado pra não comer "fim" de uma frase normal.
    .replace(/[-=]{2,}[ \t]*(?:ROTEIRO|FIM)\b[ \t]*(?:[-=]{2,})?|\b(?:ROTEIRO|FIM)[ \t]*[-=]{2,}/gi, "")
    .replace(/^[ \t]*(?:ROTEIRO|FIM)[ \t]*:?[ \t]*$/gm, "") // linha só com o marcador, em maiúsculas
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1") // [texto](url) -> texto
    .replace(/^[ \t]*#{1,6}[ \t]+/gm, "") // # header
    .replace(/^[ \t]*>[ \t]?/gm, "") // > blockquote
    .replace(/[*_`~]/g, ""); // * ** _ __ ` ~~
}

export abstract class BaseTTSProvider {
  abstract readonly name: string;

  async synthesize(text: string | undefined, config: TTSConfig): Promise<TTSResult> {
    return this.doSynthesize(text !== undefined ? sanitizeNarrationText(text) : text, config);
  }

  protected abstract doSynthesize(text: string | undefined, config: TTSConfig): Promise<TTSResult>;
}
