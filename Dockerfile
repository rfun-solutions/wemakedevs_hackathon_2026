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
# Browser telemetry: the ingest-only Dash0 token is baked into the web bundle at build time (build stage only,
# never the runtime stage). Empty for PR builds; the app works without it. Passed by deploy.yaml.
ARG VITE_DASH0_INGEST_TOKEN=""
ARG VITE_DASH0_ENDPOINT=""
ENV VITE_DASH0_INGEST_TOKEN=$VITE_DASH0_INGEST_TOKEN VITE_DASH0_ENDPOINT=$VITE_DASH0_ENDPOINT
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
COPY api/migrations api/migrations
COPY --from=build /build/web/dist web/dist
ARG APP_VERSION=dev
ENV PORT=8080 APP_VERSION=$APP_VERSION NODE_ENV=production
# The node image's "node" user, by number so runAsNonRoot can check it.
USER 1000
EXPOSE 8080
# telemetry.js is preloaded so OTel instruments http/pg/pino before the app imports them (design D3).
CMD ["node", "--import", "./api/dist/telemetry.js", "api/dist/server.js"]
