# Build stage
FROM public.ecr.aws/docker/library/node:20-alpine AS builder

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install dependencies (without frozen-lockfile to allow updates)
RUN pnpm install

# Copy prisma schema
COPY prisma ./prisma

# Generate Prisma Client
RUN pnpm prisma:generate

# Copy source code
COPY . .

# Build the application
RUN pnpm build

# Production stage
FROM public.ecr.aws/docker/library/node:20-alpine AS runner

WORKDIR /app

# Install pnpm and netcat for DB health check
RUN npm install -g pnpm && apk add --no-cache netcat-openbsd

# Copy necessary files from builder
COPY --from=builder /app/package.json ./
COPY --from=builder /app/pnpm-lock.yaml ./
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/server.js ./server.js
COPY --from=builder /app/collab-server.mjs ./collab-server.mjs
COPY --from=builder /app/next.config.js ./next.config.js

RUN mkdir -p /app/uploads

COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN sed -i 's/\r$//' ./docker-entrypoint.sh \
	&& chmod +x ./docker-entrypoint.sh

# Expose the port
EXPOSE 3000

# Set environment to production
ENV NODE_ENV=production

# Start via entrypoint (runs migrations + seed + server)
CMD ["/app/docker-entrypoint.sh"]
