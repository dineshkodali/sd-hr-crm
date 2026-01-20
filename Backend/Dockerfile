FROM node:18-alpine

WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./

# Install dependencies - using npm install --omit=dev if you want smaller image
# but since it's a workspace or needs specific deps, we'll do a simple install
RUN npm install

# Copy source code
COPY . .

# Expose the backend port
EXPOSE 4000

# Start the server
CMD ["node", "server.js"]
