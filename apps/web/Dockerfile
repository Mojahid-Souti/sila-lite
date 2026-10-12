FROM node:24-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

FROM base AS deps
WORKDIR /app
# Copy monorepo root manifests so pnpm resolves the workspace lockfile
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json ./apps/web/package.json
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --filter sila-web... --config.strict-dep-builds=false

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules
COPY apps/web ./apps/web
COPY package.json pnpm-workspace.yaml ./
ENV NEXT_TELEMETRY_DISABLED=1
# NEXT_PUBLIC_* vars must be set at build time — they are inlined by the bundler
ARG NEXT_PUBLIC_API_URL=http://localhost:8001
ARG NEXT_PUBLIC_SUPABASE_URL=http://localhost:8000
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
RUN pnpm --filter sila-web build

FROM base AS dev
WORKDIR /app
# Pre-install node_modules from deps stage so anonymous volumes can shadow them
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules
COPY package.json pnpm-workspace.yaml ./
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=development
EXPOSE 3002
WORKDIR /app/apps/web
# Turbopack, not webpack. Webpack dev compiled each route on demand and never
# gave the memory back: RSS climbed to the 2 GiB cgroup cap, compiles slowed
# from 6.7s to 13.8s as V8 thrashed, and opening one more tab pushed the server
# over — killing every tab at once (BUG-030 saw 31 restarts of exactly this).
CMD ["node_modules/.bin/next", "dev", "--turbopack", "--port", "3002", "--hostname", "0.0.0.0"]

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME="0.0.0.0"
ENV PORT=3002

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# standalone/ mirrors the monorepo tree: server.js lives at apps/web/server.js
# static files must sit at apps/web/.next/static relative to WORKDIR
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static
# The standalone output does not include public/ (logos, icons, images).
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/public ./apps/web/public
# Next writes its image cache under .next; group 0 + g=u lets OpenShift's
# random UID (always in group 0) write it too.
RUN mkdir -p apps/web/.next/cache && chgrp -R 0 apps/web/.next && chmod -R g=u apps/web/.next

USER nextjs
EXPOSE 3002

CMD ["node", "apps/web/server.js"]
