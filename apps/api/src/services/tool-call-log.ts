import type { SupabaseClient } from "@supabase/supabase-js";

export interface ToolCallLogInput {
  organizationId: string;
  agentId: string;
  agentToolId: string;
  conversationId?: string;
  toolName: string;
  arguments: Record<string, unknown>;
}

/** Audit trail for every tool the agent attempted to call, pending or not. */
export class ToolCallLog {
  constructor(private readonly db: SupabaseClient) {}

  async recordPending(input: ToolCallLogInput): Promise<void> {
    await this.insert(input, "pending", null, null);
  }

  async recordExecuted(input: ToolCallLogInput, output: string): Promise<void> {
    await this.insert(input, "executed", { output }, new Date().toISOString());
  }

  async recordFailed(input: ToolCallLogInput, errorMessage: string): Promise<void> {
    await this.insert(input, "failed", { error: errorMessage }, new Date().toISOString());
  }

  private async insert(
    input: ToolCallLogInput,
    status: "pending" | "executed" | "failed",
    result: unknown,
    decidedAt: string | null,
  ): Promise<void> {
    await this.db.from("tool_call_requests").insert({
      organization_id: input.organizationId,
      agent_id: input.agentId,
      agent_tool_id: input.agentToolId,
      conversation_id: input.conversationId ?? null,
      tool_name: input.toolName,
      arguments: input.arguments,
      status,
      result,
      decided_at: decidedAt,
    });
  }
}
