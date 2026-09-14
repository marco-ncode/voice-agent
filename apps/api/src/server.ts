import Fastify from "fastify";
import cors from "@fastify/cors";
import websocket from "@fastify/websocket";
import { createServiceClient } from "@v-agent/db";
import { config } from "./config.js";
import { registerOrganizationRoutes } from "./routes/organizations.js";
import { registerApiKeyRoutes } from "./routes/api-keys.js";
import { registerAgentRoutes } from "./routes/agents.js";
import { registerConversationRoutes } from "./routes/conversations.js";
import { registerWebhookRoutes } from "./routes/webhooks.js";
import { registerRealtimeRoutes } from "./routes/realtime.js";
import { registerPlaygroundRoutes } from "./routes/playground.js";

async function main() {
  const app = Fastify({ logger: true });
  const db = createServiceClient(config.supabase);

  await app.register(cors, { origin: true });
  await app.register(websocket);

  app.get("/health", async () => ({ status: "ok" }));

  registerOrganizationRoutes(app, db);
  registerApiKeyRoutes(app, db);
  registerAgentRoutes(app, db);
  registerConversationRoutes(app, db);
  registerWebhookRoutes(app, db);
  registerRealtimeRoutes(app, db);
  registerPlaygroundRoutes(app, db);

  await app.listen({ port: config.port, host: "0.0.0.0" });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
