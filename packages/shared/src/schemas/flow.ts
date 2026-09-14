import { z } from "zod";

export const conditionOperatorSchema = z.enum([
  "equals",
  "not_equals",
  "contains",
  "gt",
  "gte",
  "lt",
  "lte",
  "is_set",
  "is_not_set",
]);

export const conditionBranchSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  variable: z.string().min(1),
  operator: conditionOperatorSchema,
  value: z.union([z.string(), z.number(), z.boolean()]).optional(),
});

export const flowNodeKindSchema = z.enum([
  "start",
  "message",
  "condition",
  "extract_variable",
  "tool_call",
  "transfer",
  "end",
]);

export const flowNodeDataSchema = z.object({
  instruction: z.string().optional(),
  waitForUserReply: z.boolean().optional(),
  branches: z.array(conditionBranchSchema).optional(),
  variable: z.string().optional(),
  description: z.string().optional(),
  variableType: z.enum(["string", "number", "boolean"]).optional(),
  agentToolId: z.string().optional(),
  toolName: z.string().optional(),
  message: z.string().optional(),
  destination: z.string().optional(),
});

export const flowNodeSchema = z.object({
  id: z.string().min(1),
  kind: flowNodeKindSchema,
  position: z.object({ x: z.number(), y: z.number() }),
  data: flowNodeDataSchema,
});

export const flowEdgeSchema = z.object({
  id: z.string().min(1),
  source: z.string().min(1),
  sourceHandle: z.string().optional(),
  target: z.string().min(1),
});

export const agentFlowSchema = z.object({
  nodes: z.array(flowNodeSchema),
  edges: z.array(flowEdgeSchema),
  enabled: z.boolean().default(true),
});

export type AgentFlowInput = z.infer<typeof agentFlowSchema>;
