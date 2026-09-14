import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import dotenv from "dotenv";

// Resolve the monorepo root .env by file location, not process.cwd(): pnpm
// --filter (used by `pnpm dev:api`) runs this with cwd set to apps/api, so
// the bare `dotenv/config` default would silently miss the root .env.
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "../../../.env") });

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export const config = {
  port: Number(process.env.API_PORT ?? 8080),
  supabase: {
    url: required("SUPABASE_URL"),
    serviceRoleKey: required("SUPABASE_SERVICE_ROLE_KEY"),
  },
  providers: {
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    AZURE_OPENAI_API_KEY: process.env.AZURE_OPENAI_API_KEY,
    AZURE_OPENAI_ENDPOINT: process.env.AZURE_OPENAI_ENDPOINT,
    DEEPGRAM_API_KEY: process.env.DEEPGRAM_API_KEY,
    AZURE_SPEECH_KEY: process.env.AZURE_SPEECH_KEY,
    AZURE_SPEECH_REGION: process.env.AZURE_SPEECH_REGION,
    ELEVENLABS_API_KEY: process.env.ELEVENLABS_API_KEY,
    CARTESIA_API_KEY: process.env.CARTESIA_API_KEY,
    INFERENCE_SERVICE_URL: process.env.INFERENCE_SERVICE_URL,
    INFERENCE_SERVICE_API_KEY: process.env.INFERENCE_SERVICE_API_KEY,
  },
};
