import { z } from "zod";

export const mcpServerToolConfigSchema = z.object({
  url: z.string().url(),
  headers: z.record(z.string()).optional(),
});

export const customApiToolConfigSchema = z.object({
  method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]),
  url: z.string().url(),
  headers: z.record(z.string()).optional(),
  parametersSchema: z.record(z.unknown()),
});

export const createAgentToolSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("mcp_server"),
    name: z.string().min(1).max(200),
    description: z.string().max(2000).default(""),
    enabled: z.boolean().default(true),
    requiresConfirmation: z.boolean().default(false),
    config: mcpServerToolConfigSchema,
  }),
  z.object({
    kind: z.literal("custom_api"),
    name: z.string().min(1).max(200),
    description: z.string().max(2000).default(""),
    enabled: z.boolean().default(true),
    requiresConfirmation: z.boolean().default(false),
    config: customApiToolConfigSchema,
  }),
]);

export const updateAgentToolSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  enabled: z.boolean().optional(),
  requiresConfirmation: z.boolean().optional(),
  config: z.union([mcpServerToolConfigSchema, customApiToolConfigSchema]).optional(),
});

export type CreateAgentToolInput = z.infer<typeof createAgentToolSchema>;
export type UpdateAgentToolInput = z.infer<typeof updateAgentToolSchema>;
