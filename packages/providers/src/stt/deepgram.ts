import WebSocket from "ws";
import type { STTProvider, STTTranscribeOptions, STTTranscript } from "./types.js";

export class DeepgramSTTProvider implements STTProvider {
  readonly name = "deepgram";
  constructor(private readonly apiKey: string) {}

  async transcribe(options: STTTranscribeOptions): Promise<STTTranscript> {
    const params = new URLSearchParams({
      model: options.model ?? "nova-2",
      ...(options.language ? { language: options.language } : {}),
    });
    const res = await fetch(`https://api.deepgram.com/v1/listen?${params.toString()}`, {
      method: "POST",
      headers: {
        Authorization: `Token ${this.apiKey}`,
        "Content-Type": options.mimeType,
      },
      body: options.audio,
    });
    if (!res.ok) {
      throw new Error(`Deepgram transcription failed: ${res.status} ${await res.text()}`);
    }
    const data = (await res.json()) as {
      metadata: { duration: number };
      results: { channels: Array<{ alternatives: Array<{ transcript: string }> }> };
    };
    return {
      text: data.results.channels[0]?.alternatives[0]?.transcript ?? "",
      isFinal: true,
      audioSeconds: data.metadata.duration,
    };
  }

  async *transcribeStream(
    audioChunks: AsyncIterable<Buffer>,
    options: { language?: string; model?: string },
  ): AsyncIterable<STTTranscript> {
    const params = new URLSearchParams({
      model: options.model ?? "nova-2",
      encoding: "linear16",
      sample_rate: "16000",
      interim_results: "true",
      ...(options.language ? { language: options.language } : {}),
    });
    const ws = new WebSocket(`wss://api.deepgram.com/v1/listen?${params.toString()}`, {
      headers: { Authorization: `Token ${this.apiKey}` },
    });

    const results: STTTranscript[] = [];
    let resolveNext: (() => void) | null = null;
    let closed = false;

    ws.on("message", (raw) => {
      const msg = JSON.parse(raw.toString()) as {
        channel?: { alternatives: Array<{ transcript: string }> };
        is_final?: boolean;
        duration?: number;
      };
      const text = msg.channel?.alternatives[0]?.transcript;
      if (text) {
        results.push({ text, isFinal: Boolean(msg.is_final), audioSeconds: msg.duration ?? 0 });
        resolveNext?.();
      }
    });
    ws.on("close", () => {
      closed = true;
      resolveNext?.();
    });

    await new Promise<void>((resolve, reject) => {
      ws.once("open", () => resolve());
      ws.once("error", reject);
    });

    void (async () => {
      for await (const chunk of audioChunks) {
        ws.send(chunk);
      }
      ws.send(JSON.stringify({ type: "CloseStream" }));
    })();

    while (!closed || results.length > 0) {
      if (results.length === 0) {
        await new Promise<void>((resolve) => {
          resolveNext = resolve;
        });
        continue;
      }
      const next = results.shift();
      if (next) yield next;
    }
  }
}
