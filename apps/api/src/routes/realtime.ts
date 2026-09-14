import type { FastifyInstance } from "fastify";
import type { SupabaseClient } from "@supabase/supabase-js";
import { hashApiKey } from "../plugins/auth.js";
import { loadAgent, AgentRuntime } from "../services/agent-runtime.js";
import { UtteranceDetector } from "../services/vad.js";
import type { LLMMessage } from "@v-agent/providers";

async function resolveOrganizationId(
  db: SupabaseClient,
  rawApiKey: string | undefined,
): Promise<string | null> {
  if (!rawApiKey) return null;
  const { data } = await db
    .from("api_keys")
    .select("organization_id, revoked_at")
    .eq("hashed_key", hashApiKey(rawApiKey))
    .maybeSingle();
  if (!data || data.revoked_at) return null;
  return data.organization_id;
}

/**
 * Bidirectional real-time audio gateway:
 * ws(s)://.../v1/realtime/:agentId?api_key=...&conversation_id=...
 *
 * Client -> server: binary frames of 16kHz mono PCM16LE audio.
 * Server -> client: binary frames of synthesized reply audio, interleaved
 * with JSON text frames carrying { type: "transcript" | "reply" | "error", ... }.
 *
 * This is the interface external telephony/SIP connectors bridge into
 * (translating RTP <-> these WebSocket frames) as well as what a browser
 * client or the dashboard's playground can speak directly.
 */
export function registerRealtimeRoutes(app: FastifyInstance, db: SupabaseClient) {
  app.get("/v1/realtime/:agentId", { websocket: true }, async (socket, request) => {
    const { agentId } = request.params as { agentId: string };
    const query = request.query as { api_key?: string; conversation_id?: string };
    const authHeader = request.headers.authorization;
    const rawApiKey = query.api_key ?? authHeader?.replace(/^Bearer /, "");

    const organizationId = await resolveOrganizationId(db, rawApiKey);
    if (!organizationId) {
      socket.send(JSON.stringify({ type: "error", message: "invalid_api_key" }));
      socket.close();
      return;
    }

    const agent = await loadAgent(db, organizationId, agentId);
    if (!agent) {
      socket.send(JSON.stringify({ type: "error", message: "agent_not_found" }));
      socket.close();
      return;
    }

    const history: LLMMessage[] = [
      { role: "system", content: agent.providerConfig.llm.systemPrompt },
    ];
    const detector = new UtteranceDetector(
      agent.providerConfig.vad.silenceTimeoutMs,
      agent.providerConfig.vad.minSpeechMs,
    );
    let processing = false;

    socket.on("message", (raw: Buffer, isBinary: boolean) => {
      if (!isBinary) return; // JSON control frames reserved for future use (e.g. barge-in)

      const utterance = detector.push(raw);
      if (!utterance || processing) return;
      processing = true;

      const runtime = new AgentRuntime(db, agent, query.conversation_id, history);
      runtime
        .runTurn(utterance)
        .then((result) => {
          socket.send(JSON.stringify({ type: "transcript", text: result.transcript }));
          socket.send(JSON.stringify({ type: "reply", text: result.replyText }));
          socket.send(result.audio);
        })
        .catch((err: Error) => {
          socket.send(JSON.stringify({ type: "error", message: err.message }));
        })
        .finally(() => {
          processing = false;
        });
    });

    socket.on("close", () => {
      // Nothing to clean up yet; conversation lifecycle is managed via
      // /v1/webhooks/telephony and /v1/conversations/:id/end.
    });
  });
}
