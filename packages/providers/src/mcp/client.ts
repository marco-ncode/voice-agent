import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

export interface McpServerConfig {
  url: string;
  headers?: Record<string, string>;
}

export interface McpToolDescriptor {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

/**
 * Thin wrapper around the official MCP SDK for a single remote MCP server,
 * connected over Streamable HTTP (the standard transport for MCP servers
 * reachable over the network, as opposed to a local stdio subprocess).
 */
export class McpServerClient {
  private client: Client | null = null;

  constructor(private readonly config: McpServerConfig) {}

  private async connect(): Promise<Client> {
    if (this.client) return this.client;

    const transport = new StreamableHTTPClientTransport(new URL(this.config.url), {
      requestInit: this.config.headers ? { headers: this.config.headers } : undefined,
    });
    const client = new Client({ name: "v-agent", version: "0.1.0" });
    await client.connect(transport);
    this.client = client;
    return client;
  }

  async listTools(): Promise<McpToolDescriptor[]> {
    const client = await this.connect();
    const { tools } = await client.listTools();
    return tools.map((tool) => ({
      name: tool.name,
      description: tool.description ?? "",
      inputSchema: tool.inputSchema,
    }));
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<string> {
    const client = await this.connect();
    const result = await client.callTool({ name, arguments: args });
    const content = result.content as Array<{ type: string; text?: string }>;
    return content
      .filter((item) => item.type === "text" && item.text)
      .map((item) => item.text)
      .join("\n");
  }

  async close(): Promise<void> {
    await this.client?.close();
    this.client = null;
  }
}
