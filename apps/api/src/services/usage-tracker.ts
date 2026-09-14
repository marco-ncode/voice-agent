import type { SupabaseClient } from "@supabase/supabase-js";
import type { UsageEventKind } from "@v-agent/shared";

// Rough per-unit cost estimates used for the usage dashboard, not for
// actual invoicing. Keep in sync with provider pricing pages.
const COST_PER_UNIT_USD: Record<string, number> = {
  "llm:openai": 0.000005,
  "llm:azure-openai": 0.000005,
  "llm:local": 0,
  "stt:openai": 0.0001,
  "stt:deepgram": 0.0001,
  "stt:azure": 0.0001,
  "stt:local": 0,
  "tts:openai": 0.00003,
  "tts:elevenlabs": 0.00003,
  "tts:cartesia": 0.00002,
  "tts:azure": 0.00002,
  "tts:local": 0,
};

export interface RecordUsageInput {
  organizationId: string;
  agentId: string;
  conversationId?: string;
  kind: UsageEventKind;
  provider: string;
  model?: string;
  unit: "tokens" | "audio_seconds";
  quantity: number;
}

export class UsageTracker {
  constructor(private readonly db: SupabaseClient) {}

  async record(input: RecordUsageInput): Promise<void> {
    const costPerUnit = COST_PER_UNIT_USD[`${input.kind}:${input.provider}`] ?? 0;
    const { error } = await this.db.from("usage_events").insert({
      organization_id: input.organizationId,
      agent_id: input.agentId,
      conversation_id: input.conversationId ?? null,
      kind: input.kind,
      provider: input.provider,
      model: input.model ?? null,
      unit: input.unit,
      quantity: input.quantity,
      estimated_cost_usd: input.quantity * costPerUnit,
    });
    if (error) throw new Error(`Failed to record usage event: ${error.message}`);
  }
}
