import { z } from "zod";

export const conversationChannelSchema = z.enum(["web", "phone", "api"]);

export const startConversationSchema = z.object({
  agentId: z.string().uuid(),
  channel: conversationChannelSchema,
  metadata: z.record(z.unknown()).default({}),
});

export const appendTurnSchema = z.object({
  role: z.enum(["user", "agent", "tool"]),
  text: z.string().min(1),
  audioUrl: z.string().url().optional(),
});

export type StartConversationInput = z.infer<typeof startConversationSchema>;
export type AppendTurnInput = z.infer<typeof appendTurnSchema>;
