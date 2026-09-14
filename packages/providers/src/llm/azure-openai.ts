import { AzureOpenAI } from "openai";
import type { LLMChatOptions, LLMChatResult, LLMChatChunk, LLMProvider } from "./types.js";
import { toOpenAIMessages, toOpenAITools, fromOpenAIToolCalls } from "./openai-shared.js";

export interface AzureOpenAIConfig {
  apiKey: string;
  endpoint: string;
  apiVersion?: string;
}

export class AzureOpenAILLMProvider implements LLMProvider {
  readonly name = "azure-openai";
  private readonly client: AzureOpenAI;

  constructor(config: AzureOpenAIConfig) {
    this.client = new AzureOpenAI({
      apiKey: config.apiKey,
      endpoint: config.endpoint,
      apiVersion: config.apiVersion ?? "2024-08-01-preview",
    });
  }

  async chat(options: LLMChatOptions): Promise<LLMChatResult> {
    const response = await this.client.chat.completions.create({
      model: options.model,
      messages: toOpenAIMessages(options.messages),
      temperature: options.temperature,
      max_tokens: options.maxTokens,
      tools: toOpenAITools(options.tools),
    });

    const message = response.choices[0]?.message;
    return {
      text: message?.content ?? "",
      toolCalls: fromOpenAIToolCalls(message?.tool_calls),
      usage: {
        promptTokens: response.usage?.prompt_tokens ?? 0,
        completionTokens: response.usage?.completion_tokens ?? 0,
      },
    };
  }

  async *chatStream(options: LLMChatOptions): AsyncIterable<LLMChatChunk> {
    const stream = await this.client.chat.completions.create({
      model: options.model,
      messages: toOpenAIMessages(options.messages),
      temperature: options.temperature,
      max_tokens: options.maxTokens,
      tools: toOpenAITools(options.tools),
      stream: true,
    });

    for await (const part of stream) {
      const delta = part.choices[0]?.delta?.content ?? "";
      const done = part.choices[0]?.finish_reason != null;
      if (delta || done) {
        yield { delta, done };
      }
    }
  }
}
