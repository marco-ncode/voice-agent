import type OpenAI from "openai";
import type { LLMMessage, ToolCall, ToolDefinition } from "./types.js";

/** Converts our provider-agnostic messages to the OpenAI chat.completions shape. */
export function toOpenAIMessages(messages: LLMMessage[]): OpenAI.Chat.ChatCompletionMessageParam[] {
  return messages.map((message) => {
    if (message.role === "tool") {
      return {
        role: "tool",
        content: message.content,
        tool_call_id: message.toolCallId ?? "",
      };
    }
    if (message.role === "assistant" && message.toolCalls?.length) {
      return {
        role: "assistant",
        content: message.content || null,
        tool_calls: message.toolCalls.map((call) => ({
          id: call.id,
          type: "function" as const,
          function: { name: call.name, arguments: JSON.stringify(call.arguments) },
        })),
      };
    }
    return { role: message.role, content: message.content };
  });
}

export function toOpenAITools(
  tools: ToolDefinition[] | undefined,
): OpenAI.Chat.ChatCompletionTool[] | undefined {
  if (!tools?.length) return undefined;
  return tools.map((tool) => ({
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    },
  }));
}

export function fromOpenAIToolCalls(
  toolCalls: OpenAI.Chat.ChatCompletionMessageToolCall[] | undefined,
): ToolCall[] | undefined {
  if (!toolCalls?.length) return undefined;
  return toolCalls.map((call) => ({
    id: call.id,
    name: call.function.name,
    arguments: safeParseJsonObject(call.function.arguments),
  }));
}

function safeParseJsonObject(raw: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}
