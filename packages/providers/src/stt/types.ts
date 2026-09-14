export interface STTTranscribeOptions {
  audio: Buffer;
  mimeType: string;
  language?: string;
  model?: string;
}

export interface STTTranscript {
  text: string;
  isFinal: boolean;
  audioSeconds: number;
}

export interface STTProvider {
  readonly name: string;
  /** One-shot transcription of a fully buffered audio segment. */
  transcribe(options: STTTranscribeOptions): Promise<STTTranscript>;
  /**
   * Streaming transcription: consumes an async iterable of raw PCM/opus chunks
   * and yields partial + final transcripts as they become available.
   */
  transcribeStream(
    audioChunks: AsyncIterable<Buffer>,
    options: { language?: string; model?: string },
  ): AsyncIterable<STTTranscript>;
}
