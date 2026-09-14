import { z } from "zod";

export const createOrganizationSchema = z.object({
  name: z.string().min(1).max(200),
});

export const createApiKeySchema = z.object({
  name: z.string().min(1).max(200),
});

export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>;
export type CreateApiKeyInput = z.infer<typeof createApiKeySchema>;
