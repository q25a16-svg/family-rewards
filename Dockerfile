# Build Stage for Frontend
FROM node:20-slim AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# Build Stage for Backend
FROM node:20-slim AS backend-builder
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm install
COPY backend/ ./
# Generate Prisma Client (needed for build)
RUN npx prisma generate
RUN npm run build

# Final Stage
FROM node:20-slim
WORKDIR /app

# Install openssl for Prisma
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# Copy built frontend
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Copy built backend
COPY --from=backend-builder /app/backend/dist ./backend/dist
COPY --from=backend-builder /app/backend/package*.json ./backend/
COPY --from=backend-builder /app/backend/prisma ./backend/prisma

# Copy root entry point, start script and package.json
COPY package*.json ./
COPY index.js ./
COPY start.sh ./
RUN chmod +x start.sh

# Install only production dependencies for root and backend
RUN npm install --omit=dev
WORKDIR /app/backend
RUN npm install --omit=dev
# Generate Prisma client for the correct architecture
RUN npx prisma generate

WORKDIR /app

# Expose port
EXPOSE 3000

# Set production env
ENV NODE_ENV=production
ENV PORT=3000

# Start script
CMD ["./start.sh"]
