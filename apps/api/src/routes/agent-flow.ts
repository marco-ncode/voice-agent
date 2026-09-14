import type { FastifyInstance } from "fastify";
import type { SupabaseClient } from "@supabase/supabase-js";
import { agentFlowSchema } from "@v-agent/shared";
import { createUserAuth, assertOrgMember } from "../plugins/user-auth.js";

/**
 * CRUD for an agent's visual conversation flow (nodes/edges graph). One
 * flow per agent — PUT upserts on agent_id. See services/flow-runtime.ts
 * for how it's executed, and services/agent-flow.ts for how AgentRuntime
 * decides whether to use it at all (only when `enabled`).
 */
export function registerAgentFlowRoutes(app: FastifyInstance, db: SupabaseClient) {
  const userAuth = createUserAuth(db);
  const path = "/v1/organizations/:organizationId/agents/:agentId/flow";

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

  app.get(path, { preHandler: userAuth }, async (request, reply) => {
    const { organizationId, agentId } = request.params as {
      organizationId: string;
      agentId: string;
    };
    const guard = await requireAgent(organizationId, agentId, request.userId!);
    if (guard) return reply.code(guard.error).send(guard.body);

    const { data, error } = await db
      .from("agent_flows")
      .select()
      .eq("agent_id", agentId)
      .eq("organization_id", organizationId)
      .maybeSingle();
    if (error) return reply.code(500).send({ error: error.message });
    return reply.send(data ?? null);
  });

  app.put(path, { preHandler: userAuth }, async (request, reply) => {
    const { organizationId, agentId } = request.params as {
      organizationId: string;
      agentId: string;
    };
    const guard = await requireAgent(organizationId, agentId, request.userId!);
    if (guard) return reply.code(guard.error).send(guard.body);

    const body = agentFlowSchema.parse(request.body);
    const { data, error } = await db
      .from("agent_flows")
      .upsert(
        {
          agent_id: agentId,
          organization_id: organizationId,
          nodes: body.nodes,
          edges: body.edges,
          enabled: body.enabled,
        },
        { onConflict: "agent_id" },
      )
      .select()
      .single();
    if (error) return reply.code(500).send({ error: error.message });
    return reply.send(data);
  });
}
