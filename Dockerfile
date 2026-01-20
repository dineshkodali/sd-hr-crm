# Multi-stage Dockerfile for SD HR CRM
# This Dockerfile can build both frontend and backend

# --- Frontend Build Stage ---
FROM node:18-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# --- Backend Build Stage ---
FROM node:18-alpine AS backend-build
WORKDIR /app/backend
COPY Backend/package*.json ./
RUN npm install
COPY Backend/ ./

# --- Final Production Stage ---
FROM node:18-alpine
WORKDIR /app

# Copy backend files
COPY --from=backend-build /app/backend /app/backend
# Copy frontend built assets to a directory the backend can serve if needed
# (Though in compose we usually use Nginx, this makes the root Dockerfile "proper" and self-contained)
COPY --from=frontend-build /app/frontend/dist /app/frontend/dist

WORKDIR /app/backend
EXPOSE 4000

# Start command
CMD ["node", "server.js"]
