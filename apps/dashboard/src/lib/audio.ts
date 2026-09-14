/**
 * Captures microphone audio and downsamples it to 16kHz mono PCM16LE — the
 * format the backend's STT providers and VAD expect (see
 * apps/api/src/services/audio.ts). Uses ScriptProcessorNode: deprecated but
 * universally supported and simple enough for the playground's needs.
 */
export class MicRecorder {
  private audioContext: AudioContext | null = null;
  private processor: ScriptProcessorNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private stream: MediaStream | null = null;
  private samples: number[] = [];

  async start(): Promise<void> {
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.audioContext = new AudioContext();
    this.source = this.audioContext.createMediaStreamSource(this.stream);
    this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);
    this.samples = [];

    const inputSampleRate = this.audioContext.sampleRate;
    this.processor.onaudioprocess = (event) => {
      const input = event.inputBuffer.getChannelData(0);
      this.samples.push(...downsample(input, inputSampleRate, 16_000));
    };

    // Route through a silent gain node so capture doesn't cause audible
    // mic-to-speaker feedback while still keeping the processor "connected"
    // (required by the Web Audio API for onaudioprocess to fire).
    const silentGain = this.audioContext.createGain();
    silentGain.gain.value = 0;
    this.source.connect(this.processor);
    this.processor.connect(silentGain);
    silentGain.connect(this.audioContext.destination);
  }

  /** Stops capture and returns the recorded utterance as base64 PCM16LE. */
  stop(): string {
    this.processor?.disconnect();
    this.source?.disconnect();
    this.stream?.getTracks().forEach((track) => track.stop());
    void this.audioContext?.close();

    const pcm16 = new Int16Array(this.samples.length);
    for (let i = 0; i < this.samples.length; i++) {
      const sample = Math.max(-1, Math.min(1, this.samples[i]!));
      pcm16[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
    }
    return arrayBufferToBase64(new Uint8Array(pcm16.buffer));
  }
}

function downsample(input: Float32Array, inputRate: number, outputRate: number): number[] {
  if (inputRate === outputRate) return Array.from(input);
  const ratio = inputRate / outputRate;
  const outputLength = Math.round(input.length / ratio);
  const output = new Array<number>(outputLength);
  for (let i = 0; i < outputLength; i++) {
    output[i] = input[Math.floor(i * ratio)]!;
  }
  return output;
}

function arrayBufferToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
  return window.btoa(binary);
}
