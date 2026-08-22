# ==============================================================================
# SD Commercial HR CRM - Multi-Stage Production Dockerfile (Portainer Compatible)
# Targets:
#   - frontend-builder : Builds static assets with Vite
#   - backend          : Lightweight Node.js Express Backend Service
#   - frontend         : High-performance Nginx static web server & reverse proxy
# ==============================================================================

# ------------------------------------------------------------------------------
# Stage 1: Frontend Build Stage
# ------------------------------------------------------------------------------
FROM node:22-alpine AS frontend-builder
WORKDIR /build

# Copy dependency definitions
COPY frontend/package*.json ./
RUN npm ci --no-audit --no-fund || npm install --no-audit --no-fund

# Copy frontend source code and build production bundle
COPY frontend/ ./
RUN npm run build \
    && rm -rf node_modules /root/.npm

# ------------------------------------------------------------------------------
# Stage 2: Backend Dependencies Stage
# ------------------------------------------------------------------------------
FROM node:22-alpine AS backend-deps
WORKDIR /deps

COPY Backend/package*.json ./

# Install production dependencies only with temporary build toolchain if needed
RUN apk add --no-cache --virtual .build-deps python3 make g++ \
    && npm ci --omit=dev --no-audit --no-fund || npm install --omit=dev --no-audit --no-fund \
    && apk del .build-deps \
    && rm -rf /root/.npm

# ------------------------------------------------------------------------------
# Stage 3: Production Backend Service (Target: backend)
# ------------------------------------------------------------------------------
FROM node:22-alpine AS backend
WORKDIR /app

# Install minimal runtime process manager (tini) and healthcheck utility (wget)
RUN apk add --no-cache tini wget \
    && addgroup -g 1001 -S appgroup \
    && adduser -u 1001 -S appuser -G appgroup

# Copy node_modules and package definitions from build stage
COPY --chown=appuser:appgroup --from=backend-deps /deps/node_modules ./node_modules
COPY --chown=appuser:appgroup --from=backend-deps /deps/package*.json ./

# Copy backend application source code
COPY --chown=appuser:appgroup Backend/ ./

# Copy pre-built frontend distribution into backend for fallback static hosting if needed
COPY --chown=appuser:appgroup --from=frontend-builder /build/dist ./frontend/dist

# Create uploads storage with proper security permissions
RUN mkdir -p uploads && chown -R appuser:appgroup /app

USER appuser

EXPOSE 4000
ENV NODE_ENV=production

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:4000/api/health || exit 1

ENTRYPOINT ["tini", "--"]
CMD ["node", "server.js"]

# ------------------------------------------------------------------------------
# Stage 4: Production Frontend Service (Target: frontend)
# ------------------------------------------------------------------------------
FROM nginx:alpine AS frontend

# Remove default server definition
RUN rm -f /etc/nginx/conf.d/default.conf

# Copy static frontend bundle and optimized Nginx configuration
COPY --from=frontend-builder /build/dist /usr/share/nginx/html
COPY deployment/nginx/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:80/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
