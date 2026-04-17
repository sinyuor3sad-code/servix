FROM node:25-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/booking/package.json apps/booking/
# Copy ALL workspace package manifests so pnpm can resolve internal deps
COPY packages/types/package.json packages/types/
COPY packages/utils/package.json packages/utils/
COPY packages/ui/package.json packages/ui/
COPY packages/constants/package.json packages/constants/
COPY packages/validations/package.json packages/validations/
COPY packages/tsconfig/package.json packages/tsconfig/
COPY packages/eslint-config/package.json packages/eslint-config/
RUN echo "node-linker=hoisted" > .npmrc && \
    pnpm install --filter @servix/booking... --frozen-lockfile

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
WORKDIR /app/apps/booking
ENV NEXT_TELEMETRY_DISABLED=1
ENV NEXT_PUBLIC_API_URL=https://api.servi-x.com/api/v1
RUN mkdir -p public && node /app/node_modules/next/dist/bin/next build

FROM node:25-alpine AS runner
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
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=5 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3001/ || exit 1
CMD ["node", "apps/booking/server.js"]
