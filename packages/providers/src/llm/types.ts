export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolDefinition {
  name: string;
  description: string;
  /** JSON Schema for the tool's arguments. */
  parameters: Record<string, unknown>;
}

export interface LLMMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  /** Set on an assistant message that requested tool calls instead of (or alongside) text. */
  toolCalls?: ToolCall[];
  /** Set on a "tool" message: which call this is the result of. */
  toolCallId?: string;
  /** Set on a "tool" message: the tool's name, for providers that want it alongside toolCallId. */
  name?: string;
}

export interface LLMChatOptions {
  model: string;
  messages: LLMMessage[];
  temperature?: number;
  maxTokens?: number;
  tools?: ToolDefinition[];
}

export interface LLMChatChunk {
  delta: string;
  done: boolean;
}

export interface LLMUsage {
  promptTokens: number;
  completionTokens: number;
}

export interface LLMChatResult {
  text: string;
  usage: LLMUsage;
  toolCalls?: ToolCall[];
}

export interface LLMProvider {
  readonly name: string;
  chat(options: LLMChatOptions): Promise<LLMChatResult>;
  chatStream(options: LLMChatOptions): AsyncIterable<LLMChatChunk>;
}
