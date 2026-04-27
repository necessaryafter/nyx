import { writeFile } from "fs/promises";
import { BaseNodeExecutor, type HandleData, type HandleInputs } from "./executor";
import { TalkifyProvider } from "../tts/talkify";
import { CustomAudioProvider } from "../tts/custom";
import { MockTTSProvider } from "../tts/mock";
import type { BaseTTSProvider } from "../tts/provider";
import type { TTSConfig } from "../graph";
import { logger } from "@nyx/shared";

function resolveProvider(providerName: string, config: TTSConfig, context: { talkifyApiKey?: string }): BaseTTSProvider {
  switch (providerName) {
    case "talkify": {
      if (!context.talkifyApiKey) {
        throw new Error("TTS: nenhuma API key da Talkify configurada para este usuário");
      }
      return new TalkifyProvider(context.talkifyApiKey);
    }
    case "custom":
      return new CustomAudioProvider();
    case "mock":
      return new MockTTSProvider();
    default:
      throw new Error(`TTS: provider desconhecido "${providerName}"`);
  }
}

// Inputs:  (nenhum)
// Outputs: audio (path), timestamps (WordTimestamp[])
export class TTSExecutor extends BaseNodeExecutor<"TTS"> {
  async execute(_inputs: HandleInputs): Promise<Record<string, HandleData>> {
    const { text, provider: providerName } = this.config;

    if (providerName !== "custom" && !text) throw new Error("TTS: text não foi injetado no job");

    const provider = resolveProvider(providerName, this.config, this.context);

    logger.info({ nodeId: this.nodeId, provider: providerName }, "TTS: synthesizing");

    const result = await provider.synthesize(text, this.config);
    const outFile = this.outPath("audio.wav");

    await writeFile(outFile, result.audio);

    logger.info(
      { nodeId: this.nodeId, outFile, words: result.wordTimestamps.length },
      "TTS: audio saved",
    );

    return { audio: outFile, timestamps: result.wordTimestamps };
  }
}
