FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/dashboard/package.json apps/dashboard/
RUN echo "node-linker=hoisted" > .npmrc && \
    pnpm install --filter @servix/dashboard...

FROM base AS builder
# With hoisted, everything is in root node_modules (no apps/dashboard/node_modules)
COPY --from=deps /app/node_modules ./node_modules
# Copy source code (node_modules excluded by .dockerignore)
COPY . .
WORKDIR /app/apps/dashboard
ENV NEXT_TELEMETRY_DISABLED=1
ENV NEXT_PUBLIC_API_URL=https://api.servi-x.com/api/v1
ENV NEXT_PUBLIC_WS_URL=https://api.servi-x.com
ENV NEXT_PUBLIC_DASHBOARD_URL=https://app.servi-x.com
RUN mkdir -p public && node /app/node_modules/next/dist/bin/next build

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
HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3000/ || exit 1
CMD ["node", "apps/dashboard/server.js"]
