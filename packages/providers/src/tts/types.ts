export interface TTSSynthesizeOptions {
  text: string;
  voiceId: string;
  model?: string;
  /** BCP-47 / ISO language code (e.g. "it", "en"). Support varies by provider; omit for auto-detect. */
  language?: string;
}

export interface TTSProvider {
  readonly name: string;
  /** Returns the full synthesized audio (format documented per-adapter). */
  synthesize(options: TTSSynthesizeOptions): Promise<Buffer>;
  /** Streams audio chunks as they are generated, for lower time-to-first-audio. */
  synthesizeStream(options: TTSSynthesizeOptions): AsyncIterable<Buffer>;
}
