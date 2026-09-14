import type { TTSProviderName } from "@v-agent/shared";
import type { TTSProvider } from "./types.js";
import { OpenAITTSProvider } from "./openai.js";
import { ElevenLabsTTSProvider } from "./elevenlabs.js";
import { CartesiaTTSProvider } from "./cartesia.js";
import { AzureTTSProvider } from "./azure.js";
import { LocalTTSProvider } from "./local.js";

export interface TTSProviderEnv {
  OPENAI_API_KEY?: string;
  ELEVENLABS_API_KEY?: string;
  CARTESIA_API_KEY?: string;
  AZURE_SPEECH_KEY?: string;
  AZURE_SPEECH_REGION?: string;
  INFERENCE_SERVICE_URL?: string;
  INFERENCE_SERVICE_API_KEY?: string;
}

export function createTTSProvider(name: TTSProviderName, env: TTSProviderEnv): TTSProvider {
  switch (name) {
    case "openai": {
      if (!env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not configured");
      return new OpenAITTSProvider(env.OPENAI_API_KEY);
    }
    case "elevenlabs": {
      if (!env.ELEVENLABS_API_KEY) throw new Error("ELEVENLABS_API_KEY is not configured");
      return new ElevenLabsTTSProvider(env.ELEVENLABS_API_KEY);
    }
    case "cartesia": {
      if (!env.CARTESIA_API_KEY) throw new Error("CARTESIA_API_KEY is not configured");
      return new CartesiaTTSProvider(env.CARTESIA_API_KEY);
    }
    case "azure": {
      if (!env.AZURE_SPEECH_KEY || !env.AZURE_SPEECH_REGION) {
        throw new Error("AZURE_SPEECH_KEY / AZURE_SPEECH_REGION are not configured");
      }
      return new AzureTTSProvider({ key: env.AZURE_SPEECH_KEY, region: env.AZURE_SPEECH_REGION });
    }
    case "local": {
      if (!env.INFERENCE_SERVICE_URL || !env.INFERENCE_SERVICE_API_KEY) {
        throw new Error("INFERENCE_SERVICE_URL / INFERENCE_SERVICE_API_KEY are not configured");
      }
      return new LocalTTSProvider({
        baseUrl: env.INFERENCE_SERVICE_URL,
        apiKey: env.INFERENCE_SERVICE_API_KEY,
      });
    }
    default:
      throw new Error(`Unknown TTS provider: ${name satisfies never}`);
  }
}
