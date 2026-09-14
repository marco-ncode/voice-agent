import type { TTSProvider, TTSSynthesizeOptions } from "./types.js";

export class ElevenLabsTTSProvider implements TTSProvider {
  readonly name = "elevenlabs";
  constructor(private readonly apiKey: string) {}

  async synthesize(options: TTSSynthesizeOptions): Promise<Buffer> {
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${options.voiceId}`, {
      method: "POST",
      headers: {
        "xi-api-key": this.apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: options.text,
        model_id: options.model ?? "eleven_turbo_v2_5",
      }),
    });
    if (!res.ok) {
      throw new Error(`ElevenLabs synthesis failed: ${res.status} ${await res.text()}`);
    }
    return Buffer.from(await res.arrayBuffer());
  }

  async *synthesizeStream(options: TTSSynthesizeOptions): AsyncIterable<Buffer> {
    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${options.voiceId}/stream`,
      {
        method: "POST",
        headers: {
          "xi-api-key": this.apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: options.text,
          model_id: options.model ?? "eleven_turbo_v2_5",
        }),
      },
    );
    if (!res.ok || !res.body) {
      throw new Error(`ElevenLabs streaming synthesis failed: ${res.status} ${await res.text()}`);
    }
    const reader = res.body.getReader();
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      yield Buffer.from(value);
    }
  }
}
