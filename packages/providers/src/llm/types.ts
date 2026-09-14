export interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LLMChatOptions {
  model: string;
  messages: LLMMessage[];
  temperature?: number;
  maxTokens?: number;
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
}

export interface LLMProvider {
  readonly name: string;
  chat(options: LLMChatOptions): Promise<LLMChatResult>;
  chatStream(options: LLMChatOptions): AsyncIterable<LLMChatChunk>;
}
