import { createHash } from "node:crypto";
import type { FastifyRequest, FastifyReply } from "fastify";
import type { SupabaseClient } from "@supabase/supabase-js";

declare module "fastify" {
  interface FastifyRequest {
    organizationId?: string;
  }
}

export function hashApiKey(rawKey: string): string {
  return createHash("sha256").update(rawKey).digest("hex");
}

/**
 * Verifies the `Authorization: Bearer <api-key>` header against api_keys
 * and attaches the resolved organizationId to the request. Used as a
 * preHandler on every route under /v1 that is meant to be called by
 * external systems (SIP gateways, CRMs, etc.).
 */
export function createApiKeyAuth(db: SupabaseClient) {
  return async function apiKeyAuth(request: FastifyRequest, reply: FastifyReply) {
    const header = request.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      return reply.code(401).send({ error: "missing_api_key" });
    }
    const rawKey = header.slice("Bearer ".length);
    const hashedKey = hashApiKey(rawKey);

    const { data, error } = await db
      .from("api_keys")
      .select("organization_id, revoked_at")
      .eq("hashed_key", hashedKey)
      .maybeSingle();

    if (error || !data || data.revoked_at) {
      return reply.code(401).send({ error: "invalid_api_key" });
    }

    request.organizationId = data.organization_id;
  };
}
