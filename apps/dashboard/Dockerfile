FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/dashboard/package.json apps/dashboard/
RUN pnpm install --frozen-lockfile --filter @servix/dashboard...

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/dashboard/node_modules ./apps/dashboard/node_modules
COPY . .
WORKDIR /app/apps/dashboard
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
COPY --from=builder /app/apps/dashboard/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/apps/dashboard/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/dashboard/.next/static ./apps/dashboard/.next/static
USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
CMD ["node", "apps/dashboard/server.js"]
