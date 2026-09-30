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

# Create non-privileged user with standard UID 1000 for Hugging Face Spaces and cloud container runtimes
RUN adduser -D -u 1000 user

# Copy node_modules and compiled artifacts
COPY --from=builder --chown=user:user /app/package*.json ./
COPY --from=builder --chown=user:user /app/node_modules ./node_modules
COPY --from=builder --chown=user:user /app/dist ./dist
COPY --chown=user:user migrations/ ./migrations/

# Ensure workspace ownership
RUN chown -R user:user /app

USER user

ENV PORT=7860
EXPOSE 7860
EXPOSE 3000

# Default entrypoint runs the web/API service & bot worker
CMD ["node", "dist/index.js"]
