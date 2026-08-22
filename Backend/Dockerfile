# ==============================================================================
# SD Commercial HR CRM - Standalone Backend Dockerfile
# Optimized multi-stage build for containerized backend services (Cloud Run, ECS, K8s)
# ==============================================================================

# Build Stage: Dependencies
FROM node:22-alpine AS deps
WORKDIR /deps

COPY package*.json ./
RUN apk add --no-cache --virtual .build-deps python3 make g++ \
    && npm ci --omit=dev --no-audit --no-fund || npm install --omit=dev --no-audit --no-fund \
    && apk del .build-deps \
    && rm -rf /root/.npm

# Runtime Stage: Production
FROM node:22-alpine AS runner
WORKDIR /app

RUN apk add --no-cache tini wget \
    && addgroup -g 1001 -S appgroup \
    && adduser -u 1001 -S appuser -G appgroup

COPY --chown=appuser:appgroup --from=deps /deps/node_modules ./node_modules
COPY --chown=appuser:appgroup --from=deps /deps/package*.json ./
COPY --chown=appuser:appgroup . ./

RUN mkdir -p uploads && chown -R appuser:appgroup /app

USER appuser

EXPOSE 4000
ENV NODE_ENV=production

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:4000/api/health || exit 1

ENTRYPOINT ["tini", "--"]
CMD ["node", "server.js"]
