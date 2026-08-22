# ==============================================================================
# SD Commercial HR CRM - Standalone Frontend Dockerfile
# Optimized multi-stage build for React/Vite served via Nginx Alpine
# ==============================================================================

# Stage 1: Build static assets
FROM node:22-alpine AS builder
WORKDIR /build

COPY frontend/package*.json ./
RUN npm ci --no-audit --no-fund || npm install --no-audit --no-fund

COPY frontend/ ./
RUN npm run build \
    && rm -rf node_modules /root/.npm

# Stage 2: Serve static files with Nginx
FROM nginx:alpine AS runner

RUN rm -f /etc/nginx/conf.d/default.conf

COPY --from=builder /build/dist /usr/share/nginx/html
COPY deployment/nginx/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:80/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
