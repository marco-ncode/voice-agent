import type { FastifyInstance } from "fastify";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createOrganizationSchema } from "@v-agent/shared";
import { createUserAuth } from "../plugins/user-auth.js";

export function registerOrganizationRoutes(app: FastifyInstance, db: SupabaseClient) {
  const userAuth = createUserAuth(db);

  app.post("/v1/organizations", { preHandler: userAuth }, async (request, reply) => {
    const body = createOrganizationSchema.parse(request.body);

    const { data: org, error: orgError } = await db
      .from("organizations")
      .insert({ name: body.name })
      .select()
      .single();
    if (orgError) return reply.code(500).send({ error: orgError.message });

    const { error: memberError } = await db
      .from("organization_members")
      .insert({ organization_id: org.id, user_id: request.userId, role: "owner" });
    if (memberError) return reply.code(500).send({ error: memberError.message });

    return reply.code(201).send(org);
  });

  app.get("/v1/organizations", { preHandler: userAuth }, async (request, reply) => {
    const { data, error } = await db
      .from("organization_members")
      .select("organizations(id, name, created_at)")
      .eq("user_id", request.userId);
    if (error) return reply.code(500).send({ error: error.message });
    return reply.send(
      (data as Array<{ organizations: unknown }>).map((row) => row.organizations),
    );
  });
}
