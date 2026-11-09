# Multi-stage build: one image serves /api/* and web/dist (design D2).
# Stage 1: build web and api with the full (dev) dependency set.
FROM node:22-alpine AS build
WORKDIR /build
COPY package.json package-lock.json ./
COPY api/package.json api/
COPY web/package.json web/
RUN npm ci --no-audit --no-fund
COPY tsconfig.base.json ./
COPY api/ api/
COPY web/ web/
# Workspaces without a build script are skipped; ensure the output dirs exist for the COPY below.
RUN npm run build && mkdir -p api/dist web/dist

# Stage 2: runtime-only dependencies of the api workspace (no Playwright, no transformers).
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY api/package.json api/
COPY web/package.json web/
RUN npm ci --omit=dev -w api --no-audit --no-fund

# Stage 3: runtime.
FROM node:22-alpine
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY api/package.json api/
COPY --from=build /build/api/dist api/dist
COPY --from=build /build/web/dist web/dist
# The starter app is kept until the Fastify server lands (c0-scaffold group 2); it serves /healthz.
COPY app/ app/
ARG APP_VERSION=dev
ENV PORT=8080 APP_VERSION=$APP_VERSION NODE_ENV=production
# The node image's "node" user, by number so runAsNonRoot can check it.
USER 1000
EXPOSE 8080
CMD ["sh", "-c", "if [ -f api/dist/server.js ]; then exec node api/dist/server.js; else exec node app/server.js; fi"]
