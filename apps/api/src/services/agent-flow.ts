import type { SupabaseClient } from "@supabase/supabase-js";
import type { AgentFlow, FlowExecutionState } from "@v-agent/shared";

/** Loads the agent's flow only if one exists and is enabled (fallback: free-prompt mode). */
export async function loadEnabledAgentFlow(
  db: SupabaseClient,
  agentId: string,
): Promise<AgentFlow | null> {
  const { data } = await db
    .from("agent_flows")
    .select("nodes, edges, enabled")
    .eq("agent_id", agentId)
    .eq("enabled", true)
    .maybeSingle();
  if (!data) return null;
  return { nodes: data.nodes, edges: data.edges, enabled: data.enabled };
}

/** Resumes flow execution state from a persisted conversation (e.g. a new WS connection picking up a call). */
export async function loadConversationFlowState(
  db: SupabaseClient,
  conversationId: string,
): Promise<FlowExecutionState> {
  const { data } = await db
    .from("conversations")
    .select("current_node_id, variables")
    .eq("id", conversationId)
    .maybeSingle();
  return {
    currentNodeId: data?.current_node_id ?? null,
    variables: (data?.variables as Record<string, unknown>) ?? {},
  };
}
