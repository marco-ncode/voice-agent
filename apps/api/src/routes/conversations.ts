import type { FastifyInstance } from "fastify";
import type { SupabaseClient } from "@supabase/supabase-js";
import { startConversationSchema, appendTurnSchema } from "@v-agent/shared";
import { createApiKeyAuth } from "../plugins/auth.js";

/**
 * Public API for external systems (SIP/VoIP connectors, CRMs, custom
 * front-ends) to drive a conversation with an agent. Authenticated with a
 * V Agent API key, scoped to the key's organization.
 */
export function registerConversationRoutes(app: FastifyInstance, db: SupabaseClient) {
  const apiKeyAuth = createApiKeyAuth(db);

  app.post("/v1/conversations", { preHandler: apiKeyAuth }, async (request, reply) => {
    const body = startConversationSchema.parse(request.body);

    const { data: agent } = await db
      .from("agents")
      .select("id")
      .eq("id", body.agentId)
      .eq("organization_id", request.organizationId)
      .maybeSingle();
    if (!agent) return reply.code(404).send({ error: "agent_not_found" });

    const { data, error } = await db
      .from("conversations")
      .insert({
        organization_id: request.organizationId,
        agent_id: body.agentId,
        channel: body.channel,
        metadata: body.metadata,
      })
      .select()
      .single();
    if (error) return reply.code(500).send({ error: error.message });
    return reply.code(201).send(data);
  });

  app.get("/v1/conversations/:id", { preHandler: apiKeyAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { data: conversation, error } = await db
      .from("conversations")
      .select()
      .eq("id", id)
      .eq("organization_id", request.organizationId)
      .maybeSingle();
    if (error) return reply.code(500).send({ error: error.message });
    if (!conversation) return reply.code(404).send({ error: "not_found" });

    const { data: turns } = await db
      .from("conversation_turns")
      .select()
      .eq("conversation_id", id)
      .order("created_at", { ascending: true });

    return reply.send({ ...conversation, turns: turns ?? [] });
  });

  app.post("/v1/conversations/:id/turns", { preHandler: apiKeyAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = appendTurnSchema.parse(request.body);

    const { data: conversation } = await db
      .from("conversations")
      .select("id")
      .eq("id", id)
      .eq("organization_id", request.organizationId)
      .maybeSingle();
    if (!conversation) return reply.code(404).send({ error: "not_found" });

    const { data, error } = await db
      .from("conversation_turns")
      .insert({
        conversation_id: id,
        role: body.role,
        text: body.text,
        audio_url: body.audioUrl ?? null,
      })
      .select()
      .single();
    if (error) return reply.code(500).send({ error: error.message });
    return reply.code(201).send(data);
  });

  app.post("/v1/conversations/:id/end", { preHandler: apiKeyAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { data, error } = await db
      .from("conversations")
      .update({ status: "completed", ended_at: new Date().toISOString() })
      .eq("id", id)
      .eq("organization_id", request.organizationId)
      .select()
      .maybeSingle();
    if (error) return reply.code(500).send({ error: error.message });
    if (!data) return reply.code(404).send({ error: "not_found" });
    return reply.send(data);
  });
}
