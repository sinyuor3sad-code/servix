FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/admin/package.json apps/admin/
RUN pnpm install --frozen-lockfile --filter @servix/admin...

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/admin/node_modules ./apps/admin/node_modules
COPY . .
WORKDIR /app/apps/admin
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
COPY --from=builder /app/apps/admin/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/apps/admin/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/admin/.next/static ./.next/static
USER nextjs
EXPOSE 3002
ENV PORT=3002
ENV HOSTNAME="0.0.0.0"
CMD ["node", "server.js"]
