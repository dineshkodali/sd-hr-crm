# Multi-stage Dockerfile for SD HR CRM

# --- Frontend Build Stage ---
FROM node:20-alpine AS frontend-builder
WORKDIR /app
COPY frontend/package.json frontend/package-lock.json ./
RUN npm install --no-audit --no-fund
COPY frontend/ ./
RUN npm run build

# --- Backend Shared Stage ---
FROM node:18-alpine AS backend
WORKDIR /app
COPY Backend/package.json Backend/package-lock.json ./
# Add build tools for native modules if needed

RUN npm install --no-audit --no-fund
COPY Backend/ ./
EXPOSE 4000
CMD ["node", "server.js"]

# --- Frontend Production Stage ---
FROM nginx:stable-alpine AS frontend
COPY --from=frontend-builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
