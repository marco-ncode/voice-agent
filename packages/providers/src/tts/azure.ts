import type { TTSProvider, TTSSynthesizeOptions } from "./types.js";

export interface AzureSpeechTTSConfig {
  key: string;
  region: string;
}

/**
 * TODO: implement using the Azure Cognitive Services Speech SDK
 * (microsoft-cognitiveservices-speech-sdk) SpeechSynthesizer, including SSML
 * voice/style support and the push-stream based low-latency path.
 */
export class AzureTTSProvider implements TTSProvider {
  readonly name = "azure";
  constructor(private readonly config: AzureSpeechTTSConfig) {}

  async synthesize(_options: TTSSynthesizeOptions): Promise<Buffer> {
    throw new Error("AzureTTSProvider.synthesize is not implemented yet");
  }

  async *synthesizeStream(_options: TTSSynthesizeOptions): AsyncIterable<Buffer> {
    throw new Error("AzureTTSProvider.synthesizeStream is not implemented yet");
  }
}
