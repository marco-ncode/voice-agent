import type { SupabaseClient } from "@supabase/supabase-js";
import { McpServerClient, type ToolDefinition } from "@v-agent/providers";
import type { AgentToolKind, CustomApiToolConfig, McpServerToolConfig } from "@v-agent/shared";

export interface ExecutableTool {
  agentToolId: string;
  requiresConfirmation: boolean;
  definition: ToolDefinition;
  execute: (args: Record<string, unknown>) => Promise<string>;
}

interface AgentToolRow {
  id: string;
  name: string;
  description: string;
  kind: AgentToolKind;
  requires_confirmation: boolean;
  config: McpServerToolConfig | CustomApiToolConfig;
}

const MAX_RESULT_CHARS = 4_000;

/**
 * Loads every enabled tool configured for an agent, ready to be handed to
 * the LLM as function-calling definitions and invoked by name. MCP servers
 * are discovered live (their tool list can change) and kept connected for
 * the lifetime of this executor; call dispose() once the turn is done.
 */
export class ToolExecutor {
  private readonly mcpClients: McpServerClient[] = [];
  private tools: ExecutableTool[] = [];

  constructor(private readonly db: SupabaseClient) {}

  async loadForAgent(agentId: string): Promise<ToolDefinition[]> {
    const { data, error } = await this.db
      .from("agent_tools")
      .select("id, name, description, kind, requires_confirmation, config")
      .eq("agent_id", agentId)
      .eq("enabled", true);
    if (error) throw new Error(`Failed to load agent tools: ${error.message}`);

    const rows = data as AgentToolRow[];
    const tools: ExecutableTool[] = [];

    for (const row of rows) {
      if (row.kind === "custom_api") {
        const apiConfig = row.config as CustomApiToolConfig;
        tools.push({
          agentToolId: row.id,
          requiresConfirmation: row.requires_confirmation,
          definition: {
            name: sanitizeToolName(row.name),
            description: row.description,
            parameters: apiConfig.parametersSchema,
          },
          execute: (args) => callCustomApiTool(apiConfig, args),
        });
        continue;
      }

      const mcpConfig = row.config as McpServerToolConfig;
      const client = new McpServerClient(mcpConfig);
      this.mcpClients.push(client);

      const mcpTools = await client.listTools();
      for (const mcpTool of mcpTools) {
        const qualifiedName = `${sanitizeToolName(row.name)}__${sanitizeToolName(mcpTool.name)}`;
        tools.push({
          agentToolId: row.id,
          requiresConfirmation: row.requires_confirmation,
          definition: {
            name: qualifiedName,
            description: mcpTool.description || `${mcpTool.name} (server MCP: ${row.name})`,
            parameters: mcpTool.inputSchema,
          },
          execute: (args) => client.callTool(mcpTool.name, args),
        });
      }
    }

    this.tools = tools;
    return tools.map((tool) => tool.definition);
  }

  findTool(name: string): ExecutableTool | undefined {
    return this.tools.find((tool) => tool.definition.name === name);
  }

  /**
   * Used by flow "tool_call" nodes, which reference a tool by its
   * agent_tools row id rather than the LLM-facing qualified name. When
   * that row is an MCP server exposing several sub-tools, `rawToolName`
   * (the tool's own name on that server, not yet qualified) disambiguates
   * which one; omit it when the row has exactly one tool (custom_api
   * always does).
   */
  findToolByAgentToolId(agentToolId: string, rawToolName?: string): ExecutableTool | undefined {
    const candidates = this.tools.filter((tool) => tool.agentToolId === agentToolId);
    if (candidates.length <= 1 || !rawToolName) return candidates[0];
    return (
      candidates.find((tool) => tool.definition.name.endsWith(`__${sanitizeToolName(rawToolName)}`)) ??
      candidates[0]
    );
  }

  async dispose(): Promise<void> {
    await Promise.all(this.mcpClients.map((client) => client.close()));
  }
}

/**
 * Executes a single tool call outside the normal conversation loop — used
 * when a human approves a tool_call_requests row that was queued because
 * the tool required confirmation. Re-discovers the MCP server's tools (if
 * applicable) to resolve the qualified name back to the server's own tool
 * name, rather than persisting that mapping separately.
 */
export async function executeApprovedTool(
  db: SupabaseClient,
  agentToolId: string,
  toolName: string,
  args: Record<string, unknown>,
): Promise<string> {
  const { data, error } = await db
    .from("agent_tools")
    .select("id, name, kind, config")
    .eq("id", agentToolId)
    .maybeSingle();
  if (error || !data) throw new Error("agent_tool_not_found");

  const row = data as {
    id: string;
    name: string;
    kind: AgentToolKind;
    config: McpServerToolConfig | CustomApiToolConfig;
  };

  if (row.kind === "custom_api") {
    return callCustomApiTool(row.config as CustomApiToolConfig, args);
  }

  const mcpConfig = row.config as McpServerToolConfig;
  const client = new McpServerClient(mcpConfig);
  try {
    const tools = await client.listTools();
    const match = tools.find(
      (tool) => `${sanitizeToolName(row.name)}__${sanitizeToolName(tool.name)}` === toolName,
    );
    if (!match) throw new Error(`tool_not_found_on_server: ${toolName}`);
    return await client.callTool(match.name, args);
  } finally {
    await client.close();
  }
}

function sanitizeToolName(name: string): string {
  return name.trim().replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 60);
}

async function callCustomApiTool(
  config: CustomApiToolConfig,
  args: Record<string, unknown>,
): Promise<string> {
  const url = new URL(config.url);
  const headers: Record<string, string> = { ...config.headers };
  let body: string | undefined;

  if (config.method === "GET" || config.method === "DELETE") {
    for (const [key, value] of Object.entries(args)) {
      url.searchParams.set(key, String(value));
    }
  } else {
    headers["Content-Type"] ??= "application/json";
    body = JSON.stringify(args);
  }

  const res = await fetch(url, { method: config.method, headers, body });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Tool call failed: ${res.status} ${text.slice(0, 500)}`);
  }
  return text.slice(0, MAX_RESULT_CHARS);
}
