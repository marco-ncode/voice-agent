export type LLMProviderName = "openai" | "azure-openai" | "local";
export type STTProviderName = "openai" | "deepgram" | "azure" | "local";
export type TTSProviderName = "openai" | "elevenlabs" | "cartesia" | "azure" | "local";

export interface AgentProviderConfig {
  llm: {
    provider: LLMProviderName;
    model: string;
    temperature?: number;
    systemPrompt: string;
  };
  stt: {
    provider: STTProviderName;
    model?: string;
    language?: string;
  };
  tts: {
    provider: TTSProviderName;
    voiceId: string;
    model?: string;
    language?: string;
  };
  vad: {
    silenceTimeoutMs: number;
    minSpeechMs: number;
  };
}
