# Frontend Dockerfile - Multi-stage build (context: project root)
# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY frontend/package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY frontend/ ./

# Copy video from project Video folder into public (served at /video/)
RUN mkdir -p public/video
COPY Video/ public/video/

# Build argument for API base URL (optional - if not provided, frontend uses dynamic detection)
ARG VITE_API_BASE
ENV VITE_API_BASE=$VITE_API_BASE

# Build the application
RUN npm run build

# Stage 2: Production - Serve with nginx
FROM nginx:alpine

# Copy built files from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx configuration
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf

# Expose port
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://localhost/ || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]

