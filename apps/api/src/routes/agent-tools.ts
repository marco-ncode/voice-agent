import type { FastifyInstance } from "fastify";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAgentToolSchema, updateAgentToolSchema } from "@v-agent/shared";
import { createUserAuth, assertOrgMember } from "../plugins/user-auth.js";

/**
 * CRUD for the tools an agent can call mid-conversation (MCP servers or
 * custom API tools) — see services/tools.ts for how they're actually
 * invoked during a turn.
 */
export function registerAgentToolRoutes(app: FastifyInstance, db: SupabaseClient) {
  const userAuth = createUserAuth(db);
  const basePath = "/v1/organizations/:organizationId/agents/:agentId/tools";

  async function requireAgent(organizationId: string, agentId: string, userId: string) {
    if (!(await assertOrgMember(db, organizationId, userId))) {
      return { error: 403 as const, body: { error: "not_a_member" } };
    }
    const { data: agent } = await db
      .from("agents")
      .select("id")
      .eq("id", agentId)
      .eq("organization_id", organizationId)
      .maybeSingle();
    if (!agent) return { error: 404 as const, body: { error: "agent_not_found" } };
    return null;
  }

  app.post(basePath, { preHandler: userAuth }, async (request, reply) => {
    const { organizationId, agentId } = request.params as {
      organizationId: string;
      agentId: string;
    };
    const guard = await requireAgent(organizationId, agentId, request.userId!);
    if (guard) return reply.code(guard.error).send(guard.body);

    const body = createAgentToolSchema.parse(request.body);
    const { data, error } = await db
      .from("agent_tools")
      .insert({
        agent_id: agentId,
        organization_id: organizationId,
        name: body.name,
        description: body.description,
        kind: body.kind,
        enabled: body.enabled,
        requires_confirmation: body.requiresConfirmation,
        config: body.config,
      })
      .select()
      .single();
    if (error) return reply.code(500).send({ error: error.message });
    return reply.code(201).send(data);
  });

  app.get(basePath, { preHandler: userAuth }, async (request, reply) => {
    const { organizationId, agentId } = request.params as {
      organizationId: string;
      agentId: string;
    };
    const guard = await requireAgent(organizationId, agentId, request.userId!);
    if (guard) return reply.code(guard.error).send(guard.body);

    const { data, error } = await db
      .from("agent_tools")
      .select()
      .eq("agent_id", agentId)
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: true });
    if (error) return reply.code(500).send({ error: error.message });
    return reply.send(data);
  });

  app.patch(`${basePath}/:toolId`, { preHandler: userAuth }, async (request, reply) => {
    const { organizationId, agentId, toolId } = request.params as {
      organizationId: string;
      agentId: string;
      toolId: string;
    };
    const guard = await requireAgent(organizationId, agentId, request.userId!);
    if (guard) return reply.code(guard.error).send(guard.body);

    const body = updateAgentToolSchema.parse(request.body);
    const { data, error } = await db
      .from("agent_tools")
      .update({
        ...(body.name != null && { name: body.name }),
        ...(body.description != null && { description: body.description }),
        ...(body.enabled != null && { enabled: body.enabled }),
        ...(body.requiresConfirmation != null && { requires_confirmation: body.requiresConfirmation }),
        ...(body.config != null && { config: body.config }),
      })
      .eq("id", toolId)
      .eq("agent_id", agentId)
      .eq("organization_id", organizationId)
      .select()
      .maybeSingle();
    if (error) return reply.code(500).send({ error: error.message });
    if (!data) return reply.code(404).send({ error: "not_found" });
    return reply.send(data);
  });

  app.delete(`${basePath}/:toolId`, { preHandler: userAuth }, async (request, reply) => {
    const { organizationId, agentId, toolId } = request.params as {
      organizationId: string;
      agentId: string;
      toolId: string;
    };
    const guard = await requireAgent(organizationId, agentId, request.userId!);
    if (guard) return reply.code(guard.error).send(guard.body);

    const { error } = await db
      .from("agent_tools")
      .delete()
      .eq("id", toolId)
      .eq("agent_id", agentId)
      .eq("organization_id", organizationId);
    if (error) return reply.code(500).send({ error: error.message });
    return reply.code(204).send();
  });
}
