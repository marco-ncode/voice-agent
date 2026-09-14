import type { FastifyInstance } from "fastify";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createUserAuth, assertOrgMember } from "../plugins/user-auth.js";
import { buildProviderCatalog } from "../services/provider-catalog.js";

/**
 * Lets the dashboard populate model/voice pickers from what's actually
 * usable given the API keys configured on this deployment, instead of
 * requiring users to know provider-specific model IDs by heart. Scoped
 * under an organization path for route consistency, even though the
 * underlying catalog is the same for every org on this deployment (it
 * reflects apps/api's own environment, not anything per-tenant).
 */
export function registerProviderCatalogRoutes(app: FastifyInstance, db: SupabaseClient) {
  const userAuth = createUserAuth(db);

  app.get(
    "/v1/organizations/:organizationId/provider-catalog",
    { preHandler: userAuth },
    async (request, reply) => {
      const { organizationId } = request.params as { organizationId: string };
      if (!(await assertOrgMember(db, organizationId, request.userId!))) {
        return reply.code(403).send({ error: "not_a_member" });
      }
      return reply.send(await buildProviderCatalog());
    },
  );
}
