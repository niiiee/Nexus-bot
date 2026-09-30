# Multi-stage production Dockerfile for Nexus Discord Bot & API
FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies
COPY package*.json ./
RUN npm ci

# Copy source code and build TypeScript
COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

# Prune dev dependencies for production runtime
RUN npm prune --production

# -------------------------------------------------------------
# Production Runner Image
# -------------------------------------------------------------
FROM node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production

# Install curl for container health checks
RUN apk add --no-cache curl

# Create non-privileged service user
RUN addgroup -S nexus && adduser -S nexus -G nexus

# Copy node_modules and compiled artifacts
COPY --from=builder --chown=nexus:nexus /app/package*.json ./
COPY --from=builder --chown=nexus:nexus /app/node_modules ./node_modules
COPY --from=builder --chown=nexus:nexus /app/dist ./dist
COPY --chown=nexus:nexus migrations/ ./migrations/

USER nexus

EXPOSE 3000

# Default entrypoint runs the web/API service; overridden by worker process
CMD ["node", "dist/index.js"]
