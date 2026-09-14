import type { TTSProvider, TTSSynthesizeOptions } from "./types.js";

export class CartesiaTTSProvider implements TTSProvider {
  readonly name = "cartesia";
  constructor(private readonly apiKey: string) {}

  private buildBody(options: TTSSynthesizeOptions) {
    return {
      model_id: options.model ?? "sonic-english",
      transcript: options.text,
      voice: { mode: "id", id: options.voiceId },
      output_format: { container: "raw", encoding: "pcm_s16le", sample_rate: 16_000 },
    };
  }

  async synthesize(options: TTSSynthesizeOptions): Promise<Buffer> {
    const res = await fetch("https://api.cartesia.ai/tts/bytes", {
      method: "POST",
      headers: {
        "X-API-Key": this.apiKey,
        "Cartesia-Version": "2024-06-10",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(this.buildBody(options)),
    });
    if (!res.ok) {
      throw new Error(`Cartesia synthesis failed: ${res.status} ${await res.text()}`);
    }
    return Buffer.from(await res.arrayBuffer());
  }

  async *synthesizeStream(options: TTSSynthesizeOptions): AsyncIterable<Buffer> {
    const res = await fetch("https://api.cartesia.ai/tts/sse", {
      method: "POST",
      headers: {
        "X-API-Key": this.apiKey,
        "Cartesia-Version": "2024-06-10",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(this.buildBody(options)),
    });
    if (!res.ok || !res.body) {
      throw new Error(`Cartesia streaming synthesis failed: ${res.status} ${await res.text()}`);
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split("\n\n");
      buffer = events.pop() ?? "";
      for (const event of events) {
        const dataLine = event.split("\n").find((line) => line.startsWith("data:"));
        if (!dataLine) continue;
        const payload = JSON.parse(dataLine.slice("data:".length).trim()) as {
          type: string;
          data?: string;
        };
        if (payload.type === "chunk" && payload.data) {
          yield Buffer.from(payload.data, "base64");
        }
      }
    }
  }
}
