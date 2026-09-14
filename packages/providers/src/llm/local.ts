import type { LLMChatOptions, LLMChatResult, LLMChatChunk, LLMProvider } from "./types.js";

export interface LocalInferenceConfig {
  baseUrl: string;
  apiKey: string;
}

/**
 * Adapter for the self-hosted GPU inference service (services/inference),
 * used for HuggingFace / local models served on dedicated GPU hardware.
 */
export class LocalLLMProvider implements LLMProvider {
  readonly name = "local";
  constructor(private readonly config: LocalInferenceConfig) {}

  async chat(options: LLMChatOptions): Promise<LLMChatResult> {
    const res = await fetch(`${this.config.baseUrl}/llm/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({ ...options, stream: false }),
    });
    if (!res.ok) {
      throw new Error(`local LLM inference failed: ${res.status} ${await res.text()}`);
    }
    const data = (await res.json()) as {
      text: string;
      prompt_tokens: number;
      completion_tokens: number;
    };
    return {
      text: data.text,
      usage: { promptTokens: data.prompt_tokens, completionTokens: data.completion_tokens },
    };
  }

  async *chatStream(options: LLMChatOptions): AsyncIterable<LLMChatChunk> {
    const res = await fetch(`${this.config.baseUrl}/llm/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({ ...options, stream: true }),
    });
    if (!res.ok || !res.body) {
      throw new Error(`local LLM inference failed: ${res.status} ${await res.text()}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.trim()) continue;
        const chunk = JSON.parse(line) as { delta: string; done: boolean };
        yield chunk;
      }
    }
  }
}
