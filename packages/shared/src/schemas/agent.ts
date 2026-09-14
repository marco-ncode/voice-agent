import { z } from "zod";

export const llmProviderNameSchema = z.enum(["openai", "azure-openai", "local"]);
export const sttProviderNameSchema = z.enum(["openai", "deepgram", "azure", "local"]);
export const ttsProviderNameSchema = z.enum(["openai", "elevenlabs", "cartesia", "azure", "local"]);

export const agentProviderConfigSchema = z.object({
  llm: z.object({
    provider: llmProviderNameSchema,
    model: z.string().min(1),
    temperature: z.number().min(0).max(2).optional(),
    systemPrompt: z.string().min(1),
  }),
  stt: z.object({
    provider: sttProviderNameSchema,
    model: z.string().optional(),
    language: z.string().optional(),
  }),
  tts: z.object({
    provider: ttsProviderNameSchema,
    voiceId: z.string().min(1),
    model: z.string().optional(),
  }),
  vad: z.object({
    silenceTimeoutMs: z.number().int().positive().default(800),
    minSpeechMs: z.number().int().positive().default(150),
  }),
});

export const createAgentSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  providerConfig: agentProviderConfigSchema,
  ragEnabled: z.boolean().default(false),
});

export const updateAgentSchema = createAgentSchema.partial();

export type CreateAgentInput = z.infer<typeof createAgentSchema>;
export type UpdateAgentInput = z.infer<typeof updateAgentSchema>;
