import type { FastifyInstance } from "fastify";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { createUserAuth, assertOrgMember } from "../plugins/user-auth.js";
import { loadAgent, AgentRuntime } from "../services/agent-runtime.js";
import { pcmToWav } from "../services/audio.js";
import type { LLMMessage } from "@v-agent/providers";

const playgroundTurnSchema = z
  .object({
    text: z.string().min(1).optional(),
    audioBase64: z.string().optional(),
    history: z
      .array(z.object({ role: z.enum(["system", "user", "assistant"]), content: z.string() }))
      .default([]),
  })
  .refine((v) => v.text != null || v.audioBase64 != null, {
    message: "either text or audioBase64 is required",
  });

// TTS backends that return headerless raw PCM16 (16kHz mono) rather than an
// already-decodable container like mp3/wav, so the browser <audio> element
// needs a WAV header stitched on before it can play the response.
const RAW_PCM_TTS_PROVIDERS = new Set(["cartesia", "local"]);

/**
 * Lets the dashboard exercise an agent (text or voice) without minting a
 * real API key: authenticated with the user's own Supabase session, scoped
 * to organization membership. Stateless — the caller resends the running
 * history each turn, same shape the public /v1/conversations API persists.
 */
export function registerPlaygroundRoutes(app: FastifyInstance, db: SupabaseClient) {
  const userAuth = createUserAuth(db);

  app.post(
    "/v1/organizations/:organizationId/agents/:agentId/playground/turn",
    { preHandler: userAuth },
    async (request, reply) => {
      const { organizationId, agentId } = request.params as {
        organizationId: string;
        agentId: string;
      };
      if (!(await assertOrgMember(db, organizationId, request.userId!))) {
        return reply.code(403).send({ error: "not_a_member" });
      }

      const body = playgroundTurnSchema.parse(request.body);
      const agent = await loadAgent(db, organizationId, agentId);
      if (!agent) return reply.code(404).send({ error: "agent_not_found" });

      const history: LLMMessage[] = [
        { role: "system", content: agent.providerConfig.llm.systemPrompt },
        ...body.history,
      ];
      const runtime = new AgentRuntime(db, agent, undefined, history);

      const result = body.audioBase64
        ? await runtime.runTurn(Buffer.from(body.audioBase64, "base64"))
        : {
            transcript: body.text!,
            ...(await runtime.runTextTurn(body.text!)),
          };

      const isRawPcm = RAW_PCM_TTS_PROVIDERS.has(agent.providerConfig.tts.provider);
      const audio = isRawPcm ? pcmToWav(result.audio) : result.audio;

      return reply.send({
        transcript: result.transcript,
        replyText: result.replyText,
        audioBase64: audio.toString("base64"),
        audioMimeType: isRawPcm ? "audio/wav" : "audio/mpeg",
      });
    },
  );
}
