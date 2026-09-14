import type { STTProvider, STTTranscribeOptions, STTTranscript } from "./types.js";

export interface AzureSpeechConfig {
  key: string;
  region: string;
}

/**
 * TODO: implement using the Azure Cognitive Services Speech SDK
 * (microsoft-cognitiveservices-speech-sdk) for both REST batch transcription
 * and the push-audio-stream based real-time recognizer.
 */
export class AzureSTTProvider implements STTProvider {
  readonly name = "azure";
  constructor(private readonly config: AzureSpeechConfig) {}

  async transcribe(_options: STTTranscribeOptions): Promise<STTTranscript> {
    throw new Error("AzureSTTProvider.transcribe is not implemented yet");
  }

  async *transcribeStream(
    _audioChunks: AsyncIterable<Buffer>,
    _options: { language?: string; model?: string },
  ): AsyncIterable<STTTranscript> {
    throw new Error("AzureSTTProvider.transcribeStream is not implemented yet");
  }
}
