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
    language?: string;
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

export interface AgentDocument {
  id: string;
  title: string;
  sourceUrl: string | null;
  createdAt: string;
  chunkCount: number;
}

export type AgentToolKind = "mcp_server" | "custom_api";

export interface McpServerToolConfig {
  url: string;
  headers?: Record<string, string>;
}

export interface CustomApiToolConfig {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  url: string;
  headers?: Record<string, string>;
  parametersSchema: Record<string, unknown>;
}

export interface AgentTool {
  id: string;
  agent_id: string;
  organization_id: string;
  name: string;
  description: string;
  kind: AgentToolKind;
  enabled: boolean;
  requires_confirmation: boolean;
  config: McpServerToolConfig | CustomApiToolConfig;
  created_at: string;
  updated_at: string;
}

export type ToolCallRequestStatus = "pending" | "approved" | "rejected" | "executed" | "failed";

export interface ToolCallRequest {
  id: string;
  agent_id: string;
  agent_tool_id: string;
  tool_name: string;
  arguments: Record<string, unknown>;
  status: ToolCallRequestStatus;
  result: unknown;
  created_at: string;
  decided_at: string | null;
  agents: { name: string } | null;
  agent_tools: { name: string } | null;
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
