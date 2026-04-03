FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

FROM base AS builder
# Copy workspace config + lockfile
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/dashboard/package.json apps/dashboard/
# Force flat node_modules so next binary is available locally
RUN echo "shamefully-hoist=true" > .npmrc && \
    pnpm install --frozen-lockfile --filter @servix/dashboard...
# Copy source code
COPY . .
# Build
ENV NEXT_TELEMETRY_DISABLED=1
ENV NEXT_PUBLIC_API_URL=https://api.servi-x.com/api/v1
ENV NEXT_PUBLIC_WS_URL=https://api.servi-x.com
ENV NEXT_PUBLIC_DASHBOARD_URL=https://app.servi-x.com
RUN mkdir -p apps/dashboard/public && pnpm --filter @servix/dashboard build

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
