/**
 * Wraps headerless 16-bit PCM audio in a minimal WAV container. Both the
 * VAD-buffered utterances from the realtime WebSocket gateway and the
 * dashboard playground's mic recordings arrive as raw PCM16LE, but STT
 * providers (OpenAI Whisper, Deepgram's pre-recorded endpoint, faster-whisper
 * in services/inference) expect a real audio file, not a bare PCM buffer.
 */
export function pcmToWav(pcm: Buffer, sampleRate = 16_000, channels = 1): Buffer {
  const header = Buffer.alloc(44);
  const byteRate = sampleRate * channels * 2;

  header.write("RIFF", 0, "ascii");
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8, "ascii");
  header.write("fmt ", 12, "ascii");
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(channels * 2, 32); // block align
  header.writeUInt16LE(16, 34); // bits per sample
  header.write("data", 36, "ascii");
  header.writeUInt32LE(pcm.length, 40);

  return Buffer.concat([header, pcm]);
}
