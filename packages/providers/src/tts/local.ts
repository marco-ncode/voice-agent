import type { TTSProvider, TTSSynthesizeOptions } from "./types.js";
import type { LocalInferenceConfig } from "../llm/local.js";

export class LocalTTSProvider implements TTSProvider {
  readonly name = "local";
  constructor(private readonly config: LocalInferenceConfig) {}

  async synthesize(options: TTSSynthesizeOptions): Promise<Buffer> {
    const res = await fetch(`${this.config.baseUrl}/tts/synthesize`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({ ...options, stream: false }),
    });
    if (!res.ok) {
      throw new Error(`local TTS inference failed: ${res.status} ${await res.text()}`);
    }
    return Buffer.from(await res.arrayBuffer());
  }

  async *synthesizeStream(options: TTSSynthesizeOptions): AsyncIterable<Buffer> {
    const res = await fetch(`${this.config.baseUrl}/tts/synthesize`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({ ...options, stream: true }),
    });
    if (!res.ok || !res.body) {
      throw new Error(`local TTS streaming inference failed: ${res.status} ${await res.text()}`);
    }
    const reader = res.body.getReader();
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      yield Buffer.from(value);
    }
  }
}
