import { randomBytes } from "node:crypto";
import type { FastifyInstance } from "fastify";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createApiKeySchema } from "@v-agent/shared";
import { createUserAuth, assertOrgMember } from "../plugins/user-auth.js";
import { hashApiKey } from "../plugins/auth.js";

export function registerApiKeyRoutes(app: FastifyInstance, db: SupabaseClient) {
  const userAuth = createUserAuth(db);

  app.post(
    "/v1/organizations/:organizationId/api-keys",
    { preHandler: userAuth },
    async (request, reply) => {
      const { organizationId } = request.params as { organizationId: string };
      if (!(await assertOrgMember(db, organizationId, request.userId!))) {
        return reply.code(403).send({ error: "not_a_member" });
      }
      const body = createApiKeySchema.parse(request.body);

      const rawKey = `vagent_${randomBytes(24).toString("hex")}`;
      const { data, error } = await db
        .from("api_keys")
        .insert({
          organization_id: organizationId,
          name: body.name,
          key_prefix: rawKey.slice(0, 12),
          hashed_key: hashApiKey(rawKey),
        })
        .select("id, name, key_prefix, created_at")
        .single();
      if (error) return reply.code(500).send({ error: error.message });

      // The raw key is only ever returned once, at creation time.
      return reply.code(201).send({ ...data, key: rawKey });
    },
  );

  app.get(
    "/v1/organizations/:organizationId/api-keys",
    { preHandler: userAuth },
    async (request, reply) => {
      const { organizationId } = request.params as { organizationId: string };
      if (!(await assertOrgMember(db, organizationId, request.userId!))) {
        return reply.code(403).send({ error: "not_a_member" });
      }
      const { data, error } = await db
        .from("api_keys")
        .select("id, name, key_prefix, created_at, revoked_at")
        .eq("organization_id", organizationId);
      if (error) return reply.code(500).send({ error: error.message });
      return reply.send(data);
    },
  );

  app.delete(
    "/v1/organizations/:organizationId/api-keys/:id",
    { preHandler: userAuth },
    async (request, reply) => {
      const { organizationId, id } = request.params as { organizationId: string; id: string };
      if (!(await assertOrgMember(db, organizationId, request.userId!))) {
        return reply.code(403).send({ error: "not_a_member" });
      }
      const { error } = await db
        .from("api_keys")
        .update({ revoked_at: new Date().toISOString() })
        .eq("id", id)
        .eq("organization_id", organizationId);
      if (error) return reply.code(500).send({ error: error.message });
      return reply.code(204).send();
    },
  );
}
