export type UsageEventKind = "llm" | "stt" | "tts";

export interface UsageEvent {
  id: string;
  organizationId: string;
  agentId: string;
  conversationId: string | null;
  kind: UsageEventKind;
  provider: string;
  model: string | null;
  unit: "tokens" | "audio_seconds";
  quantity: number;
  estimatedCostUsd: number;
  createdAt: string;
}
