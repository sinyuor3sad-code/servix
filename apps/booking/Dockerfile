FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/booking/package.json apps/booking/
RUN pnpm install --frozen-lockfile --filter @servix/booking...

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/booking/node_modules ./apps/booking/node_modules
COPY . .
WORKDIR /app/apps/booking
ENV NEXT_TELEMETRY_DISABLED=1
ENV NEXT_PUBLIC_API_URL=https://api.servi-x.com/api/v1
RUN mkdir -p public && pnpm build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
COPY --from=builder /app/apps/booking/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/apps/booking/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/booking/.next/static ./apps/booking/.next/static
USER nextjs
EXPOSE 3001
ENV PORT=3001
ENV HOSTNAME="0.0.0.0"
CMD ["node", "apps/booking/server.js"]
