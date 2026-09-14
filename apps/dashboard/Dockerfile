FROM node:20-slim AS base
WORKDIR /app
RUN corepack enable

FROM base AS deps
COPY pnpm-workspace.yaml package.json ./
COPY apps/dashboard/package.json apps/dashboard/
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY apps/dashboard ./apps/dashboard
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
RUN pnpm --filter @v-agent/dashboard build

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build /app/apps/dashboard/.next ./apps/dashboard/.next
COPY --from=build /app/apps/dashboard/public ./apps/dashboard/public
COPY --from=build /app/apps/dashboard/package.json ./apps/dashboard/package.json
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/dashboard/node_modules ./apps/dashboard/node_modules
EXPOSE 3000
WORKDIR /app/apps/dashboard
CMD ["node_modules/.bin/next", "start", "-p", "3000"]
