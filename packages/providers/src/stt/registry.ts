import type { STTProviderName } from "@v-agent/shared";
import type { STTProvider } from "./types.js";
import { OpenAISTTProvider } from "./openai.js";
import { DeepgramSTTProvider } from "./deepgram.js";
import { AzureSTTProvider } from "./azure.js";
import { LocalSTTProvider } from "./local.js";

export interface STTProviderEnv {
  OPENAI_API_KEY?: string;
  DEEPGRAM_API_KEY?: string;
  AZURE_SPEECH_KEY?: string;
  AZURE_SPEECH_REGION?: string;
  INFERENCE_SERVICE_URL?: string;
  INFERENCE_SERVICE_API_KEY?: string;
}

export function createSTTProvider(name: STTProviderName, env: STTProviderEnv): STTProvider {
  switch (name) {
    case "openai": {
      if (!env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not configured");
      return new OpenAISTTProvider(env.OPENAI_API_KEY);
    }
    case "deepgram": {
      if (!env.DEEPGRAM_API_KEY) throw new Error("DEEPGRAM_API_KEY is not configured");
      return new DeepgramSTTProvider(env.DEEPGRAM_API_KEY);
    }
    case "azure": {
      if (!env.AZURE_SPEECH_KEY || !env.AZURE_SPEECH_REGION) {
        throw new Error("AZURE_SPEECH_KEY / AZURE_SPEECH_REGION are not configured");
      }
      return new AzureSTTProvider({ key: env.AZURE_SPEECH_KEY, region: env.AZURE_SPEECH_REGION });
    }
    case "local": {
      if (!env.INFERENCE_SERVICE_URL || !env.INFERENCE_SERVICE_API_KEY) {
        throw new Error("INFERENCE_SERVICE_URL / INFERENCE_SERVICE_API_KEY are not configured");
      }
      return new LocalSTTProvider({
        baseUrl: env.INFERENCE_SERVICE_URL,
        apiKey: env.INFERENCE_SERVICE_API_KEY,
      });
    }
    default:
      throw new Error(`Unknown STT provider: ${name satisfies never}`);
  }
}
