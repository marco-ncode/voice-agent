import type { FastifyInstance } from "fastify";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { createUserAuth, assertOrgMember } from "../plugins/user-auth.js";
import { ingestDocument } from "../services/documents.js";
import { extractText } from "../services/text-extraction.js";
import { config } from "../config.js";

const createDocumentSchema = z.union([
  z.object({
    title: z.string().min(1).max(300),
    content: z.string().min(1),
    sourceUrl: z.string().url().optional(),
  }),
  z.object({
    title: z.string().min(1).max(300),
    fileBase64: z.string().min(1),
    fileName: z.string().min(1),
    mimeType: z.string().min(1),
    sourceUrl: z.string().url().optional(),
  }),
]);

interface DocumentRow {
  id: string;
  title: string;
  source_url: string | null;
  created_at: string;
  agent_document_chunks: Array<{ count: number }>;
}

/**
 * Knowledge base management for an agent's RAG context: upload/paste a
 * document, list what's indexed, remove one. Chunking + embedding happens
 * in services/documents.ts against the pgvector tables from
 * packages/db/migrations/0004_rag.sql.
 */
export function registerDocumentRoutes(app: FastifyInstance, db: SupabaseClient) {
  const userAuth = createUserAuth(db);
  const basePath = "/v1/organizations/:organizationId/agents/:agentId/documents";

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

    if (!config.providers.INFERENCE_SERVICE_URL || !config.providers.INFERENCE_SERVICE_API_KEY) {
      return reply.code(500).send({
        error: "INFERENCE_SERVICE_URL / INFERENCE_SERVICE_API_KEY are not configured (required to embed documents)",
      });
    }

    const body = createDocumentSchema.parse(request.body);
    try {
      const content =
        "content" in body ? body.content : await extractText(body.fileBase64, body.fileName, body.mimeType);

      const result = await ingestDocument(
        db,
        {
          baseUrl: config.providers.INFERENCE_SERVICE_URL,
          apiKey: config.providers.INFERENCE_SERVICE_API_KEY,
        },
        {
          organizationId,
          agentId,
          title: body.title,
          sourceUrl: body.sourceUrl,
          content,
        },
      );
      return reply.code(201).send(result);
    } catch (err) {
      return reply.code(400).send({ error: err instanceof Error ? err.message : "ingest_failed" });
    }
  });

  app.get(basePath, { preHandler: userAuth }, async (request, reply) => {
    const { organizationId, agentId } = request.params as {
      organizationId: string;
      agentId: string;
    };
    const guard = await requireAgent(organizationId, agentId, request.userId!);
    if (guard) return reply.code(guard.error).send(guard.body);

    const { data, error } = await db
      .from("agent_documents")
      .select("id, title, source_url, created_at, agent_document_chunks(count)")
      .eq("agent_id", agentId)
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false });
    if (error) return reply.code(500).send({ error: error.message });

    return reply.send(
      (data as unknown as DocumentRow[]).map((doc) => ({
        id: doc.id,
        title: doc.title,
        sourceUrl: doc.source_url,
        createdAt: doc.created_at,
        chunkCount: doc.agent_document_chunks[0]?.count ?? 0,
      })),
    );
  });

  app.delete(`${basePath}/:documentId`, { preHandler: userAuth }, async (request, reply) => {
    const { organizationId, agentId, documentId } = request.params as {
      organizationId: string;
      agentId: string;
      documentId: string;
    };
    const guard = await requireAgent(organizationId, agentId, request.userId!);
    if (guard) return reply.code(guard.error).send(guard.body);

    const { error } = await db
      .from("agent_documents")
      .delete()
      .eq("id", documentId)
      .eq("agent_id", agentId)
      .eq("organization_id", organizationId);
    if (error) return reply.code(500).send({ error: error.message });
    return reply.code(204).send();
  });
}
