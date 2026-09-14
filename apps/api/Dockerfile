FROM node:20-slim AS base
WORKDIR /app
RUN corepack enable

FROM base AS deps
COPY pnpm-workspace.yaml package.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/providers/package.json packages/providers/
COPY packages/db/package.json packages/db/
COPY apps/api/package.json apps/api/
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY tsconfig.base.json ./
COPY packages ./packages
COPY apps/api ./apps/api
RUN pnpm --filter @v-agent/shared --filter @v-agent/providers --filter @v-agent/db --filter @v-agent/api build

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build /app ./
EXPOSE 8080
CMD ["node", "apps/api/dist/server.js"]
