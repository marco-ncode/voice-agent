import type { LLMProviderName } from "@v-agent/shared";
import type { LLMProvider } from "./types.js";
import { OpenAILLMProvider } from "./openai.js";
import { AzureOpenAILLMProvider } from "./azure-openai.js";
import { LocalLLMProvider } from "./local.js";

export interface LLMProviderEnv {
  OPENAI_API_KEY?: string;
  AZURE_OPENAI_API_KEY?: string;
  AZURE_OPENAI_ENDPOINT?: string;
  INFERENCE_SERVICE_URL?: string;
  INFERENCE_SERVICE_API_KEY?: string;
}

export function createLLMProvider(name: LLMProviderName, env: LLMProviderEnv): LLMProvider {
  switch (name) {
    case "openai": {
      if (!env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not configured");
      return new OpenAILLMProvider(env.OPENAI_API_KEY);
    }
    case "azure-openai": {
      if (!env.AZURE_OPENAI_API_KEY || !env.AZURE_OPENAI_ENDPOINT) {
        throw new Error("AZURE_OPENAI_API_KEY / AZURE_OPENAI_ENDPOINT are not configured");
      }
      return new AzureOpenAILLMProvider({
        apiKey: env.AZURE_OPENAI_API_KEY,
        endpoint: env.AZURE_OPENAI_ENDPOINT,
      });
    }
    case "local": {
      if (!env.INFERENCE_SERVICE_URL || !env.INFERENCE_SERVICE_API_KEY) {
        throw new Error("INFERENCE_SERVICE_URL / INFERENCE_SERVICE_API_KEY are not configured");
      }
      return new LocalLLMProvider({
        baseUrl: env.INFERENCE_SERVICE_URL,
        apiKey: env.INFERENCE_SERVICE_API_KEY,
      });
    }
    default:
      throw new Error(`Unknown LLM provider: ${name satisfies never}`);
  }
}
