import OpenAI from "openai";
import type { ReadableStream as WebReadableStream } from "node:stream/web";
import type { TTSProvider, TTSSynthesizeOptions } from "./types.js";

export class OpenAITTSProvider implements TTSProvider {
  readonly name = "openai";
  private readonly client: OpenAI;

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey });
  }

  async synthesize(options: TTSSynthesizeOptions): Promise<Buffer> {
    const response = await this.client.audio.speech.create({
      model: options.model ?? "tts-1",
      voice: options.voiceId as OpenAI.Audio.Speech.SpeechCreateParams["voice"],
      input: options.text,
    });
    return Buffer.from(await response.arrayBuffer());
  }

  async *synthesizeStream(options: TTSSynthesizeOptions): AsyncIterable<Buffer> {
    const response = await this.client.audio.speech.create({
      model: options.model ?? "tts-1",
      voice: options.voiceId as OpenAI.Audio.Speech.SpeechCreateParams["voice"],
      input: options.text,
      response_format: "pcm",
    });
    const body = response.body as unknown as WebReadableStream<Uint8Array> | null;
    const reader = body?.getReader();
    if (!reader) {
      yield Buffer.from(await response.arrayBuffer());
      return;
    }
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      yield Buffer.from(value);
    }
  }
}
