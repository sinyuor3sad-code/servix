FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/landing/package.json apps/landing/
RUN echo "node-linker=hoisted" > .npmrc && \
    pnpm install --filter @servix/landing...

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
WORKDIR /app/apps/landing
ENV NEXT_TELEMETRY_DISABLED=1
ENV NEXT_PUBLIC_DASHBOARD_URL=https://app.servi-x.com
ENV NEXT_PUBLIC_API_URL=https://api.servi-x.com/api/v1
RUN mkdir -p public && node /app/node_modules/next/dist/bin/next build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
COPY --from=builder /app/apps/landing/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/apps/landing/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/landing/.next/static ./apps/landing/.next/static
USER nextjs
EXPOSE 3003
ENV PORT=3003
ENV HOSTNAME="0.0.0.0"
HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3003/ || exit 1
CMD ["node", "apps/landing/server.js"]
