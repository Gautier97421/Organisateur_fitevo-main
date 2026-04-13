# ── Stage 1: base ──────────────────────────────
FROM node:22-alpine AS base
RUN apk add --no-cache openssl libc6-compat
WORKDIR /app

# ── Stage 2: deps ─────────────────────────────
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts && npm cache clean --force

# ── Stage 3: builder ──────────────────────────
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV DATABASE_URL="postgresql://build:build@localhost:5432/build"
ENV NEXT_TELEMETRY_DISABLED=1

RUN npx prisma generate && npm run build

# ── Stage 4: production ───────────────────────
FROM node:22-alpine AS production

LABEL org.opencontainers.image.source="https://github.com/SoloDesignHQ/organisateur-fitevo"
LABEL org.opencontainers.image.description="Organisateur FitEvo"
LABEL org.opencontainers.image.licenses="UNLICENSED"

RUN apk add --no-cache openssl libc6-compat dumb-init netcat-openbsd \
  && addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

WORKDIR /app

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --chown=nextjs:nodejs docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

USER nextjs

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/health || exit 1

ENTRYPOINT ["dumb-init", "--"]
CMD ["/app/docker-entrypoint.sh"]
