import type { FastifyInstance } from "fastify";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createUserAuth, assertOrgMember } from "../plugins/user-auth.js";
import { executeApprovedTool } from "../services/tools.js";

interface PendingRow {
  id: string;
  agent_tool_id: string;
  tool_name: string;
  arguments: Record<string, unknown>;
  status: string;
}

/**
 * Human-in-the-loop approvals for tools configured with requiresConfirmation.
 * Approving executes the tool and records the result; it does not resume
 * the live conversation/call that originally requested it (see
 * services/agent-runtime.ts for how a pending call is surfaced mid-turn).
 */
export function registerToolCallRequestRoutes(app: FastifyInstance, db: SupabaseClient) {
  const userAuth = createUserAuth(db);
  const basePath = "/v1/organizations/:organizationId/tool-call-requests";

  app.get(basePath, { preHandler: userAuth }, async (request, reply) => {
    const { organizationId } = request.params as { organizationId: string };
    if (!(await assertOrgMember(db, organizationId, request.userId!))) {
      return reply.code(403).send({ error: "not_a_member" });
    }
    const { status } = request.query as { status?: string };

    let query = db
      .from("tool_call_requests")
      .select("*, agents(name), agent_tools(name)")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false });
    if (status) query = query.eq("status", status);

    const { data, error } = await query;
    if (error) return reply.code(500).send({ error: error.message });
    return reply.send(data);
  });

  app.post(`${basePath}/:id/approve`, { preHandler: userAuth }, async (request, reply) => {
    const { organizationId, id } = request.params as { organizationId: string; id: string };
    if (!(await assertOrgMember(db, organizationId, request.userId!))) {
      return reply.code(403).send({ error: "not_a_member" });
    }

    const { data: pending } = await db
      .from("tool_call_requests")
      .select("id, agent_tool_id, tool_name, arguments, status")
      .eq("id", id)
      .eq("organization_id", organizationId)
      .maybeSingle();
    const row = pending as PendingRow | null;
    if (!row) return reply.code(404).send({ error: "not_found" });
    if (row.status !== "pending") return reply.code(409).send({ error: "not_pending" });

    try {
      const output = await executeApprovedTool(db, row.agent_tool_id, row.tool_name, row.arguments);
      const { data, error } = await db
        .from("tool_call_requests")
        .update({
          status: "executed",
          result: { output },
          decided_at: new Date().toISOString(),
          decided_by: request.userId,
        })
        .eq("id", id)
        .select()
        .single();
      if (error) return reply.code(500).send({ error: error.message });
      return reply.send(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : "execution_failed";
      const { data } = await db
        .from("tool_call_requests")
        .update({
          status: "failed",
          result: { error: message },
          decided_at: new Date().toISOString(),
          decided_by: request.userId,
        })
        .eq("id", id)
        .select()
        .single();
      return reply.code(502).send({ error: message, request: data });
    }
  });

  app.post(`${basePath}/:id/reject`, { preHandler: userAuth }, async (request, reply) => {
    const { organizationId, id } = request.params as { organizationId: string; id: string };
    if (!(await assertOrgMember(db, organizationId, request.userId!))) {
      return reply.code(403).send({ error: "not_a_member" });
    }

    const { data, error } = await db
      .from("tool_call_requests")
      .update({ status: "rejected", decided_at: new Date().toISOString(), decided_by: request.userId })
      .eq("id", id)
      .eq("organization_id", organizationId)
      .eq("status", "pending")
      .select()
      .maybeSingle();
    if (error) return reply.code(500).send({ error: error.message });
    if (!data) return reply.code(404).send({ error: "not_found_or_not_pending" });
    return reply.send(data);
  });
}
