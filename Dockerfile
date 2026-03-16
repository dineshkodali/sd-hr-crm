# ====================================
# Stage 1: Frontend Builder
# ====================================
FROM node:22-alpine AS frontend-builder
WORKDIR /build

COPY frontend/package*.json ./
RUN npm install --no-audit --no-fund

COPY frontend/ .
RUN npm run build && rm -rf node_modules


# ====================================
# Stage 2: Backend Dependencies
# ====================================
FROM node:22-alpine AS backend-deps
WORKDIR /deps

# Install only what's needed for native modules, then remove build tools
COPY Backend/package*.json ./
RUN apk add --no-cache --virtual .build-deps python3 make g++ \
    && npm install --no-audit --no-fund --omit=dev \
    && apk del .build-deps


# ====================================
# Stage 3: Production Backend
# ====================================
FROM node:22-alpine AS backend
WORKDIR /app

# Minimal runtime dependencies
RUN apk add --no-cache wget tini \
    && addgroup -g 1001 -S appgroup \
    && adduser -u 1001 -S appuser -G appgroup

# Copy pre-built node_modules (no build tools)
COPY --from=backend-deps /deps/node_modules ./node_modules
COPY --from=backend-deps /deps/package*.json ./

# Copy backend source
COPY Backend/ .

# Copy frontend build output
COPY --from=frontend-builder /build/dist ./frontend/dist

# Create uploads directory
RUN mkdir -p uploads && chown -R appuser:appgroup /app

USER appuser

EXPOSE 4000
ENV NODE_ENV=production

# Use tini as PID 1 for proper signal handling
ENTRYPOINT ["tini", "--"]
CMD ["node", "server.js"]


# ====================================
# Stage 4: Frontend via Nginx
# ====================================
FROM nginx:stable-alpine AS frontend

# Remove default config
RUN rm -f /etc/nginx/conf.d/default.conf

COPY --from=frontend-builder /build/dist /usr/share/nginx/html
COPY deployment/nginx/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
