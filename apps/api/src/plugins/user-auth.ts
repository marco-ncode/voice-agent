import type { FastifyRequest, FastifyReply } from "fastify";
import type { SupabaseClient } from "@supabase/supabase-js";

declare module "fastify" {
  interface FastifyRequest {
    userId?: string;
  }
}

/**
 * Verifies a Supabase Auth JWT (dashboard sessions). Used for
 * organization/agent management routes, as opposed to createApiKeyAuth
 * which is used by external systems calling the public API.
 */
export function createUserAuth(db: SupabaseClient) {
  return async function userAuth(request: FastifyRequest, reply: FastifyReply) {
    const header = request.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      return reply.code(401).send({ error: "missing_token" });
    }
    const token = header.slice("Bearer ".length);
    const { data, error } = await db.auth.getUser(token);
    if (error || !data.user) {
      return reply.code(401).send({ error: "invalid_token" });
    }
    request.userId = data.user.id;
  };
}

export async function assertOrgMember(
  db: SupabaseClient,
  organizationId: string,
  userId: string,
): Promise<boolean> {
  const { data } = await db
    .from("organization_members")
    .select("user_id")
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .maybeSingle();
  return data != null;
}
