export type AgentToolKind = "mcp_server" | "custom_api";

export interface McpServerToolConfig {
  url: string;
  headers?: Record<string, string>;
}

export interface CustomApiToolConfig {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  url: string;
  headers?: Record<string, string>;
  /** JSON Schema describing the arguments the LLM must supply. */
  parametersSchema: Record<string, unknown>;
}

export interface AgentTool {
  id: string;
  agentId: string;
  organizationId: string;
  name: string;
  description: string;
  kind: AgentToolKind;
  enabled: boolean;
  requiresConfirmation: boolean;
  config: McpServerToolConfig | CustomApiToolConfig;
  createdAt: string;
  updatedAt: string;
}

export type ToolCallRequestStatus = "pending" | "approved" | "rejected" | "executed" | "failed";

export interface ToolCallRequest {
  id: string;
  organizationId: string;
  agentId: string;
  agentToolId: string;
  conversationId: string | null;
  toolName: string;
  arguments: Record<string, unknown>;
  status: ToolCallRequestStatus;
  result: unknown;
  createdAt: string;
  decidedAt: string | null;
}
