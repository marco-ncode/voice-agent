/**
 * Minimal energy-based voice activity detector over 16kHz mono PCM16LE
 * audio. Tracks speech vs. silence and reports when an utterance is
 * considered complete (speech was heard, then silence persisted for
 * silenceTimeoutMs). Good enough for the MVP; swap for a proper detector
 * (e.g. Silero VAD via services/inference) when barge-in / noisy-environment
 * accuracy becomes a requirement.
 */
export class UtteranceDetector {
  private speaking = false;
  private silenceStartedAt: number | null = null;
  private speechStartedAt: number | null = null;
  private buffer: Buffer[] = [];

  constructor(
    private readonly silenceTimeoutMs: number,
    private readonly minSpeechMs: number,
    private readonly energyThreshold = 500,
  ) {}

  /** Feed one audio chunk; returns the buffered utterance once it's complete. */
  push(chunk: Buffer): Buffer | null {
    const energy = rms(chunk);
    const now = Date.now();
    const isSpeech = energy > this.energyThreshold;

    if (isSpeech) {
      if (!this.speaking) {
        this.speaking = true;
        this.speechStartedAt = now;
      }
      this.silenceStartedAt = null;
      this.buffer.push(chunk);
      return null;
    }

    if (!this.speaking) {
      return null; // silence before any speech started: ignore
    }

    this.buffer.push(chunk);
    this.silenceStartedAt ??= now;

    const speechDuration = now - (this.speechStartedAt ?? now);
    const silenceDuration = now - this.silenceStartedAt;
    if (speechDuration >= this.minSpeechMs && silenceDuration >= this.silenceTimeoutMs) {
      const utterance = Buffer.concat(this.buffer);
      this.reset();
      return utterance;
    }
    return null;
  }

  private reset() {
    this.speaking = false;
    this.silenceStartedAt = null;
    this.speechStartedAt = null;
    this.buffer = [];
  }
}

function rms(buffer: Buffer): number {
  if (buffer.length < 2) return 0;
  let sum = 0;
  const sampleCount = Math.floor(buffer.length / 2);
  for (let i = 0; i < sampleCount * 2; i += 2) {
    const sample = buffer.readInt16LE(i);
    sum += sample * sample;
  }
  return Math.sqrt(sum / sampleCount);
}
