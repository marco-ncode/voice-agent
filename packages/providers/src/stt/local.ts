import type { STTProvider, STTTranscribeOptions, STTTranscript } from "./types.js";
import type { LocalInferenceConfig } from "../llm/local.js";

export class LocalSTTProvider implements STTProvider {
  readonly name = "local";
  constructor(private readonly config: LocalInferenceConfig) {}

  async transcribe(options: STTTranscribeOptions): Promise<STTTranscript> {
    const res = await fetch(`${this.config.baseUrl}/stt/transcribe`, {
      method: "POST",
      headers: {
        "Content-Type": options.mimeType,
        Authorization: `Bearer ${this.config.apiKey}`,
        "X-Language": options.language ?? "",
        "X-Model": options.model ?? "",
      },
      body: options.audio,
    });
    if (!res.ok) {
      throw new Error(`local STT inference failed: ${res.status} ${await res.text()}`);
    }
    const data = (await res.json()) as { text: string; audio_seconds: number };
    return { text: data.text, isFinal: true, audioSeconds: data.audio_seconds };
  }

  async *transcribeStream(
    audioChunks: AsyncIterable<Buffer>,
    options: { language?: string; model?: string },
  ): AsyncIterable<STTTranscript> {
    const chunks: Buffer[] = [];
    for await (const chunk of audioChunks) {
      chunks.push(chunk);
    }
    yield await this.transcribe({
      audio: Buffer.concat(chunks),
      mimeType: "audio/wav",
      ...options,
    });
  }
}
