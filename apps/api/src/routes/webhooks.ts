import type { FastifyInstance } from "fastify";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { createApiKeyAuth } from "../plugins/auth.js";

const telephonyEventSchema = z.object({
  event: z.enum(["call.started", "call.ended"]),
  externalCallId: z.string().min(1),
  metadata: z.record(z.unknown()).default({}),
});

/**
 * Generic inbound webhook for telephony/SIP connectors (Twilio, Vonage, a
 * SIP trunk gateway, a PBX integration, ...). Each connector maps its own
 * call-lifecycle events onto call.started / call.ended; the real-time audio
 * itself is exchanged over the WebSocket gateway in routes/realtime.ts,
 * keyed by the same externalCallId.
 */
export function registerWebhookRoutes(app: FastifyInstance, db: SupabaseClient) {
  const apiKeyAuth = createApiKeyAuth(db);

  app.post(
    "/v1/webhooks/telephony/:agentId",
    { preHandler: apiKeyAuth },
    async (request, reply) => {
      const { agentId } = request.params as { agentId: string };
      const body = telephonyEventSchema.parse(request.body);

      const { data: agent } = await db
        .from("agents")
        .select("id")
        .eq("id", agentId)
        .eq("organization_id", request.organizationId)
        .maybeSingle();
      if (!agent) return reply.code(404).send({ error: "agent_not_found" });

      if (body.event === "call.started") {
        const { data, error } = await db
          .from("conversations")
          .insert({
            organization_id: request.organizationId,
            agent_id: agentId,
            channel: "phone",
            metadata: { externalCallId: body.externalCallId, ...body.metadata },
          })
          .select()
          .single();
        if (error) return reply.code(500).send({ error: error.message });
        return reply.code(201).send(data);
      }

      // call.ended
      const { data: conversation } = await db
        .from("conversations")
        .select("id")
        .eq("organization_id", request.organizationId)
        .eq("agent_id", agentId)
        .contains("metadata", { externalCallId: body.externalCallId })
        .maybeSingle();
      if (!conversation) return reply.code(404).send({ error: "conversation_not_found" });

      const { data, error } = await db
        .from("conversations")
        .update({ status: "completed", ended_at: new Date().toISOString() })
        .eq("id", conversation.id)
        .select()
        .single();
      if (error) return reply.code(500).send({ error: error.message });
      return reply.send(data);
    },
  );
}
