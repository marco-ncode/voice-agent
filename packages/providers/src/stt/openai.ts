import OpenAI, { toFile } from "openai";
import type { STTProvider, STTTranscribeOptions, STTTranscript } from "./types.js";

export class OpenAISTTProvider implements STTProvider {
  readonly name = "openai";
  private readonly client: OpenAI;

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey });
  }

  async transcribe(options: STTTranscribeOptions): Promise<STTTranscript> {
    const file = await toFile(options.audio, "audio", { type: options.mimeType });
    const response = await this.client.audio.transcriptions.create({
      file,
      model: options.model ?? "whisper-1",
      language: options.language,
    });
    return {
      text: response.text,
      isFinal: true,
      audioSeconds: estimateAudioSeconds(options.audio, options.mimeType),
    };
  }

  async *transcribeStream(
    audioChunks: AsyncIterable<Buffer>,
    options: { language?: string; model?: string },
  ): AsyncIterable<STTTranscript> {
    // OpenAI's batch transcription API has no streaming endpoint: buffer the
    // whole utterance (bounded by the caller's VAD/silence-timeout) and
    // transcribe once it ends.
    const chunks: Buffer[] = [];
    for await (const chunk of audioChunks) {
      chunks.push(chunk);
    }
    const audio = Buffer.concat(chunks);
    yield await this.transcribe({ audio, mimeType: "audio/wav", ...options });
  }
}

function estimateAudioSeconds(buffer: Buffer, mimeType: string): number {
  // 16kHz mono 16-bit PCM is the assumed default; adjust once real
  // container/codec metadata is threaded through.
  if (mimeType.includes("wav") || mimeType.includes("pcm")) {
    return buffer.length / (16_000 * 2);
  }
  return 0;
}
