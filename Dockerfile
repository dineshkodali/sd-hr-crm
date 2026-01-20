# Multi-stage Dockerfile for SD HR CRM

# --- Frontend Build Stage ---
FROM node:18-alpine AS frontend-builder
WORKDIR /app
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# --- Backend Shared Stage ---
FROM node:18-alpine AS backend
WORKDIR /app
COPY Backend/package*.json ./
RUN npm ci && npm list pg-query-stream
COPY Backend/ ./
RUN ls -d node_modules/pg-query-stream || echo "MISSING MODULE"
EXPOSE 4000
CMD ["node", "server.js"]

# --- Frontend Production Stage ---
FROM nginx:stable-alpine AS frontend
COPY --from=frontend-builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
