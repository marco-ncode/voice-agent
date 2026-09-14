import type { FastifyInstance } from "fastify";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAgentSchema, updateAgentSchema } from "@v-agent/shared";
import { createUserAuth, assertOrgMember } from "../plugins/user-auth.js";

export function registerAgentRoutes(app: FastifyInstance, db: SupabaseClient) {
  const userAuth = createUserAuth(db);

  app.post(
    "/v1/organizations/:organizationId/agents",
    { preHandler: userAuth },
    async (request, reply) => {
      const { organizationId } = request.params as { organizationId: string };
      if (!(await assertOrgMember(db, organizationId, request.userId!))) {
        return reply.code(403).send({ error: "not_a_member" });
      }
      const body = createAgentSchema.parse(request.body);

      const { data, error } = await db
        .from("agents")
        .insert({
          organization_id: organizationId,
          name: body.name,
          description: body.description ?? null,
          provider_config: body.providerConfig,
          rag_enabled: body.ragEnabled,
        })
        .select()
        .single();
      if (error) return reply.code(500).send({ error: error.message });
      return reply.code(201).send(data);
    },
  );

  app.get(
    "/v1/organizations/:organizationId/agents",
    { preHandler: userAuth },
    async (request, reply) => {
      const { organizationId } = request.params as { organizationId: string };
      if (!(await assertOrgMember(db, organizationId, request.userId!))) {
        return reply.code(403).send({ error: "not_a_member" });
      }
      const { data, error } = await db.from("agents").select().eq("organization_id", organizationId);
      if (error) return reply.code(500).send({ error: error.message });
      return reply.send(data);
    },
  );

  app.get(
    "/v1/organizations/:organizationId/agents/:agentId",
    { preHandler: userAuth },
    async (request, reply) => {
      const { organizationId, agentId } = request.params as {
        organizationId: string;
        agentId: string;
      };
      if (!(await assertOrgMember(db, organizationId, request.userId!))) {
        return reply.code(403).send({ error: "not_a_member" });
      }
      const { data, error } = await db
        .from("agents")
        .select()
        .eq("organization_id", organizationId)
        .eq("id", agentId)
        .maybeSingle();
      if (error) return reply.code(500).send({ error: error.message });
      if (!data) return reply.code(404).send({ error: "not_found" });
      return reply.send(data);
    },
  );

  app.patch(
    "/v1/organizations/:organizationId/agents/:agentId",
    { preHandler: userAuth },
    async (request, reply) => {
      const { organizationId, agentId } = request.params as {
        organizationId: string;
        agentId: string;
      };
      if (!(await assertOrgMember(db, organizationId, request.userId!))) {
        return reply.code(403).send({ error: "not_a_member" });
      }
      const body = updateAgentSchema.parse(request.body);

      const { data, error } = await db
        .from("agents")
        .update({
          ...(body.name != null && { name: body.name }),
          ...(body.description != null && { description: body.description }),
          ...(body.providerConfig != null && { provider_config: body.providerConfig }),
          ...(body.ragEnabled != null && { rag_enabled: body.ragEnabled }),
        })
        .eq("organization_id", organizationId)
        .eq("id", agentId)
        .select()
        .maybeSingle();
      if (error) return reply.code(500).send({ error: error.message });
      if (!data) return reply.code(404).send({ error: "not_found" });
      return reply.send(data);
    },
  );

  app.delete(
    "/v1/organizations/:organizationId/agents/:agentId",
    { preHandler: userAuth },
    async (request, reply) => {
      const { organizationId, agentId } = request.params as {
        organizationId: string;
        agentId: string;
      };
      if (!(await assertOrgMember(db, organizationId, request.userId!))) {
        return reply.code(403).send({ error: "not_a_member" });
      }
      const { error } = await db
        .from("agents")
        .delete()
        .eq("organization_id", organizationId)
        .eq("id", agentId);
      if (error) return reply.code(500).send({ error: error.message });
      return reply.code(204).send();
    },
  );
}
