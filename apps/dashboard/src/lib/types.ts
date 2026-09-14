export interface AgentProviderConfig {
  llm: {
    provider: "openai" | "azure-openai" | "local";
    model: string;
    temperature?: number;
    systemPrompt: string;
  };
  stt: {
    provider: "openai" | "deepgram" | "azure" | "local";
    model?: string;
    language?: string;
  };
  tts: {
    provider: "openai" | "elevenlabs" | "cartesia" | "azure" | "local";
    voiceId: string;
    model?: string;
  };
  vad: {
    silenceTimeoutMs: number;
    minSpeechMs: number;
  };
}

export interface Agent {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  provider_config: AgentProviderConfig;
  rag_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface AgentFormValues {
  name: string;
  description?: string;
  providerConfig: AgentProviderConfig;
  ragEnabled: boolean;
}

export const DEFAULT_PROVIDER_CONFIG: AgentProviderConfig = {
  llm: {
    provider: "openai",
    model: "gpt-4o-mini",
    temperature: 0.7,
    systemPrompt: "Sei un assistente vocale utile, cordiale e conciso.",
  },
  stt: {
    provider: "openai",
    model: "whisper-1",
    language: "it",
  },
  tts: {
    provider: "openai",
    voiceId: "alloy",
    model: "tts-1",
  },
  vad: {
    silenceTimeoutMs: 800,
    minSpeechMs: 150,
  },
};
